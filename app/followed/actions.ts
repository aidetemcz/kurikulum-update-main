"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { canWriteForCountry, requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";

export type FollowState = { error: string } | { savedAt: string } | null;

// Uloží, které metodiky země sleduje. Smí editor té země a admin; zapisuje
// se přes service role, protože v databázi pro zápis pravidla nejsou.
export async function saveFollowedModules(
  countryId: string,
  moduleIds: string[]
): Promise<FollowState> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user, countryId);
  if (!canWriteForCountry(user, countryId)) return { error: t.followNotAllowed };

  const supabase = createAdminClient();
  const unikatni = [...new Set(moduleIds)];

  const { error: deleteError } = await supabase
    .from("country_modules")
    .delete()
    .eq("country_id", countryId);
  if (deleteError) return { error: `${t.followSaveFailed} ${deleteError.message}` };

  if (unikatni.length > 0) {
    const { error } = await supabase
      .from("country_modules")
      .insert(unikatni.map((moduleId) => ({ country_id: countryId, module_id: moduleId })));
    if (error) return { error: `${t.followSaveFailed} ${error.message}` };
  }

  const savedAt = new Date().toISOString();
  const { error: countryError } = await supabase
    .from("countries")
    .update({ modules_chosen_at: savedAt })
    .eq("id", countryId);
  if (countryError) return { error: `${t.followSaveFailed} ${countryError.message}` };

  revalidatePath("/");
  revalidatePath("/modules");
  return { savedAt };
}
