// Překlad značky pro zemi, která si cizí změnu čte. Počítá se na serveru,
// aby kartička dostala rovnou hotový text a nemusela znát jazyk země.
import type { MarkTranslation } from "@/lib/types";

export function markTranslation(
  row: {
    source_locale?: string | null;
    translations?: Record<string, string> | null;
    quote_translations?: Record<string, string> | null;
  },
  locale: string
): MarkTranslation | null {
  // Vlastní poznámky se nepřekládají.
  if (!row.source_locale || row.source_locale === locale) return null;

  const note = row.translations?.[locale]?.trim() || null;
  const quote = row.quote_translations?.[locale]?.trim() || null;
  if (!note && !quote) return null;

  return { note, quote, fromLocale: row.source_locale };
}
