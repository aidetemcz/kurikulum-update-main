// Dopřeložení poznámek, které se při zveřejnění přeložit nepovedlo
// (třeba když ve Vercelu ještě nebyl klíč pro AI). Běží samo na pozadí
// po načtení stránky, takže se staré změny dorovnají bez zásahu.
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { translateNotes } from "@/lib/translate";
import { LOCALES, toLocale } from "@/lib/i18n";

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

type Radek = {
  id: string;
  note: string;
  document_version_id: string;
  translations: Record<string, string> | null;
  translation_failed: boolean | null;
};

// Nepřeložené je to, co při překladu selhalo, nebo nemá překlad žádný.
function chybiPreklad(radek: Radek): boolean {
  if (!radek.note?.trim()) return false;
  return Boolean(radek.translation_failed) || Object.keys(radek.translations ?? {}).length === 0;
}

export async function translateMissing() {
  const supabase = createAdminClient();

  const [{ data: znacky }, { data: zmeny }] = await Promise.all([
    supabase
      .from("annotations")
      .select("id, note, quote, document_version_id, translations, translation_failed")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("changes")
      .select("id, note, document_version_id, translations, translation_failed")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const chybejiciZnacky = ((znacky ?? []) as (Radek & { quote: string | null })[]).filter(chybiPreklad);
  const chybejiciZmeny = ((zmeny ?? []) as Radek[]).filter(chybiPreklad);

  const verze = [
    ...new Set([...chybejiciZnacky, ...chybejiciZmeny].map((radek) => radek.document_version_id)),
  ].slice(0, 100);
  if (verze.length === 0) return;

  // Jazyk originálu = jazyk země, která verzi nahrála. Překládají se jen
  // zveřejněné verze – rozpracované stejně nikdo jiný nevidí.
  const { data: verzeSeZemi } = await supabase
    .from("document_versions")
    .select("id, countries (locale)")
    .in("id", verze)
    .eq("status", "published")
    .limit(VERZI_NAJEDNOU);

  for (const radekVerze of verzeSeZemi ?? []) {
    const zeme = Array.isArray(radekVerze.countries) ? radekVerze.countries[0] : radekVerze.countries;
    const sourceLocale = toLocale(zeme?.locale);

    const poznamky = chybejiciZnacky.filter((radek) => radek.document_version_id === radekVerze.id);
    const shrnuti = chybejiciZmeny.filter((radek) => radek.document_version_id === radekVerze.id);
    const citace = poznamky.filter((radek) => radek.quote?.trim());

    const texty = [
      ...poznamky.map((radek) => radek.note),
      ...shrnuti.map((radek) => radek.note),
      ...citace.map((radek) => radek.quote as string),
    ];
    const prelozene = await translateNotes(texty, sourceLocale, [...LOCALES]);
    // Když se to nepovedlo ani teď, nic se nepřepisuje a zkusí se to příště.
    if (prelozene.every((vysledek) => vysledek.failed)) continue;

    for (const [index, radek] of poznamky.entries()) {
      const vysledek = prelozene[index];
      if (!vysledek || vysledek.failed) continue;
      await supabase
        .from("annotations")
        .update({
          source_locale: vysledek.sourceLocale,
          translations: vysledek.translations,
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
          translations: vysledek.translations,
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
        .update({ quote_translations: vysledek.translations })
        .eq("id", radek.id);
    }
  }
}
