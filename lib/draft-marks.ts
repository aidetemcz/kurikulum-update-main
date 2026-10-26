// Rámečky, jak je posílá prohlížeč, převedené na tvar pro databázi.
// Přichází zvenku (z formuláře nebo ze serverové akce), proto se nic
// nebere na víru: co nemá správný tvar, se zahodí.
import type { Mark } from "@/lib/types";

// Víc rámečků v jedné verzi rozumně nevznikne; strop chrání databázi.
const MAX_RAMECKU = 500;
const MAX_POZNAMKA = 5000;
const MAX_CITACE = 5000;

export type DraftMark = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  note: string;
  category: string | null;
  quote: string | null;
};

export function toDraftMarks(input: unknown): DraftMark[] {
  if (!Array.isArray(input)) return [];

  return input.slice(0, MAX_RAMECKU).flatMap((raw): DraftMark[] => {
    if (!raw || typeof raw !== "object") return [];
    const mark = raw as Partial<Mark>;
    const cisla = [mark.page, mark.x, mark.y, mark.w, mark.h];
    if (!cisla.every((cislo) => typeof cislo === "number" && Number.isFinite(cislo))) return [];
    if (typeof mark.note !== "string" || !mark.note.trim()) return [];

    return [
      {
        page: Math.max(0, Math.trunc(mark.page as number)),
        x: mark.x as number,
        y: mark.y as number,
        w: mark.w as number,
        h: mark.h as number,
        note: mark.note.slice(0, MAX_POZNAMKA),
        category: typeof mark.category === "string" ? mark.category : null,
        quote: typeof mark.quote === "string" ? mark.quote.slice(0, MAX_CITACE) : null,
      },
    ];
  });
}

/** Rámečky, které se opravdu uloží a zveřejní – jen ty s poznámkou. */
export function describedMarks<T extends { note: string }>(marks: T[]): T[] {
  return marks.filter((mark) => mark.note.trim().length > 0);
}
