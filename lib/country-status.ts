// Změny, které přišly z jiných zemí, a semafor rozpracovanosti.
//
// Barva semaforu se nikam neukládá – počítá ji pohled module_country_light
// v databázi z data nejstarší nevyřešené změny (viz 0004_country_status.sql).
import { createClient } from "@/lib/supabase/server";
import { getFollowed, follows } from "@/lib/followed";
import { getLocalNames } from "@/lib/local-names";
import { lightKey, toDocumentKind, type CountryLight, type PendingChange } from "@/lib/types";

// Tvar, v jakém řádky vrací PostgREST (vnořené tabulky jako objekt nebo pole).
type StatusRow = {
  id: string;
  created_at: string;
  dismissed_at: string | null;
  annotations: {
    id: string;
    page: number;
    note: string;
    category: string | null;
    source_locale: string | null;
    translations: Record<string, string> | null;
    translation_failed: boolean | null;
    quote: string | null;
    quote_translations: Record<string, string> | null;
    document_versions: {
      module_id: string;
      kind: string | null;
      version_number: number | null;
      published_at: string | null;
      users: { email: string } | { email: string }[] | null;
      modules: ModuleNames | ModuleNames[] | null;
      countries: { name: string } | { name: string }[] | null;
    } | null;
  } | null;
};

type ModuleNames = {
  name: string;
  name_en: string | null;
  name_translations: Record<string, string> | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// Změny z ostatních zemí pro danou zemi.
// "pending" = nevyřízené, od nejstarší (ty nejvíc hoří jsou nahoře).
// "dismissed" = skryté, od naposledy skryté.
export async function getChanges(
  countryId: string,
  status: "pending" | "dismissed" = "pending"
): Promise<PendingChange[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("annotation_country_status")
    .select(
      `id, created_at, dismissed_at,
       annotations (
         id, page, note, category, source_locale, translations, translation_failed,
         quote, quote_translations,
         document_versions (
           module_id, kind, version_number, published_at,
           users:uploaded_by (email),
           modules (*),
           countries (name)
         )
       )`
    )
    .eq("country_id", countryId)
    .eq("status", status)
    .order(status === "pending" ? "created_at" : "dismissed_at", {
      ascending: status === "pending",
    });

  if (error || !data) return [];

  // Změny k metodikám, které země nesleduje, se neukazují (zůstávají ale
  // v databázi – kdyby je země zase začala sledovat, objeví se znovu).
  const [followed, vlastniNazvy] = await Promise.all([
    getFollowed(countryId),
    getLocalNames(countryId),
  ]);

  return (data as unknown as StatusRow[]).flatMap((row) => {
    const annotation = one(row.annotations);
    const version = one(annotation?.document_versions ?? null);
    if (!annotation || !version) return [];
    if (!follows(followed, version.module_id)) return [];

    return [
      {
        id: row.id,
        annotationId: annotation.id,
        createdAt: row.created_at,
        dismissedAt: row.dismissed_at,
        publishedAt: version.published_at,
        sourceLocale: annotation.source_locale,
        translations: annotation.translations ?? {},
        translationFailed: annotation.translation_failed ?? false,
        moduleId: version.module_id,
        moduleName: one(version.modules)?.name ?? "",
        moduleNames: {
          name: one(version.modules)?.name ?? "",
          name_en: one(version.modules)?.name_en ?? null,
          name_translations: one(version.modules)?.name_translations ?? null,
          local_name: vlastniNazvy.get(version.module_id) ?? null,
        },
        fromCountryName: one(version.countries)?.name ?? "",
        uploadedByEmail: one(version.users)?.email ?? null,
        versionNumber: version.version_number,
        page: annotation.page,
        note: annotation.note,
        category: annotation.category,
        kind: toDocumentKind(version.kind),
        quote: annotation.quote ?? null,
        quoteTranslations: annotation.quote_translations ?? {},
      },
    ];
  });
}

type LightRow = { module_id: string; kind: string | null; country_id: string; light: string };

// Barva semaforu podle lekce a druhu dokumentu pro jednu zemi. Klíč dává
// lightKey(). Co v mapě není, je zelené.
export async function getLightsForCountry(
  countryId: string
): Promise<Record<string, CountryLight>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("module_country_light")
    .select("module_id, kind, country_id, light")
    .eq("country_id", countryId);

  const followed = await getFollowed(countryId);
  const lights: Record<string, CountryLight> = {};
  for (const row of (data ?? []) as LightRow[]) {
    if (!follows(followed, row.module_id)) continue;
    lights[lightKey(row.module_id, toDocumentKind(row.kind))] = toLight(row.light);
  }
  return lights;
}

// Matice modul × země pro administraci. Klíč je `${moduleId}:${countryId}`.
export async function getLightMatrix(): Promise<Record<string, CountryLight>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("module_country_light")
    .select("module_id, kind, country_id, light");

  // Matice má jedno políčko za lekci, takže svítí horší z obou barev.
  const lights: Record<string, CountryLight> = {};
  for (const row of (data ?? []) as LightRow[]) {
    const key = `${row.module_id}:${row.country_id}`;
    const light = toLight(row.light);
    if (lights[key] !== "red") lights[key] = light;
  }
  return lights;
}

function toLight(value: string): CountryLight {
  return value === "red" || value === "yellow" ? value : "green";
}

export function lightLabel(
  light: CountryLight,
  t: { lightNone: string; lightOk: string; lightWaiting: string; lightAct: string }
): string {
  if (light === "red") return t.lightAct;
  if (light === "yellow") return t.lightWaiting;
  if (light === "none") return t.lightNone;
  return t.lightOk;
}
