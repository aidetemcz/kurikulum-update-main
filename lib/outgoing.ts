// Odchozí změny: rámečky z verzí, které zobrazená země sama zveřejnila.
// Protějšek přehledu Příchozí změny – ať jde rychle najít, co a kdy země
// ostatním poslala. Tvar je stejný jako u příchozích, aby karty vypadaly
// stejně.
import { createClient } from "@/lib/supabase/server";
import { getLocalNames } from "@/lib/local-names";
import { versionLabel } from "@/lib/version-label";
import { sortMarks } from "@/lib/annotations";
import { toDocumentKind, versionDate, type Mark, type PendingChange } from "@/lib/types";

export type OutgoingChange = PendingChange & {
  /** Otevře rovnou tu verzi v dokumentu. */
  href: string;
};

type ModuleNames = {
  name: string;
  name_en: string | null;
  name_translations: Record<string, string> | null;
};

type Row = {
  id: string;
  module_id: string;
  kind: string | null;
  version_number: number | null;
  version_label: string | null;
  published_at: string | null;
  uploaded_at: string;
  users: { email: string } | { email: string }[] | null;
  modules: ModuleNames | ModuleNames[] | null;
  countries: { name: string } | { name: string }[] | null;
  annotations: Mark[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/** Změny z posledních 50 zveřejněných verzí země, od nejnovější verze. */
export async function getOutgoing(
  countryId: string,
  /** Jen verze, které nahrál tenhle uživatel. */
  authorId: string | null
): Promise<OutgoingChange[]> {
  const supabase = await createClient();
  let dotaz = supabase
    .from("document_versions")
    .select(
      `id, module_id, kind, version_number, version_label, published_at, uploaded_at,
       users:uploaded_by (email),
       modules (name, name_en, name_translations),
       countries (name),
       annotations (*)`
    )
    .eq("country_id", countryId)
    .eq("status", "published");
  if (authorId) dotaz = dotaz.eq("uploaded_by", authorId);

  const [{ data, error }, vlastniNazvy] = await Promise.all([
    dotaz
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("uploaded_at", { ascending: false })
      .limit(50),
    getLocalNames(countryId),
  ]);
  if (error) console.error("Odchozí změny se nepodařilo načíst:", error);

  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const modul = one(row.modules);
    const kind = toDocumentKind(row.kind);
    const publishedAt = versionDate(row);
    return sortMarks(row.annotations ?? []).map((mark) => ({
      id: mark.id,
      annotationId: mark.id,
      createdAt: publishedAt,
      dismissedAt: null,
      resolution: null,
      publishedAt,
      // Vlastní poznámky se nepřekládají.
      sourceLocale: null,
      translations: {},
      translationFailed: false,
      moduleId: row.module_id,
      moduleName: modul?.name ?? "",
      moduleNames: {
        name: modul?.name ?? "",
        name_en: modul?.name_en ?? null,
        name_translations: modul?.name_translations ?? null,
        local_name: vlastniNazvy.get(row.module_id) ?? null,
      },
      fromCountryName: one(row.countries)?.name ?? "",
      uploadedByEmail: one(row.users)?.email ?? null,
      versionNumber: row.version_number,
      versionLabel: versionLabel(row),
      page: mark.page,
      note: mark.note,
      category: mark.category,
      kind,
      forMissingLesson: false,
      quote: mark.quote ?? null,
      quoteTranslations: {},
      href: `/modules/${row.module_id}?country=${countryId}&kind=${kind}&version=${row.id}`,
    }));
  });
}
