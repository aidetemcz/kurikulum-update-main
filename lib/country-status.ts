// Změny, které přišly z jiných zemí, a semafor rozpracovanosti.
//
// Barva semaforu se nikam neukládá – počítá ji pohled module_country_light
// v databázi z data nejstarší nevyřešené změny (viz 0004_country_status.sql).
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getFollowed, follows } from "@/lib/followed";
import { getLocalNames } from "@/lib/local-names";
import { versionLabel } from "@/lib/version-label";
import { lightKey, toDocumentKind, type CountryLight, type PendingChange } from "@/lib/types";

// Tvar, v jakém řádky vrací PostgREST (vnořené tabulky jako objekt nebo pole).
type StatusRow = {
  id: string;
  created_at: string;
  dismissed_at: string | null;
  resolution?: "done" | "not_relevant" | null;
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
      version_label: string | null;
      published_at: string | null;
      uploaded_at: string | null;
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

  // Sloupec resolution přidává migrace 0017. Dokud neběžela, načte se
  // seznam bez něj – jinak by zmizely všechny změny.
  const nacti = (sloupce: string) =>
    supabase
      .from("annotation_country_status")
      .select(
        `${sloupce}
       annotations (
         id, page, note, category, source_locale, translations, translation_failed,
         quote, quote_translations,
         document_versions (
           module_id, kind, version_number, version_label, published_at, uploaded_at,
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

  let { data, error } = await nacti("id, created_at, dismissed_at, resolution,");
  if (error && ["42703", "PGRST204"].includes(error.code ?? "")) {
    ({ data, error } = await nacti("id, created_at, dismissed_at,"));
  }

  if (error || !data) return [];

  // Změny k metodikám, které země nesleduje, se neukazují (zůstávají ale
  // v databázi – kdyby je země zase začala sledovat, objeví se znovu).
  const [followed, vlastniNazvy, vlastni] = await Promise.all([
    getFollowed(countryId),
    getLocalNames(countryId),
    getOwnedKinds(countryId),
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
        resolution: row.resolution ?? null,
        publishedAt: version.published_at ?? version.uploaded_at,
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
        versionLabel: versionLabel(version),
        page: annotation.page,
        note: annotation.note,
        category: annotation.category,
        kind: toDocumentKind(version.kind),
        forMissingLesson: !vlastni.has(lightKey(version.module_id, toDocumentKind(version.kind))),
        quote: annotation.quote ?? null,
        quoteTranslations: annotation.quote_translations ?? {},
      },
    ];
  });
}

type LightRow = {
  module_id: string;
  kind: string | null;
  country_id: string;
  light: string;
  pending_count?: number | null;
};

// Ke kterým lekcím (a jakému druhu dokumentu) má země zveřejněnou vlastní
// verzi. Klíč dává lightKey(). Bez vlastní verze nemá co zapracovávat –
// semafor je šedý a změny od ostatních jsou jen „k dispozici“.
export const getOwnedKinds = cache(async (countryId: string): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_versions")
    .select("module_id, kind")
    .eq("country_id", countryId)
    .eq("status", "published");
  return new Set(
    (data ?? []).map((row) => lightKey(row.module_id, toDocumentKind(row.kind)))
  );
});

export type CountryLights = {
  /** Barva semaforu jen u lekcí, ke kterým má země vlastní verzi. Co v mapě
   *  není, je zelené (má verzi) nebo šedé (nemá). */
  lights: Record<string, CountryLight>;
  /** Kolik nevyřízených změn od ostatních čeká u lekcí, ke kterým země
   *  vlastní verzi nemá – jen pro informaci „k dispozici“. */
  availableWithoutVersion: Record<string, number>;
};

// Barva semaforu podle lekce a druhu dokumentu pro jednu zemi. Klíč dává
// lightKey().
export async function getLightsForCountry(countryId: string): Promise<CountryLights> {
  const supabase = await createClient();

  const [{ data }, followed, vlastni] = await Promise.all([
    supabase
      .from("module_country_light")
      .select("module_id, kind, country_id, light, pending_count")
      .eq("country_id", countryId),
    getFollowed(countryId),
    getOwnedKinds(countryId),
  ]);

  const lights: Record<string, CountryLight> = {};
  const availableWithoutVersion: Record<string, number> = {};
  for (const row of (data ?? []) as LightRow[]) {
    if (!follows(followed, row.module_id)) continue;
    const key = lightKey(row.module_id, toDocumentKind(row.kind));
    // Bez vlastní verze nesvítí žlutě ani červeně – není co zapracovat.
    if (vlastni.has(key)) lights[key] = toLight(row.light);
    else availableWithoutVersion[key] = Number(row.pending_count ?? 0);
  }
  return { lights, availableWithoutVersion };
}

export type MatrixCell = {
  light: CountryLight;
  /** Země lekci nesleduje – šedá, ale z jiného důvodu než „nemá verzi“. */
  notFollowed?: boolean;
};

// Matice modul × země pro administraci. Klíč je `${moduleId}:${countryId}`.
//
// Platí stejná pravidla jako u jedné země (getLightsForCountry): lekce, kterou
// země nesleduje, je šedá („nesleduje“); lekce, ke které země nemá žádnou
// verzi, je šedá („zatím bez verze“); jinak svítí horší barva z metodiky
// a prezentace, a to jen u druhu, ke kterému země verzi má.
export async function getLightMatrix(moduleIds: string[]): Promise<Record<string, MatrixCell>> {
  const supabase = await createClient();

  // Všechno jedním dotazem na tabulku – ne dotaz za každou zemi.
  const [{ data: zeme }, { data: sledovane }, { data: verze }, { data: svetla }] =
    await Promise.all([
      supabase.from("countries").select("id, modules_chosen_at"),
      supabase.from("country_modules").select("country_id, module_id"),
      supabase.from("document_versions").select("module_id, country_id, kind").eq("status", "published"),
      supabase.from("module_country_light").select("module_id, kind, country_id, light"),
    ]);

  // Dokud si země nevybrala (nebo chybí migrace 0015), sleduje všechno.
  const vybrala = new Set(
    (zeme ?? [])
      .filter((row) => "modules_chosen_at" in row && row.modules_chosen_at)
      .map((row) => row.id as string)
  );
  const sleduje = new Set((sledovane ?? []).map((row) => `${row.module_id}:${row.country_id}`));
  const vlastniDruh = new Set(
    (verze ?? []).map((row) => `${lightKey(row.module_id, toDocumentKind(row.kind))}:${row.country_id}`)
  );
  const maVerzi = new Set((verze ?? []).map((row) => `${row.module_id}:${row.country_id}`));

  // Matice má jedno políčko za lekci, takže svítí horší z obou barev.
  const barvy: Record<string, CountryLight> = {};
  for (const row of (svetla ?? []) as LightRow[]) {
    const druh = `${lightKey(row.module_id, toDocumentKind(row.kind))}:${row.country_id}`;
    if (!vlastniDruh.has(druh)) continue;
    const key = `${row.module_id}:${row.country_id}`;
    if (barvy[key] !== "red") barvy[key] = toLight(row.light);
  }

  const cells: Record<string, MatrixCell> = {};
  for (const countryId of (zeme ?? []).map((row) => row.id as string)) {
    for (const moduleId of moduleIds) {
      const key = `${moduleId}:${countryId}`;
      if (vybrala.has(countryId) && !sleduje.has(key)) {
        cells[key] = { light: "none", notFollowed: true };
      } else if (!maVerzi.has(key)) {
        cells[key] = { light: "none" };
      } else {
        cells[key] = { light: barvy[key] ?? "green" };
      }
    }
  }
  return cells;
}

function toLight(value: string): CountryLight {
  return value === "red" || value === "yellow" ? value : "green";
}

// Krátký popisek stavu pro tečky (lhůty jsou jen v legendě, viz LightLegend).
export { lightLabel } from "@/lib/light-label";
