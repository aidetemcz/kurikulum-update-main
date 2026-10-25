// Návrhy, které appka nabídne při nahrávání verze: druh změny u značky
// a celkové shrnutí verze. Jsou to jen návrhy – editor je vidí předvyplněné
// a sám rozhoduje, co uloží.
//
// Když chybí ANTHROPIC_API_KEY nebo volání selže, vrací null a appka se
// chová jako dřív (nic se nepředvyplní).
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_KEYS } from "@/lib/annotations";

const MODEL = "claude-opus-5-5";

type CategoryKey = (typeof CATEGORY_KEYS)[number];

const POPIS_KATEGORII: Record<CategoryKey, string> = {
  content: "obsahová změna – mění se, co se učí nebo co metodika tvrdí",
  fix: "oprava chyby – překlep, špatný údaj, nefunkční odkaz",
  localization: "lokalizace – úprava pro jinou zemi, jazyk nebo školský systém",
  new: "nová část – přidané cvičení, aktivita, kapitola nebo materiál",
  formal: "formální úprava – vzhled, formátování, pořadí, bez změny obsahu",
};

async function zeptejSe(system: string, text: string, schema: Record<string, unknown>) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // Krátké a jednoduché rozhodnutí – stačí nejnižší úsilí.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema },
      },
      // Když bezpečnostní filtr požadavek odmítne, zkusí ho jiný model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: text }],
    });

    if (response.stop_reason === "refusal") return null;

    const vystup = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return JSON.parse(vystup) as Record<string, unknown>;
  } catch (chyba) {
    console.error("Návrh od AI se nepodařil:", chyba);
    return null;
  }
}

// Druh změny podle poznámky (a textu pod značkou, pokud je).
export async function suggestCategory(
  note: string,
  quote: string | null
): Promise<CategoryKey | null> {
  if (!note.trim()) return null;

  const vysledek = await zeptejSe(
    "Třídíš poznámky o změnách ve školních metodikách do jednoho z druhů změn:\n" +
      CATEGORY_KEYS.map((key) => `- ${key}: ${POPIS_KATEGORII[key]}`).join("\n") +
      "\nVyber jeden druh, který nejlépe sedí.",
    `Poznámka editora: ${note}` + (quote ? `\n\nText ve zvýrazněné části dokumentu: ${quote}` : ""),
    {
      type: "object",
      properties: { category: { type: "string", enum: [...CATEGORY_KEYS] } },
      required: ["category"],
      additionalProperties: false,
    }
  );

  const category = vysledek?.category;
  return CATEGORY_KEYS.includes(category as CategoryKey) ? (category as CategoryKey) : null;
}

// Celkové shrnutí verze z poznámek u jednotlivých značek.
export async function suggestSummary(
  notes: string[],
  language: string
): Promise<string | null> {
  const neprazdne = notes.map((note) => note.trim()).filter(Boolean);
  if (neprazdne.length === 0) return null;

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

  const summary = vysledek?.summary;
  return typeof summary === "string" && summary.trim() ? summary.trim() : null;
}
