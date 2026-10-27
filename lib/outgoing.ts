// Odchozí změny: verze, které zobrazená země sama zveřejnila, i s rámečky.
// Protějšek přehledu Příchozí změny – ať jde rychle najít, co a kdy země
// ostatním poslala.
import { createClient } from "@/lib/supabase/server";
import { getLocalNames } from "@/lib/local-names";
import { versionLabel } from "@/lib/version-label";
import { isNotesOnlySummary, sortMarks } from "@/lib/annotations";
import type { NamedModule } from "@/lib/module-name";
import { toDocumentKind, versionDate, type DocumentKind, type Mark } from "@/lib/types";

export type OutgoingVersion = {
  id: string;
  moduleId: string;
  module: NamedModule;
  kind: DocumentKind;
  versionLabel: string;
  publishedAt: string;
  authorEmail: string | null;
  /** Shrnutí, jen když ho autor opravdu napsal. */
  summary: string | null;
  /** V pořadí čtení. */
  marks: Mark[];
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
  modules: NamedModule | NamedModule[] | null;
  annotations: Mark[] | null;
  changes: { note: string; created_at: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/** Posledních 50 zveřejněných verzí země, od nejnovější. */
export async function getOutgoing(
  countryId: string,
  /** Jen verze, které nahrál tenhle uživatel. */
  authorId: string | null
): Promise<OutgoingVersion[]> {
  const supabase = await createClient();
  let dotaz = supabase
    .from("document_versions")
    .select(
      `id, module_id, kind, version_number, version_label, published_at, uploaded_at,
       users:uploaded_by (email),
       modules (name, name_en, name_translations),
       annotations (*),
       changes (note, created_at)`
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

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const marks = sortMarks(row.annotations ?? []);
    const shrnuti =
      [...(row.changes ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.note ?? "";
    const modul = one(row.modules) ?? { name: "" };
    return {
      id: row.id,
      moduleId: row.module_id,
      module: { ...modul, local_name: vlastniNazvy.get(row.module_id) ?? null },
      kind: toDocumentKind(row.kind),
      versionLabel: versionLabel(row),
      publishedAt: versionDate(row),
      authorEmail: one(row.users)?.email ?? null,
      summary: shrnuti.trim() && !isNotesOnlySummary(shrnuti, marks) ? shrnuti : null,
      marks,
    };
  });
}
