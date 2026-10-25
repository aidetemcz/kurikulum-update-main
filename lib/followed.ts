// Které metodiky země sleduje (migrace 0015). Dokud si země nevybrala,
// sleduje všechno – stejně jako před zavedením výběru.
//
// Když migrace v databázi ještě chybí, dotazy skončí chybou a appka se
// chová, jako by si nikdo nevybíral (nic se tím nerozbije).
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Followed = {
  /** Vybrala si už země, co sleduje? */
  chosen: boolean;
  /** Sledované metodiky; při chosen = false je prázdné a platí „všechno“. */
  moduleIds: Set<string>;
};

export const getFollowed = cache(async (countryId: string): Promise<Followed> => {
  const supabase = await createClient();
  const [{ data: zeme }, { data: vazby }] = await Promise.all([
    supabase.from("countries").select("modules_chosen_at").eq("id", countryId).maybeSingle(),
    supabase.from("country_modules").select("module_id").eq("country_id", countryId),
  ]);

  const chosen = Boolean(zeme && "modules_chosen_at" in zeme && zeme.modules_chosen_at);
  return { chosen, moduleIds: new Set((vazby ?? []).map((row) => row.module_id)) };
});

/** Sleduje země tuhle metodiku? */
export function follows(followed: Followed, moduleId: string): boolean {
  return !followed.chosen || followed.moduleIds.has(moduleId);
}

// Kterým zemím ze seznamu se má změna metodiky poslat: těm, které ji
// sledují, a těm, které si zatím nevybraly.
export async function countriesFollowing(
  moduleId: string,
  countryIds: string[]
): Promise<Set<string>> {
  if (countryIds.length === 0) return new Set();
  const supabase = await createClient();

  const { data: zeme, error } = await supabase
    .from("countries")
    .select("id, modules_chosen_at")
    .in("id", countryIds);
  // Bez migrace 0015 chodí změny všem, jako dřív.
  if (error || !zeme) return new Set(countryIds);

  const { data: vazby } = await supabase
    .from("country_modules")
    .select("country_id")
    .eq("module_id", moduleId)
    .in("country_id", countryIds);
  const sleduji = new Set((vazby ?? []).map((row) => row.country_id));

  return new Set(
    zeme.filter((row) => !row.modules_chosen_at || sleduji.has(row.id)).map((row) => row.id)
  );
}
