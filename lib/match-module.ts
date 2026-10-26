// Rozpoznání metodiky z nahrávaného PDF.
//
// Porovnává se text první strany dokumentu a název souboru z Google Drive
// s názvy metodik v katalogu. Bez ohledu na diakritiku, velikost písmen
// a čísla v názvu, s tolerancí překlepů.
import { normalize } from "@/lib/catalog";

export type MatchCandidate = {
  moduleId: string;
  name: string;
  score: number;
};

export type MatchResult =
  | { kind: "match"; best: MatchCandidate }
  | { kind: "choice"; candidates: MatchCandidate[] }
  | { kind: "none" };

// Od téhle shody metodiku předvyplníme…
const JISTA_SHODA = 0.75;
// …ale jen když je zřetelně napřed před druhou v pořadí.
const NASKOK = 0.12;
// Pod tímhle už nenabízíme nic, ať uživatele nemateme.
const STOJI_ZA_NABIDKU = 0.45;
// Kolik možností nabídnout, když si nejsme jistí.
const NABIDEK = 3;

// Názvy v jazyce země, za kterou se nahrává (a její vlastní název), mají
// mírnou přednost – ať při podobných názvech vyhraje ten správný jazyk.
const PREDNOST_JAZYKA = 1.05;

/** Lekce, jak ji vidí rozpoznávání. Vzniká jen v toMatchableModule(). */
export type MatchableModule = {
  id: string;
  /** Název, který se ukáže v nabídce (v jazyce nahrávající země). */
  name: string;
  /** Všechny známé názvy lekce: český, anglický, slovenský, maďarský
   *  a vlastní název nahrávající země. */
  names: string[];
  /** Ty z `names`, které jsou v jazyce nahrávající země (nebo její vlastní). */
  preferredNames: string[];
};

/** Co rozpoznávání potřebuje z řádku tabulky modules. */
type ModuleRow = {
  id: string;
  name: string;
  name_en: string | null;
  name_translations?: Record<string, string> | null;
};

// Jediné místo, kde se řádek z databáze mění na lekci pro rozpoznávání.
// Dřív se posílaly surové řádky (name_en) do typu, který čekal nameEn,
// a anglický název se tak k porovnání vůbec nedostal.
export function toMatchableModule(
  module: ModuleRow,
  /** Jazyk země, za kterou se nahrává. */
  locale: string,
  /** Vlastní název lekce v té zemi (lib/local-names.ts), pokud ho má. */
  localName: string | null
): MatchableModule {
  const preklady = module.name_translations ?? {};
  const vJazyce =
    locale === "cs" ? module.name : locale === "en" ? module.name_en : preklady[locale];

  const neprazdne = (nazvy: (string | null | undefined)[]) => [
    ...new Set(nazvy.map((nazev) => nazev?.trim() ?? "").filter(Boolean)),
  ];
  const preferredNames = neprazdne([localName, vJazyce]);

  return {
    id: module.id,
    name: preferredNames[0] ?? module.name,
    names: neprazdne([localName, module.name, module.name_en, ...Object.values(preklady)]),
    preferredNames,
  };
}

export function matchModule(
  modules: MatchableModule[],
  firstPageText: string,
  fileName: string
): MatchResult {
  const text = matchKey(firstPageText);
  const soubor = matchKey(stripExtension(fileName));

  const candidates = modules
    .map((module) => {
      const preferovane = new Set(module.preferredNames);
      // Skóre lekce = nejlepší shoda přes všechny její názvy.
      const score = Math.max(
        0,
        ...module.names.map((nazev) => {
          const skore = scoreName(matchKey(nazev), text, soubor);
          return preferovane.has(nazev) ? Math.min(1, skore * PREDNOST_JAZYKA) : skore;
        })
      );
      return { moduleId: module.id, name: module.name, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < STOJI_ZA_NABIDKU) return { kind: "none" };

  const druhy = candidates[1]?.score ?? 0;
  if (best.score >= JISTA_SHODA && best.score - druhy >= NASKOK) {
    return { kind: "match", best };
  }

  return {
    kind: "choice",
    candidates: candidates.filter((c) => c.score >= STOJI_ZA_NABIDKU).slice(0, NABIDEK),
  };
}

// Porovnávací tvar: bez diakritiky, bez čísel, bez interpunkce.
export function matchKey(value: string): string {
  return normalize(value)
    .replace(/[^a-z\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreName(nazev: string, text: string, soubor: string): number {
  if (!nazev) return 0;

  // Název stojí doslova v textu první strany – silnější důkaz už nebude.
  if (text.length > 0 && text.includes(nazev)) return 1;

  const zNazvuSouboru = soubor.length > 0 ? similarity(nazev, soubor) : 0;
  const zTextu = text.length > 0 ? coverage(nazev, text) : 0;

  return Math.max(zNazvuSouboru * 0.95, zTextu * 0.9);
}

// Kolik slov z názvu metodiky se vyskytuje v textu strany.
function coverage(nazev: string, text: string): number {
  const slova = tokens(nazev);
  if (slova.length === 0) return 0;

  const vTextu = new Set(tokens(text));
  const nalezeno = slova.filter(
    (slovo) => vTextu.has(slovo) || [...vTextu].some((jine) => similarity(slovo, jine) >= 0.85)
  );

  return nalezeno.length / slova.length;
}

// Krátká slova název neurčují, jen šumí.
function tokens(value: string): string[] {
  return value.split(" ").filter((slovo) => slovo.length >= 3);
}

// Podobnost dvou řetězců 0..1 podle editační vzdálenosti.
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const vzdalenost = levenshtein(a, b);
  return 1 - vzdalenost / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  // Stačí jeden řádek matice, předchozí hodnoty držíme v proměnných.
  let predchozi = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const aktualni = [i];
    for (let j = 1; j <= b.length; j++) {
      const cena = a[i - 1] === b[j - 1] ? 0 : 1;
      aktualni[j] = Math.min(
        aktualni[j - 1] + 1,
        predchozi[j] + 1,
        predchozi[j - 1] + cena
      );
    }
    predchozi = aktualni;
  }

  return predchozi[b.length];
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{1,5}$/i, "");
}
