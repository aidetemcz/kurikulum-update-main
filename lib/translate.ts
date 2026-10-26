// Překlad poznámek ke změnám do jazyků ostatních zemí.
//
// Metodiky samotné se nepřekládají – ty si každá země drží vlastní.
// Překládá se jen to, co jedna země napsala ostatním: popisy vyznačených
// změn a celkové shrnutí. Pár vět, proto stačí malý a rychlý model.
import Anthropic from "@anthropic-ai/sdk";
import { type Locale } from "@/lib/i18n";

// Nejlevnější a nejrychlejší z aktuálních modelů. Jde o krátké texty,
// na které větší model není potřeba.
const MODEL = "claude-haiku-4-5";

// Jak dlouho se na odpověď AI nejvýš čeká. Bez limitu by visící volání
// drželo celou serverovou funkci až do jejího vypršení.
const AI_TIMEOUT_MS = 20_000;

const JAZYKY: Record<Locale, string> = {
  cs: "čeština",
  sk: "slovenština",
  en: "angličtina",
  hu: "maďarština",
};

export type Translated = {
  /** Jazyk, ve kterém byl text napsaný. */
  sourceLocale: Locale;
  /** Překlady podle jazyka. Originální jazyk se nepřekládá. */
  translations: Record<string, string>;
  failed: boolean;
};

// Přeloží několik krátkých textů najednou do všech zadaných jazyků.
// Nikdy nevyhodí výjimku – když se překlad nepovede, vrátí failed a
// zveřejnění verze kvůli tomu nespadne.
export async function translateNotes(
  texts: string[],
  sourceLocale: Locale,
  targetLocales: Locale[]
): Promise<Translated[]> {
  const cile = targetLocales.filter((locale) => locale !== sourceLocale);
  const prazdne = texts.map(() => ({
    sourceLocale,
    translations: {} as Record<string, string>,
    failed: false,
  }));

  if (texts.length === 0 || cile.length === 0) return prazdne;
  if (!process.env.ANTHROPIC_API_KEY) {
    return prazdne.map((item) => ({ ...item, failed: true }));
  }

  try {
    const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system:
        "Překládáš krátké poznámky o změnách ve školních metodikách a úryvky textu " +
        "z těchto metodik. Úryvek může začínat nebo končit uprostřed věty – přelož ho tak, jak je. " +
        "Překládej věcně a stručně, zachovej odborné termíny. " +
        "Odpověz výhradně platným JSONem, bez jakéhokoli dalšího textu.",
      messages: [
        {
          role: "user",
          content:
            `Zdrojový jazyk: ${JAZYKY[sourceLocale]}.\n` +
            `Přelož každý text do těchto jazyků: ${cile
              .map((locale) => `${locale} (${JAZYKY[locale]})`)
              .join(", ")}.\n\n` +
            `Texty (pole JSON):\n${JSON.stringify(texts, null, 2)}\n\n` +
            "Odpověz polem JSON stejné délky a ve stejném pořadí. " +
            'Každá položka je objekt s klíči podle jazyků, například {"en": "…", "sk": "…"}.',
        },
      ],
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const parsed = parseJsonArray(text);
    if (!parsed || parsed.length !== texts.length) {
      return prazdne.map((item) => ({ ...item, failed: true }));
    }

    return parsed.map((polozka) => ({
      sourceLocale,
      translations: Object.fromEntries(
        cile.flatMap((locale) => {
          const hodnota = polozka?.[locale];
          return typeof hodnota === "string" && hodnota.trim()
            ? [[locale, hodnota.trim()]]
            : [];
        })
      ),
      failed: false,
    }));
  } catch (chyba) {
    console.error("Překlad poznámek se nepodařil:", chyba);
    return prazdne.map((item) => ({ ...item, failed: true }));
  }
}

// Model občas obalí JSON značkami ```json … ```, proto se hledá závorka.
function parseJsonArray(text: string): (Record<string, string> | null)[] | null {
  const zacatek = text.indexOf("[");
  const konec = text.lastIndexOf("]");
  if (zacatek < 0 || konec <= zacatek) return null;

  try {
    const hodnota = JSON.parse(text.slice(zacatek, konec + 1));
    return Array.isArray(hodnota) ? hodnota : null;
  } catch {
    return null;
  }
}
