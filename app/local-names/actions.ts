"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { canWriteForCountry, requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { userError } from "@/lib/user-error";

export type RenameState = { error: string } | { savedAt: string } | null;

// Uloží (nebo prázdným názvem zruší) vlastní název metodiky pro jednu zemi.
// Smí editor té země a admin; zapisuje service role po kontrole práv.
export async function saveLocalModuleName(
  countryId: string,
  moduleId: string,
  name: string
): Promise<RenameState> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user, countryId);
  if (!canWriteForCountry(user, countryId)) return { error: t.renameNotAllowed };

  const nazev = name.trim();
  if (nazev.length > 300) return { error: t.renameTooLong };

  const supabase = createAdminClient();
  const { error } = nazev
    ? await supabase
        .from("country_module_names")
        .upsert(
          { country_id: countryId, module_id: moduleId, name: nazev, updated_at: new Date().toISOString() },
          { onConflict: "country_id,module_id" }
        )
    : await supabase
        .from("country_module_names")
        .delete()
        .eq("country_id", countryId)
        .eq("module_id", moduleId);
  if (error) {
    return { error: await userError(t.renameFailed, error, "Vlastní název se nepodařilo uložit:") };
  }

  revalidatePath(`/modules/${moduleId}`);
  revalidatePath("/modules");
  revalidatePath("/");
  return { savedAt: new Date().toISOString() };
}
