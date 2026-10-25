import type { Dictionary } from "@/lib/i18n";

// Srozumitelná věta k důvodu, proč se návrh od AI nepovedl (viz lib/suggest.ts).
// Vrací null u důvodů, které nemá smysl ukazovat (prázdná poznámka apod.).
export function suggestFailureMessage(reason: string, t: Dictionary): string | null {
  if (reason === "missing_key") return t.aiMissingKey;
  if (reason === "bad_key") return t.aiBadKey;
  if (reason === "no_credit") return t.aiNoCredit;
  if (reason === "rate_limit") return t.aiRateLimit;
  if (reason === "empty" || reason === "forbidden") return null;
  if (reason.startsWith("api_")) return `${t.suggestFailed} (${reason})`;
  return t.suggestFailed;
}
