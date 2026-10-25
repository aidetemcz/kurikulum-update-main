import type { Dictionary } from "@/lib/i18n";

/** Metodika tak, jak stačí k vypsání jejího názvu. */
export type NamedModule = {
  name: string;
  name_en?: string | null;
  /** Názvy v dalších jazycích, např. {"sk": "...", "hu": "..."}. */
  name_translations?: Record<string, string> | null;
  /** Název, který si pro metodiku nastavila zobrazená země (má přednost). */
  local_name?: string | null;
};

// Název metodiky pro zobrazení v jazyce rozhraní.
//
// Když si zobrazená země metodiku přejmenovala, platí její název.
// Angličtina bere přesný název z anglického webu (name_en), slovenština
// a maďarština názvy z name_translations. Když překlad chybí, ukáže se
// původní český název.
export function moduleName(module: NamedModule, t: Dictionary): string {
  if (module.local_name?.trim()) return module.local_name.trim();
  if (t.locale === "cs") return module.name;

  const preklad =
    t.locale === "en" ? module.name_en : module.name_translations?.[t.locale];
  return preklad?.trim() ? preklad.trim() : module.name;
}
