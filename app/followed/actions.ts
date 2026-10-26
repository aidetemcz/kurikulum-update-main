"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canWriteForCountry, requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { userError } from "@/lib/user-error";

export type FollowState = { error: string } | { savedAt: string } | null;

// Uloží, které metodiky země sleduje. Smí editor té země a admin.
// Zapisuje databázová funkce save_followed_modules v jedné transakci –
// když něco selže, zůstane původní výběr (dřív mohla země skončit
// s prázdným výběrem).
export async function saveFollowedModules(
  countryId: string,
  moduleIds: string[]
): Promise<FollowState> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user, countryId);
  if (!canWriteForCountry(user, countryId)) return { error: t.followNotAllowed };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_followed_modules", {
    p_country_id: countryId,
    p_module_ids: [...new Set(moduleIds)],
  });
  if (error) {
    return { error: await userError(t.followSaveFailed, error, "Sledované metodiky se nepodařilo uložit:") };
  }

  revalidatePath("/");
  revalidatePath("/modules");
  return { savedAt: typeof data === "string" ? data : new Date().toISOString() };
}
