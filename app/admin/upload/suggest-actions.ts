"use server";

// Návrhy od AI při nahrávání verze (viz lib/suggest.ts). Smí je volat jen
// ten, kdo smí nahrávat – jinak by šlo appku zneužít jako bránu k API.
import { requireUser, canUpload } from "@/lib/current-user";
import { suggestCategory, suggestSummary } from "@/lib/suggest";

const JAZYKY: Record<string, string> = {
  cs: "čeština",
  sk: "slovenština",
  en: "angličtina",
  hu: "maďarština",
};

export async function suggestMarkCategory(
  note: string,
  quote: string | null
): Promise<string | null> {
  const user = await requireUser();
  if (!canUpload(user)) return null;
  return suggestCategory(note.slice(0, 2000), quote ? quote.slice(0, 2000) : null);
}

export async function suggestVersionSummary(
  notes: string[],
  locale: string
): Promise<string | null> {
  const user = await requireUser();
  if (!canUpload(user)) return null;
  return suggestSummary(
    notes.slice(0, 50).map((note) => note.slice(0, 2000)),
    JAZYKY[locale] ?? JAZYKY.cs
  );
}
