"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/current-user";

const NEZMENENO =
  "Změnu se nepodařilo uložit. Zkus stránku načíst znovu — možná ji mezitím změnil někdo jiný.";

export type Resolution = "done" | "not_relevant";

// Kód chyby, když v databázi chybí sloupec (migrace 0017 ještě neběžela).
const CHYBI_SLOUPEC = ["42703", "PGRST204"];

// Vyřízení změny: „Hotovo“, nebo „Netýká se nás“. Zápis je vratný –
// vrácení zpět řeší restoreChange, buď hned z lišty, nebo kdykoli
// později ze záložky Vyřízené.
// Podmínka na status zaručí, že opakované zavolání nic nepokazí.
export async function dismissChange(
  statusId: string,
  resolution: Resolution = "not_relevant"
): Promise<{ error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const zapis = {
    status: "dismissed",
    dismissed_at: new Date().toISOString(),
    dismissed_by: user.id,
  };
  const uloz = (hodnoty: Record<string, unknown>) =>
    supabase
      .from("annotation_country_status")
      .update(hodnoty)
      .eq("id", statusId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

  let { data, error } = await uloz({ ...zapis, resolution });
  // Bez migrace 0017 se důvod neuloží, změna se ale vyřídí i tak.
  if (error && CHYBI_SLOUPEC.includes(error.code ?? "")) {
    ({ data, error } = await uloz(zapis));
  }

  if (error) return { error: error.message };
  // Nula změněných řádků bez chyby znamená, že zápis zastavila pravidla
  // v databázi nebo že už stav změnil někdo jiný. Tiše to spolknout
  // znamená tvrdit uživateli něco, co se nestalo.
  if (!data) return { error: NEZMENENO };

  revalidatePath("/");
  return {};
}

// Vrácení mezi aktuální. Stopy po skrytí se mažou, ať je řádek ve stejném
// stavu, v jakém přišel – jinak by se ze semaforu nedalo poznat, co je nové.
export async function restoreChange(statusId: string): Promise<{ error?: string }> {
  await requireUser();
  const supabase = await createClient();

  const zapis = { status: "pending", dismissed_at: null, dismissed_by: null };
  const uloz = (hodnoty: Record<string, unknown>) =>
    supabase
      .from("annotation_country_status")
      .update(hodnoty)
      .eq("id", statusId)
      .eq("status", "dismissed")
      .select("id")
      .maybeSingle();

  let { data, error } = await uloz({ ...zapis, resolution: null });
  if (error && CHYBI_SLOUPEC.includes(error.code ?? "")) {
    ({ data, error } = await uloz(zapis));
  }

  if (error) return { error: error.message };
  if (!data) return { error: NEZMENENO };

  revalidatePath("/");
  return {};
}
