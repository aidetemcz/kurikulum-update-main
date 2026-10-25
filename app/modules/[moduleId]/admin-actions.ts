"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/current-user";
import { translateNotes } from "@/lib/translate";
import { LOCALES, toLocale } from "@/lib/i18n";
import type { Mark } from "@/lib/types";

export type AdminSaveResult = { saved: true } | { error: string };

// Tichá oprava cizí nahrávky.
//
// Admin smí u zveřejněné verze posunout značku, přepsat poznámku i shrnutí,
// když je nesrozumitelné. Záměrně se přitom NIC nerozesílá: nevzniká nová
// verze, neodcházejí e-maily a stav "čeká" / "netýká se nás" u ostatních
// zemí zůstává přesně takový, jaký byl. Semafor se proto taky nerozsvítí
// znovu – řádky v annotation_country_status se nepřidávají ani nemění,
// takže stáří upozornění běží dál od původního zveřejnění.
//
// Aby se to dalo dohledat, každá úprava se zapíše do admin_edits.
// Ten záznam vidí jen admin, v appce se nikde nezobrazuje.
export async function adminSaveVersionEdits(
  versionId: string,
  marks: Mark[],
  summary: string
): Promise<AdminSaveResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("document_versions")
    .select("id, module_id, country_id, countries (locale)")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) return { error: "Verze nenalezena." };

  const { data: existing, error: readError } = await supabase
    .from("annotations")
    .select("*")
    .eq("document_version_id", versionId);

  if (readError) return { error: readError.message };

  const puvodni = new Map((existing ?? []).map((row) => [row.id, row]));
  const zaznamy: AdminEditRow[] = [];

  // Značky, které admin nakreslil teď, mají dočasné id začínající "new-".
  const nove = marks.filter((mark) => !puvodni.has(mark.id));
  const zmenene = marks.filter((mark) => {
    const stara = puvodni.get(mark.id);
    return stara && lisiSe(stara, mark);
  });
  const smazane = (existing ?? []).filter(
    (row) => !marks.some((mark) => mark.id === row.id)
  );

  // Nové značky se nikomu nerozesílají – řádek v annotation_country_status
  // k nim schválně nevzniká.
  if (nove.length > 0) {
    const { data: vlozene, error } = await supabase
      .from("annotations")
      .insert(
        nove.map((mark) => ({
          document_version_id: versionId,
          page: mark.page,
          x: mark.x,
          y: mark.y,
          w: mark.w,
          h: mark.h,
          note: mark.note,
          category: mark.category,
          quote: mark.quote ?? null,
        }))
      )
      .select();

    if (error) return { error: error.message };
    for (const row of vlozene ?? []) {
      zaznamy.push({ entity: "annotation", entity_id: row.id, action: "insert", before: null, after: row });
    }
  }

  for (const mark of zmenene) {
    const stara = puvodni.get(mark.id)!;
    const { data: upravena, error } = await supabase
      .from("annotations")
      .update({
        page: mark.page,
        x: mark.x,
        y: mark.y,
        w: mark.w,
        h: mark.h,
        note: mark.note,
        category: mark.category,
        quote: mark.quote ?? null,
      })
      .eq("id", mark.id)
      .select()
      .maybeSingle();

    if (error) return { error: error.message };
    zaznamy.push({ entity: "annotation", entity_id: mark.id, action: "update", before: stara, after: upravena });
  }

  if (smazane.length > 0) {
    const { error } = await supabase
      .from("annotations")
      .delete()
      .in("id", smazane.map((row) => row.id));

    if (error) return { error: error.message };
    for (const row of smazane) {
      zaznamy.push({ entity: "annotation", entity_id: row.id, action: "delete", before: row, after: null });
    }
  }

  // Celkové shrnutí verze.
  const { data: change } = await supabase
    .from("changes")
    .select("*")
    .eq("document_version_id", versionId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const shrnutiZmeneno = change ? change.note !== summary : summary.trim().length > 0;

  if (shrnutiZmeneno) {
    if (change) {
      const { data: upravene, error } = await supabase
        .from("changes")
        .update({ note: summary })
        .eq("id", change.id)
        .select()
        .maybeSingle();
      if (error) return { error: error.message };
      zaznamy.push({ entity: "change", entity_id: change.id, action: "update", before: change, after: upravene });
    } else {
      const { data: vlozene, error } = await supabase
        .from("changes")
        .insert({ document_version_id: versionId, note: summary, category: null })
        .select()
        .maybeSingle();
      if (error) return { error: error.message };
      zaznamy.push({ entity: "change", entity_id: vlozene?.id ?? null, action: "insert", before: null, after: vlozene });
    }
  }

  await zapisZaznam(supabase, admin.id, versionId, zaznamy);

  // Co admin přepsal, se přeloží znovu. Zase bez jakéhokoli upozornění.
  const kPrekladu = [...nove, ...zmenene].filter((mark) => mark.note.trim());
  if (kPrekladu.length > 0 || shrnutiZmeneno) {
    await prelozZnovu(supabase, versionId, one(version.countries)?.locale ?? null, summary, shrnutiZmeneno);
  }

  revalidatePath(`/modules/${version.module_id}`);
  return { saved: true };
}

// Úklid nepovedené nahrávky. Verze i její značky zmizí; stavy u ostatních
// zemí zmizí s nimi, protože na značkách visí.
export async function adminDeleteVersion(versionId: string): Promise<AdminSaveResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) return { error: "Verze nenalezena." };

  const { error } = await supabase.from("document_versions").delete().eq("id", versionId);
  if (error) return { error: error.message };

  await zapisZaznam(supabase, admin.id, null, [
    { entity: "version", entity_id: versionId, action: "delete", before: version, after: null },
  ]);

  revalidatePath(`/modules/${version.module_id}`);
  revalidatePath("/");
  return { saved: true };
}

type AdminEditRow = {
  entity: "annotation" | "change" | "version";
  entity_id: string | null;
  action: "insert" | "update" | "delete";
  before: unknown;
  after: unknown;
};

async function zapisZaznam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  versionId: string | null,
  zaznamy: AdminEditRow[]
) {
  if (zaznamy.length === 0) return;

  const { error } = await supabase.from("admin_edits").insert(
    zaznamy.map((zaznam) => ({
      admin_id: adminId,
      document_version_id: versionId,
      entity: zaznam.entity,
      entity_id: zaznam.entity_id,
      action: zaznam.action,
      before: zaznam.before,
      after: zaznam.after,
    }))
  );

  // Selhání záznamu nesmí shodit samotnou opravu, ale nesmí ani zapadnout.
  if (error) console.error("Záznam adminovy opravy se nepodařilo uložit:", error);
}

async function prelozZnovu(
  supabase: Awaited<ReturnType<typeof createClient>>,
  versionId: string,
  countryLocale: string | null,
  summary: string,
  shrnutiZmeneno: boolean
) {
  const sourceLocale = toLocale(countryLocale);

  const { data: annotations } = await supabase
    .from("annotations")
    .select("id, note, quote")
    .eq("document_version_id", versionId);

  const sShrnutim = shrnutiZmeneno && summary.trim().length > 0;
  const citace = (annotations ?? []).filter((row) => row.quote?.trim());
  const texty = [
    ...(annotations ?? []).map((row) => row.note),
    ...(sShrnutim ? [summary] : []),
    ...citace.map((row) => row.quote as string),
  ];
  if (texty.length === 0) return;

  const prelozene = await translateNotes(texty, sourceLocale, [...LOCALES]);

  for (const [index, row] of (annotations ?? []).entries()) {
    const vysledek = prelozene[index];
    if (!vysledek) continue;
    await supabase
      .from("annotations")
      .update({
        source_locale: vysledek.sourceLocale,
        translations: vysledek.translations,
        translation_failed: vysledek.failed,
      })
      .eq("id", row.id);
  }

  const prvniCitace = (annotations ?? []).length + (sShrnutim ? 1 : 0);
  for (const [index, row] of citace.entries()) {
    const vysledek = prelozene[prvniCitace + index];
    if (!vysledek) continue;
    await supabase
      .from("annotations")
      .update({ quote_translations: vysledek.translations })
      .eq("id", row.id);
  }

  const proShrnuti = sShrnutim ? prelozene[(annotations ?? []).length] : null;
  if (proShrnuti) {
    await supabase
      .from("changes")
      .update({
        source_locale: proShrnuti.sourceLocale,
        translations: proShrnuti.translations,
        translation_failed: proShrnuti.failed,
      })
      .eq("document_version_id", versionId);
  }
}

function lisiSe(stara: Record<string, unknown>, mark: Mark): boolean {
  return (
    stara.page !== mark.page ||
    !blizko(stara.x as number, mark.x) ||
    !blizko(stara.y as number, mark.y) ||
    !blizko(stara.w as number, mark.w) ||
    !blizko(stara.h as number, mark.h) ||
    stara.note !== mark.note ||
    (stara.category ?? null) !== (mark.category ?? null) ||
    (mark.quote !== undefined && (stara.quote ?? null) !== (mark.quote ?? null))
  );
}

// Souřadnice se v databázi ukládají jako real, takže se po cestě zaokrouhlí.
// Bez tolerance by se každé uložení tvářilo jako změna.
function blizko(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
