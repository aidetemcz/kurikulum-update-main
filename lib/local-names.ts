// Vlastní názvy metodik, které si země nastavila jen pro sebe (migrace 0016).
// Vlastní název má přednost před překladem – je to název, pod kterým
// metodiku v té zemi opravdu znají.
//
// Bez migrace dotaz skončí chybou a appka ukazuje běžné názvy.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getLocalNames = cache(async (countryId: string): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("country_module_names")
    .select("module_id, name")
    .eq("country_id", countryId);
  return new Map((data ?? []).map((row) => [row.module_id, row.name]));
});

// Všechny vlastní názvy podle země – pro obrazovku nahrávání, kde se dá
// přepínat, za kterou zemi se nahrává.
export async function getLocalNamesForCountries(
  countryIds: string[]
): Promise<Record<string, Record<string, string>>> {
  if (countryIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("country_module_names")
    .select("country_id, module_id, name")
    .in("country_id", countryIds);

  const vysledek: Record<string, Record<string, string>> = {};
  for (const row of data ?? []) {
    (vysledek[row.country_id] ??= {})[row.module_id] = row.name;
  }
  return vysledek;
}

/** Doplní k metodikám vlastní název země (local_name). */
export function withLocalNames<T extends { id: string }>(
  modules: T[],
  names: Map<string, string> | Record<string, string>
): (T & { local_name: string | null })[] {
  const najdi = (id: string) => (names instanceof Map ? names.get(id) : names[id]) ?? null;
  return modules.map((module) => ({ ...module, local_name: najdi(module.id) }));
}
