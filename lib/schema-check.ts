// Kontrola, jestli v databázi doběhly všechny migrace.
//
// Když sloupec z migrace chybí, PostgREST vrátí chybu a dotaz skončí
// prázdným seznamem. Na obrazovce to pak vypadá jako prázdná databáze,
// ne jako rozbitá appka. Tohle rozdíl pojmenuje – ale jen adminovi,
// ostatní s tím stejně nic neudělají.
import { createClient } from "@/lib/supabase/server";

// Pro každou migraci jeden sloupec nebo tabulka, které přidává.
// Stačí jedna věc z každé, jde o to poznat, že migrace neproběhla.
const SONDY = [
  { migrace: "0002_annotations.sql", tabulka: "annotations", sloupec: "id" },
  { migrace: "0003_drafts.sql", tabulka: "document_versions", sloupec: "status" },
  { migrace: "0004_country_status.sql", tabulka: "annotation_country_status", sloupec: "id" },
  { migrace: "0007_catalog.sql", tabulka: "modules", sloupec: "slug" },
  { migrace: "0008_user_countries.sql", tabulka: "user_countries", sloupec: "country_id" },
  { migrace: "0009_translations_and_admin_edits.sql", tabulka: "annotations", sloupec: "translations" },
  { migrace: "0010_cleanup_storage_and_ui_locale.sql", tabulka: "users", sloupec: "locale" },
  { migrace: "0011_mark_quote.sql", tabulka: "annotations", sloupec: "quote" },
  { migrace: "0012_presentations.sql", tabulka: "document_versions", sloupec: "kind" },
  { migrace: "0013_support_messages.sql", tabulka: "support_messages", sloupec: "id" },
  { migrace: "0014_module_name_translations.sql", tabulka: "modules", sloupec: "name_translations" },
  { migrace: "0015_followed_modules.sql", tabulka: "country_modules", sloupec: "module_id" },
] as const;

// Vrátí názvy migrací, které v databázi chybí. Prázdné pole = všechno sedí.
export async function missingMigrations(): Promise<string[]> {
  const supabase = await createClient();

  const vysledky = await Promise.all(
    SONDY.map(async (sonda) => {
      const { error } = await supabase
        .from(sonda.tabulka)
        .select(sonda.sloupec)
        .limit(1);

      // 42703 = sloupec neexistuje, 42P01 = tabulka neexistuje,
      // PGRST204 = PostgREST o sloupci neví. Ostatní chyby (třeba
      // zakázaný přístup) o chybějící migraci nevypovídají.
      const chybi =
        error !== null &&
        ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "");

      return chybi ? (sonda.migrace as string) : null;
    })
  );

  return vysledky.filter((migrace): migrace is string => migrace !== null);
}
