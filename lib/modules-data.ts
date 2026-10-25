// Načtení modulů pro danou zemi včetně nejnovější verze a jejích poznámek,
// pro zobrazení v mřížce karet na hlavní stránce.
import { markTranslation } from "@/lib/mark-translation";
import { createClient } from "@/lib/supabase/server";
import { getLocalNames } from "@/lib/local-names";
import { toDocumentKind, type Change, type Mark, type ModuleWithLatestVersion } from "@/lib/types";

export async function getModulesForCountry(
  countryId: string
): Promise<ModuleWithLatestVersion[]> {
  const supabase = await createClient();

  const { data: modules, error } = await supabase
    .from("modules")
    .select("*")
    .is("archived_at", null)
    .order("category")
    .order("order_index")
    .order("name");

  if (error || !modules) return [];

  const { data: versions } = await supabase
    .from("document_versions")
    .select("*, changes (*)")
    .eq("country_id", countryId)
    .eq("status", "published")
    .order("version_number", { ascending: false });

  const sChangesOdNejnovejsi = <T extends { changes: Change[] }>(version: T | undefined) =>
    version
      ? { ...version, changes: [...version.changes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) }
      : null;

  const vlastniNazvy = await getLocalNames(countryId);

  return modules.map((module) => {
    const moduleVersions = (versions ?? []).filter((v) => v.module_id === module.id);
    // Starší verze bez sloupce kind (před migrací 0012) jsou metodiky.
    const metodiky = moduleVersions.filter((v) => toDocumentKind(v.kind) === "teaching_material");
    const prezentace = moduleVersions.filter((v) => toDocumentKind(v.kind) === "presentation");

    return {
      ...module,
      local_name: vlastniNazvy.get(module.id) ?? null,
      latest_version: sChangesOdNejnovejsi(metodiky[0]),
      version_count: metodiky.length,
      latest_presentation: sChangesOdNejnovejsi(prezentace[0]),
      presentation_count: prezentace.length,
    };
  });
}

export async function getModuleDetail(moduleId: string, countryId: string, locale: string) {
  const supabase = await createClient();

  // Dotazy na sobě nezávisí, takže běží souběžně – každý je cesta do
  // databáze a zpátky.
  const [{ data: module }, { data: versions }, { data: unread }, vlastniNazvy] = await Promise.all([
    supabase.from("modules").select("*").eq("id", moduleId).single(),
    supabase
      .from("document_versions")
      .select("*, changes (*), users:uploaded_by (email)")
      .eq("module_id", moduleId)
      .eq("country_id", countryId)
      .eq("status", "published")
      .order("version_number", { ascending: false }),
    // Verze, u kterých má přihlášený uživatel nepřečtenou notifikaci, se
    // v záložkách označí tečkou.
    supabase.auth.getClaims().then(({ data }) =>
      supabase
        .from("notifications")
        .select("changes (document_version_id)")
        .eq("user_id", data?.claims?.sub ?? "")
        .is("read_at", null)
    ),
    getLocalNames(countryId),
  ]);

  const unreadVersionIds = new Set(
    (unread ?? []).flatMap((row) => {
      const change = Array.isArray(row.changes) ? row.changes[0] : row.changes;
      return change?.document_version_id ? [change.document_version_id] : [];
    })
  );

  // Označená místa v dokumentu, seskupená podle verze.
  const { data: annotations } = await supabase
    .from("annotations")
    .select("*")
    .in("document_version_id", (versions ?? []).map((v) => v.id));

  const marksByVersion: Record<string, Mark[]> = {};
  for (const annotation of annotations ?? []) {
    const mark: Mark = {
      id: annotation.id,
      page: annotation.page,
      x: annotation.x,
      y: annotation.y,
      w: annotation.w,
      h: annotation.h,
      note: annotation.note,
      category: annotation.category,
      quote: annotation.quote ?? null,
      translated: markTranslation(annotation, locale),
    };
    marksByVersion[annotation.document_version_id] = [
      ...(marksByVersion[annotation.document_version_id] ?? []),
      mark,
    ];
  }

  // file_url je hotový odkaz na náhled souboru v Google Drive, takže se
  // používá rovnou tak, jak je uložený.
  return {
    module: module ? { ...module, local_name: vlastniNazvy.get(module.id) ?? null } : module,
    versions: (versions ?? []).map((v) => {
      const uploader = Array.isArray(v.users) ? v.users[0] : v.users;
      return {
        ...v,
        kind: toDocumentKind(v.kind),
        changes: [...v.changes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        uploaded_by_email: uploader?.email ?? null,
        unread: unreadVersionIds.has(v.id),
      };
    }),
    marksByVersion,
  };
}
