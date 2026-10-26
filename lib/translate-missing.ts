// Dopřeložení poznámek, které se při zveřejnění přeložit nepovedlo
// (třeba když ve Vercelu ještě nebyl klíč pro AI). Běží samo na pozadí
// po načtení stránky, takže se staré změny dorovnají bez zásahu.
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { translateNotes } from "@/lib/translate";
import { LOCALES, toLocale, type Locale } from "@/lib/i18n";

// Jeden server se o dopřeklad pokusí nejvýš jednou za pět minut – ať se
// při rozbitém klíči neptá AI při každém kliknutí.
const PAUZA_MS = 5 * 60 * 1000;
// Kolik verzí se přeloží na jeden zátah. Zbytek přijde na řadu příště.
const VERZI_NAJEDNOU = 5;

let posledniPokus = 0;

export function translateMissingLater() {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (Date.now() - posledniPokus < PAUZA_MS) return;
  posledniPokus = Date.now();

  after(async () => {
    try {
      await translateMissing();
    } catch (chyba) {
      console.error("Dopřeložení poznámek se nepodařilo:", chyba);
    }
  });
}

type Verze = { status: string; country_id: string };

type Znacka = {
  id: string;
  note: string;
  quote: string | null;
  document_version_id: string;
  translations: Record<string, string> | null;
  translation_failed: boolean | null;
  quote_translations: Record<string, string> | null;
  annotation_country_status: { country_id: string }[] | null;
  document_versions: Verze | Verze[] | null;
};

type Shrnuti = {
  id: string;
  note: string;
  document_version_id: string;
  translations: Record<string, string> | null;
  translation_failed: boolean | null;
  document_versions: Verze | Verze[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Které jazyky v překladech chybí. Za chybějící se bere každý jazyk zemí,
// kterým změna přišla (a vždy angličtina), který v překladech není – ne
// jen úplné selhání. Jazyk originálu se nepřekládá.
function chybiPreklad(
  text: string | null,
  preklady: Record<string, string> | null,
  ocekavane: Set<Locale>
): Locale[] {
  if (!text?.trim()) return [];
  return [...ocekavane].filter((locale) => !preklady?.[locale]?.trim());
}

export async function translateMissing() {
  const supabase = createAdminClient();

  const [{ data: zeme }, { data: znacky }, { data: zmeny }] = await Promise.all([
    supabase.from("countries").select("id, locale"),
    supabase
      .from("annotations")
      .select(
        `id, note, quote, document_version_id, translations, translation_failed, quote_translations,
         annotation_country_status (country_id),
         document_versions!inner (status, country_id)`
      )
      .eq("document_versions.status", "published")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("changes")
      .select(
        `id, note, document_version_id, translations, translation_failed,
         document_versions!inner (status, country_id)`
      )
      .eq("document_versions.status", "published")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const jazykZeme = new Map((zeme ?? []).map((row) => [row.id, toLocale(row.locale)]));
  const radkyZnacek = (znacky ?? []) as unknown as Znacka[];
  const radkyZmen = (zmeny ?? []) as unknown as Shrnuti[];

  // Jazyk originálu = jazyk země, která verzi nahrála. Cílové jazyky =
  // jazyky zemí, kterým rámečky verze přišly, a angličtina.
  const zdroj = new Map<string, Locale>();
  const cileVerze = new Map<string, Set<Locale>>();
  const cileZnacky = new Map<string, Set<Locale>>();
  for (const znacka of radkyZnacek) {
    const verze = one(znacka.document_versions);
    const source = toLocale(jazykZeme.get(verze?.country_id ?? ""));
    zdroj.set(znacka.document_version_id, source);

    const cile = new Set<Locale>(["en"]);
    for (const stav of znacka.annotation_country_status ?? []) {
      const locale = jazykZeme.get(stav.country_id);
      if (locale) cile.add(locale);
    }
    cile.delete(source);
    cileZnacky.set(znacka.id, cile);

    const proVerzi = cileVerze.get(znacka.document_version_id) ?? new Set<Locale>();
    cile.forEach((locale) => proVerzi.add(locale));
    cileVerze.set(znacka.document_version_id, proVerzi);
  }
  for (const zmena of radkyZmen) {
    if (zdroj.has(zmena.document_version_id)) continue;
    const verze = one(zmena.document_versions);
    const source = toLocale(jazykZeme.get(verze?.country_id ?? ""));
    zdroj.set(zmena.document_version_id, source);
    cileVerze.set(zmena.document_version_id, new Set<Locale>(LOCALES.filter((l) => l !== source)));
  }

  const ocekavaneProZnacku = (znacka: Znacka) => cileZnacky.get(znacka.id) ?? new Set<Locale>();
  const ocekavaneProZmenu = (zmena: Shrnuti) =>
    cileVerze.get(zmena.document_version_id) ?? new Set<Locale>();

  const chybejiciZnacky = radkyZnacek.filter(
    (znacka) =>
      chybiPreklad(znacka.note, znacka.translations, ocekavaneProZnacku(znacka)).length > 0 ||
      chybiPreklad(znacka.quote, znacka.quote_translations, ocekavaneProZnacku(znacka)).length > 0
  );
  const chybejiciZmeny = radkyZmen.filter(
    (zmena) => chybiPreklad(zmena.note, zmena.translations, ocekavaneProZmenu(zmena)).length > 0
  );

  const verze = [
    ...new Set([...chybejiciZnacky, ...chybejiciZmeny].map((radek) => radek.document_version_id)),
  ].slice(0, VERZI_NAJEDNOU);

  for (const versionId of verze) {
    const sourceLocale = zdroj.get(versionId) ?? "cs";
    const cile = [...(cileVerze.get(versionId) ?? new Set<Locale>())];
    if (cile.length === 0) continue;

    const poznamky = chybejiciZnacky.filter((radek) => radek.document_version_id === versionId);
    const shrnuti = chybejiciZmeny.filter((radek) => radek.document_version_id === versionId);
    const citace = poznamky.filter((radek) => radek.quote?.trim());

    const texty = [
      ...poznamky.map((radek) => radek.note),
      ...shrnuti.map((radek) => radek.note),
      ...citace.map((radek) => radek.quote as string),
    ];
    const prelozene = await translateNotes(texty, sourceLocale, cile);
    // Když se to nepovedlo ani teď, nic se nepřepisuje a zkusí se to příště.
    if (prelozene.every((vysledek) => vysledek.failed)) continue;

    // Nové překlady se přidávají k těm, které už jsou – nic se neztratí.
    for (const [index, radek] of poznamky.entries()) {
      const vysledek = prelozene[index];
      if (!vysledek || vysledek.failed) continue;
      await supabase
        .from("annotations")
        .update({
          source_locale: vysledek.sourceLocale,
          translations: { ...(radek.translations ?? {}), ...vysledek.translations },
          translation_failed: false,
        })
        .eq("id", radek.id);
    }

    for (const [index, radek] of shrnuti.entries()) {
      const vysledek = prelozene[poznamky.length + index];
      if (!vysledek || vysledek.failed) continue;
      await supabase
        .from("changes")
        .update({
          source_locale: vysledek.sourceLocale,
          translations: { ...(radek.translations ?? {}), ...vysledek.translations },
          translation_failed: false,
        })
        .eq("id", radek.id);
    }

    const prvniCitace = poznamky.length + shrnuti.length;
    for (const [index, radek] of citace.entries()) {
      const vysledek = prelozene[prvniCitace + index];
      if (!vysledek || vysledek.failed) continue;
      await supabase
        .from("annotations")
        .update({
          quote_translations: { ...(radek.quote_translations ?? {}), ...vysledek.translations },
        })
        .eq("id", radek.id);
    }
  }
}
