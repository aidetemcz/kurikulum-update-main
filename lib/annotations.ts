import type { Dictionary } from "@/lib/i18n";
import type { Mark } from "@/lib/types";

// Kategorie ukládáme jako stálý klíč a překládáme až při zobrazení,
// aby značka dávala smysl ve všech jazycích.
export const CATEGORY_KEYS = ["content", "fix", "localization", "new", "formal"] as const;

export function categoryLabel(key: string | null, t: Dictionary): string | null {
  switch (key) {
    case "content":
      return t.catContent;
    case "fix":
      return t.catFix;
    case "localization":
      return t.catLocalization;
    case "new":
      return t.catNewPart;
    case "formal":
      return t.catFormal;
    default:
      return key; // starší kategorie psané volně rukou
  }
}

// Jedna značka může mít víc druhů změny. Ukládají se do jediného sloupce
// category: žádný = null, jeden = jeho klíč (jako dřív), víc = pole v JSONu.
// Starší značky s jedním druhem tak zůstávají, jak jsou.
export function parseCategories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const pole = JSON.parse(raw);
      if (Array.isArray(pole)) {
        return pole.filter((item): item is string => typeof item === "string" && item.trim() !== "");
      }
    } catch {
      // Ruční kategorie, která jen náhodou začíná hranatou závorkou.
    }
  }
  return [raw];
}

export function serializeCategories(list: string[]): string | null {
  const unikatni = [...new Set(list.map((item) => item.trim()).filter(Boolean))];
  if (unikatni.length === 0) return null;
  if (unikatni.length === 1) return unikatni[0];
  return JSON.stringify(unikatni);
}

/** Popisky všech druhů změny u značky v jazyce rozhraní. */
export function categoryLabels(raw: string | null | undefined, t: Dictionary): string[] {
  return parseCategories(raw).map((key) => categoryLabel(key, t) ?? key);
}

// Když autor shrnutí nenapsal, uloží se místo něj očíslované poznámky
// rámečků. Ty se ukazují zvlášť, takže by se shrnutí jen opakovalo.
export function isNotesOnlySummary(summary: string, sorted: Mark[]): boolean {
  return (
    sorted.length > 0 &&
    summary.trim() === sorted.map((mark, index) => `${index + 1}. ${mark.note}`).join("\n").trim()
  );
}

// Pořadí čtení: stránka, pak shora dolů, pak zleva doprava.
export function sortMarks(marks: Mark[]): Mark[] {
  return [...marks].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

export function numberMarks(marks: Mark[]): Record<string, number> {
  const numbers: Record<string, number> = {};
  sortMarks(marks).forEach((mark, index) => {
    numbers[mark.id] = index + 1;
  });
  return numbers;
}
