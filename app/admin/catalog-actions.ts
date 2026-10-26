"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { CATALOG_URL, fetchCatalog, type CatalogItem } from "@/lib/catalog";
import { fetchEnglishNames } from "@/lib/catalog-en";
import { buildPlan, type ImportPlan, type ModuleRow } from "@/lib/catalog-plan";

// Co admin viděl v náhledu: plán i položky z webu, ze kterých vznikl.
// Zapisuje se přesně tohle – katalog se při zápisu znovu nestahuje.
export type CatalogPreview = {
  plan: ImportPlan;
  items: CatalogItem[];
  /** Anglické názvy z webu jako dvojice [slug české metodiky, název]. */
  english: [string, string][];
};

export type PlanResult = { preview: CatalogPreview } | { error: string };
export type ApplyResult =
  | {
      added: number;
      renamed: number;
      linked: number;
      recategorized: number;
      unarchived: number;
      english: number;
      archived: number;
    }
  | { error: string };

// Kolik metodik smí import archivovat bez výslovného potvrzení.
const ARCHIV_BEZ_POTVRZENI = 5;

// Co import udělá, ještě než něco zapíše.
export async function previewCatalogImport(): Promise<PlanResult> {
  const admin = await requireAdmin();
  const { t } = await resolveActiveCountry(admin);

  try {
    const [katalog, modules, anglicke] = await Promise.all([
      fetchCatalog(),
      loadModules(),
      fetchEnglishNames(),
    ]);
    // Prázdná nebo chybová stránka webu by jinak archivovala všechno.
    if (katalog.items.length === 0) return { error: t.catalogEmpty };

    return {
      preview: {
        plan: buildPlan(
          katalog.items,
          modules,
          [...katalog.warnings, ...anglicke.warnings],
          anglicke.names
        ),
        items: katalog.items,
        english: [...anglicke.names.entries()],
      },
    };
  } catch (chyba) {
    return { error: popisChyby(chyba) };
  }
}

// Zápis přesně toho plánu, který admin viděl v náhledu. Dřív se katalog
// stahoval znovu a plán přepočítal – výpadek webu mezi náhledem a zápisem
// tak mohl archivovat všechny lekce.
export async function applyCatalogImport(
  preview: CatalogPreview,
  confirmArchive = false
): Promise<ApplyResult> {
  const admin = await requireAdmin();
  const { t } = await resolveActiveCountry(admin);

  const plan = preview?.plan;
  const items = Array.isArray(preview?.items) ? preview.items : [];
  if (!plan || items.length === 0) return { error: t.catalogEmpty };
  if (plan.toArchive.length > ARCHIV_BEZ_POTVRZENI && !confirmArchive) {
    return { error: t.catalogArchiveNeedsConfirm };
  }
  const anglickeNazvy = new Map(Array.isArray(preview.english) ? preview.english : []);

  const supabase = await createClient();
  const podleSlugu = new Map(items.map((item) => [item.slug, item]));

  if (plan.toAdd.length > 0) {
    const rows = plan.toAdd.flatMap((add) => {
      const item = podleSlugu.get(add.slug);
      return item ? [radekZPolozky(item)] : [];
    });

    const { error } = await supabase.from("modules").insert(rows);
    if (error) return { error: error.message };
  }

  // Všechno, co se s webem spárovalo, se podle něj srovná naráz: název,
  // sekce, odkaz, pořadí i anglický název. Dřív se sáhlo jen na metodiky
  // s jiným názvem, takže přesunutá sekce v databázi zůstala stará.
  const kUprave = new Map<string, string>();
  for (const r of plan.toRename) kUprave.set(r.slug, r.id);
  for (const l of plan.toLink) kUprave.set(l.slug, l.id);
  for (const r of plan.toRecategorize) kUprave.set(r.slug, r.id);
  for (const e of plan.toSetEnglish) kUprave.set(e.slug, e.id);
  for (const u of plan.toUnarchive) kUprave.set(u.slug, u.id);

  for (const [slug, id] of kUprave) {
    const item = podleSlugu.get(slug);
    if (!item) continue;

    const anglicky = anglickeNazvy.get(item.slug);
    const { error } = await supabase
      .from("modules")
      .update({
        ...radekZPolozky(item),
        // Anglický název se přepisuje jen tehdy, když ho web má. Když ne,
        // zůstane, co je uložené – nikdy se nemaže ani nepřekládá.
        ...(anglicky ? { name_en: anglicky } : {}),
        archived_at: null,
      })
      .eq("id", id);
    if (error) return { error: error.message };
  }

  if (plan.toArchive.length > 0) {
    const { error } = await supabase
      .from("modules")
      .update({ archived_at: new Date().toISOString() })
      .in(
        "id",
        plan.toArchive.map((m) => m.id)
      );
    if (error) return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/modules");
  revalidatePath("/admin/upload");

  return {
    added: plan.toAdd.length,
    renamed: plan.toRename.length,
    linked: plan.toLink.length,
    recategorized: plan.toRecategorize.length,
    unarchived: plan.toUnarchive.length,
    english: plan.toSetEnglish.length,
    archived: plan.toArchive.length,
  };
}

function radekZPolozky(item: CatalogItem) {
  return {
    name: item.name,
    slug: item.slug,
    category: item.section,
    source_url: item.url,
    order_index: item.orderIndex,
  };
}

async function loadModules(): Promise<ModuleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select("id, name, name_en, slug, category, archived_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as ModuleRow[];
}

function popisChyby(chyba: unknown): string {
  const zprava = chyba instanceof Error ? chyba.message : String(chyba);
  return `Katalog se nepodařilo načíst z ${CATALOG_URL}: ${zprava}`;
}
