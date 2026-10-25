import type { Dictionary } from "@/lib/i18n";

// Co ukázat editorovi, když se návrh od AI nepovedl. Záměrně obecně –
// nastavení klíče a kreditu partnery z jiných zemí nezajímá. Konkrétní
// důvod se zapisuje do logů ve Vercelu (viz lib/suggest.ts).
export function suggestFailureMessage(reason: string, t: Dictionary): string | null {
  if (reason === "empty" || reason === "forbidden") return null;
  return t.suggestFailed;
}
