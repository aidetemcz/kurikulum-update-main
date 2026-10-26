// Návrhy, které appka nabídne při nahrávání verze: druh změny u značky
// a celkové shrnutí verze. Jsou to jen návrhy – editor je vidí předvyplněné
// a sám rozhoduje, co uloží.
//
// Když chybí ANTHROPIC_API_KEY nebo volání selže, vrací null a appka se
// chová jako dřív (nic se nepředvyplní).
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_KEYS } from "@/lib/annotations";

const MODEL = "claude-opus-5-5";

// Jak dlouho se na odpověď AI nejvýš čeká. Bez limitu by visící volání
// drželo celou serverovou funkci až do jejího vypršení.
const AI_TIMEOUT_MS = 20_000;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

const POPIS_KATEGORII: Record<CategoryKey, string> = {
  content: "obsahová změna – mění se, co se učí nebo co metodika tvrdí",
  fix: "oprava chyby – překlep, špatný údaj, nefunkční odkaz",
  localization: "lokalizace – úprava pro jinou zemi, jazyk nebo školský systém",
  new: "nová část – přidané cvičení, aktivita, kapitola nebo materiál",
  formal: "formální úprava – vzhled, formátování, pořadí, bez změny obsahu",
};

/** Výsledek návrhu. Když se nepovede, reason je krátký kód důvodu (bez textu
 *  chyby) – editor dostane obecnou hlášku, detail je v logu ve Vercelu. */
export type SuggestResult<T> = { value: T } | { value: null; reason: string };

async function zeptejSe(
  system: string,
  text: string,
  schema: Record<string, unknown>
): Promise<SuggestResult<Record<string, unknown>>> {
  if (!process.env.ANTHROPIC_API_KEY) return { value: null, reason: "missing_key" };

  try {
    const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // Krátké a jednoduché rozhodnutí – stačí nejnižší úsilí.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema },
      },
      system,
      messages: [{ role: "user", content: text }],
    });

    if (response.stop_reason === "refusal") return { value: null, reason: "refusal" };

    const vystup = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return { value: JSON.parse(vystup) as Record<string, unknown> };
  } catch (chyba) {
    console.error("Návrh od AI se nepodařil:", chyba);
    if (chyba instanceof Anthropic.AuthenticationError) return { value: null, reason: "bad_key" };
    if (chyba instanceof Anthropic.PermissionDeniedError) return { value: null, reason: "bad_key" };
    if (chyba instanceof Anthropic.RateLimitError) return { value: null, reason: "rate_limit" };
    if (chyba instanceof Anthropic.APIError) {
      // Došlý kredit vrací API jako 400 se zmínkou o „credit balance“.
      const zprava = String(chyba.message ?? "");
      if (/credit/i.test(zprava)) return { value: null, reason: "no_credit" };
      // Do prohlížeče jde jen kód důvodu, text chyby zůstává v logu.
      return { value: null, reason: `api_${chyba.status ?? "error"}` };
    }
    return { value: null, reason: "network" };
  }
}

// Druhy změny podle poznámky (a textu pod značkou, pokud je). Obvykle
// jeden, víc jen tehdy, když poznámka opravdu popisuje víc věcí.
export async function suggestCategory(
  note: string,
  quote: string | null
): Promise<SuggestResult<CategoryKey[]>> {
  if (!note.trim()) return { value: null, reason: "empty" };

  const vysledek = await zeptejSe(
    "Třídíš poznámky o změnách ve školních metodikách podle druhu změny:\n" +
      CATEGORY_KEYS.map((key) => `- ${key}: ${POPIS_KATEGORII[key]}`).join("\n") +
      "\nVyber druh, který nejlépe sedí. Víc druhů (nejvýš tři) vyber jen tehdy, " +
      "když poznámka zjevně popisuje víc různých změn.",
    `Poznámka editora: ${note}` + (quote ? `\n\nText ve zvýrazněné části dokumentu: ${quote}` : ""),
    {
      type: "object",
      properties: {
        categories: { type: "array", items: { type: "string", enum: [...CATEGORY_KEYS] } },
      },
      required: ["categories"],
      additionalProperties: false,
    }
  );
  if (vysledek.value === null) return vysledek;

  const pole = Array.isArray(vysledek.value.categories) ? vysledek.value.categories : [];
  const platne = [...new Set(pole)]
    .filter((key): key is CategoryKey => CATEGORY_KEYS.includes(key as CategoryKey))
    .slice(0, 3);
  return platne.length > 0 ? { value: platne } : { value: null, reason: "unexpected_answer" };
}

// Celkové shrnutí verze z poznámek u jednotlivých značek.
export async function suggestSummary(
  notes: string[],
  language: string
): Promise<SuggestResult<string>> {
  const neprazdne = notes.map((note) => note.trim()).filter(Boolean);
  if (neprazdne.length === 0) return { value: null, reason: "empty" };

  const vysledek = await zeptejSe(
    "Píšeš krátké shrnutí nové verze školní metodiky pro učitele a partnery z jiných zemí. " +
      "Shrň poznámky editora do jedné až tří vět: co se v této verzi změnilo. " +
      "Piš věcně, bez úvodních frází, nic si nevymýšlej a nepřidávej, co v poznámkách není. " +
      `Piš jazykem: ${language}.`,
    `Poznámky ke změnám:\n${neprazdne.map((note, index) => `${index + 1}. ${note}`).join("\n")}`,
    {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
      additionalProperties: false,
    }
  );
  if (vysledek.value === null) return vysledek;

  const summary = vysledek.value.summary;
  return typeof summary === "string" && summary.trim()
    ? { value: summary.trim() }
    : { value: null, reason: "unexpected_answer" };
}
