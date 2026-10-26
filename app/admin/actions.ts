"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, getRealUser } from "@/lib/current-user";
import { sendChangeNotificationEmail } from "@/lib/mail";
import { isRateLimit } from "@/lib/auth-errors";
import { versionMonth } from "@/lib/version-label";
import { PREVIEW_COOKIE } from "@/lib/preview";
import { setUserCountries, type UserCountriesClient } from "@/lib/user-countries";
import { normalizeRole } from "@/lib/permissions";

// Akce v Administraci nikdy nevyhazují výjimku. Výjimka ze serverové akce
// skončí bílou stránkou "Application error", na které se uživatel nedozví
// nic. Místo toho vracejí stav, který formulář vypíše jako hlášku.
export type ActionState = { error: string } | { ok: string } | null;

const RATE_LIMIT =
  "Vyčerpaný hodinový limit odesílání e-mailů v Supabase (bez vlastního SMTP jen pár zpráv za hodinu, limit se mění v Authentication → Rate Limits). Zkuste to prosím za hodinu znovu.";

export async function addCountry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  if (!name || !locale) return { error: "Vyplňte prosím název země i jazykový kód." };

  const supabase = await createClient();
  const { data: zeme, error } = await supabase
    .from("countries")
    .insert({ name, locale })
    .select("id")
    .single();
  if (error || !zeme) return { error: `Přidání země selhalo: ${error?.message ?? ""}`.trim() };

  // Nová země dostane i změny zveřejněné před jejím přidáním – jinak by
  // je neviděla nikdy, změna se zemím rozesílá jen při zveřejnění.
  const { data: znacky } = await supabase
    .from("annotations")
    .select("id, document_versions!inner (status)")
    .eq("document_versions.status", "published");
  if (znacky && znacky.length > 0) {
    const { error: chyba } = await createAdminClient()
      .from("annotation_country_status")
      .upsert(
        znacky.map((znacka) => ({ annotation_id: znacka.id, country_id: zeme.id })),
        { onConflict: "annotation_id,country_id", ignoreDuplicates: true }
      );
    if (chyba) console.error("Dosavadní změny se nové zemi nepodařilo poslat:", chyba);
  }

  revalidatePath("/admin");
  return { ok: "Uloženo." };
}

export async function inviteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const countryIds = formData.getAll("countryIds").map(String).filter(Boolean);
  if (!email || countryIds.length === 0) {
    return { error: "Vyplňte prosím e-mail a aspoň jednu zemi." };
  }

  // Service role klíč je potřeba pro pozvání nového uživatele (vytvoří se
  // mu záznam v auth.users a pošle se mu e-mail s přihlašovacím odkazem).
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  });

  if (isRateLimit(error)) return { error: RATE_LIMIT };
  if (error || !data.user) {
    return { error: `Pozvání uživatele selhalo: ${error?.message ?? "neznámá chyba"}` };
  }

  // Databázový trigger (viz supabase/migrations/0001_init.sql) při pozvání
  // automaticky založí řádek v public.users – tady mu jen doplníme roli a země.
  // Zvaný je vždy editor; adminem ho jde udělat v seznamu uživatelů. Roli
  // zapisujeme výslovně, dokud databáze bez migrace 0020 zakládá „viewer“.
  const { error: updateError } = await adminClient
    .from("users")
    .update({ role: "editor" })
    .eq("id", data.user.id);

  if (updateError) return { error: `Nastavení role selhalo: ${updateError.message}` };

  // Typy klienta Supabase jsou příliš zanořené, než aby se daly odvodit;
  // setUserCountries z nich používá jen malý známý kousek.
  const countryError = await setUserCountries(
    adminClient as unknown as UserCountriesClient,
    data.user.id,
    countryIds
  );
  if (countryError) return { error: countryError };

  revalidatePath("/admin");
  return { ok: `Pozvánka odešla na ${email}.` };
}

// Uživatel může spravovat víc zemí, proto se přiřazení pokaždé srovná
// podle zaškrtnutých políček.
export async function updateUserRoleAndCountries(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const countryIds = formData.getAll("countryIds").map(String).filter(Boolean);
  const role = normalizeRole(formData.get("role"));
  const locale = String(formData.get("locale") ?? "").trim();
  if (!userId) return { error: "Chybí uživatel." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ role, locale: locale || null })
    .eq("id", userId);

  if (error) return { error: `Úprava uživatele selhala: ${error.message}` };

  const countryError = await setUserCountries(
    supabase as unknown as UserCountriesClient,
    userId,
    countryIds
  );
  if (countryError) return { error: countryError };

  obnovSeznamy();
  return { ok: "Uloženo." };
}

// Zkušební notifikace na vlastní adresu, stejnou šablonou jako naostro.
export async function sendTestEmail(): Promise<
  { ok: true } | { notConfigured: true } | { error: string }
> {
  const admin = await requireAdmin();

  try {
    const result = await sendChangeNotificationEmail({
      to: admin.email,
      moduleName: "Zkušební metodika",
      versionLabel: versionMonth(new Date()),
      uploadedAt: new Date().toISOString(),
      summary: "Tohle je zkušební e-mail z Administrace, nic se nikam nenahrálo.",
      notes: ["Ukázková poznámka ke změně", "Druhá ukázková poznámka"],
      countryName: "Zkouška",
    });

    if (result.sent) return { ok: true };
    if ("notConfigured" in result) return { notConfigured: true };
    return { error: result.error };
  } catch (chyba) {
    return { error: chyba instanceof Error ? chyba.message : String(chyba) };
  }
}

// ---------------------------------------------------------------------
// Náhled jako editor
// ---------------------------------------------------------------------
// Admin si prohlédne appku očima editora jedné země. Nic se tím
// nepovoluje – naopak, v náhledu platí jen práva té jedné země.

export async function startPreview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const countryId = String(formData.get("countryId") ?? "");
  if (!countryId) return { error: "Vyberte prosím zemi." };

  (await cookies()).set(PREVIEW_COOKIE, countryId, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
  return { ok: "Náhled zapnutý." };
}

// Ukončení náhledu se musí ptát na skutečného uživatele: v náhledu se
// admin tváří jako editor, takže requireAdmin by ho nepustil ven.
export async function stopPreview() {
  const user = await getRealUser();
  if (user?.role !== "admin") return;

  (await cookies()).delete(PREVIEW_COOKIE);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------
// Metodiky
// ---------------------------------------------------------------------
// Hlavní cesta je import z kurikulum.aidetem.cz (viz catalog-actions.ts).
// Tohle je ruční záchrana pro případ, kdy web zdrojem být nemůže.

export async function addModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  if (!name) return { error: "Vyplňte prosím název metodiky." };

  const supabase = await createClient();
  const { error } = await supabase.from("modules").insert({
    name,
    category: category || null,
    name_en: nameEn || null,
  });
  if (error) return { error: `Přidání metodiky selhalo: ${error.message}` };

  obnovSeznamy();
  return { ok: "Uloženo." };
}

export async function updateModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("moduleId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  if (!id || !name) return { error: "Vyplňte prosím název metodiky." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({ name, category: category || null, name_en: nameEn || null })
    .eq("id", id);
  if (error) return { error: `Úprava metodiky selhala: ${error.message}` };

  obnovSeznamy();
  return { ok: "Uloženo." };
}

// Archivovaná metodika se nikde nenabízí, ale nic se jí nestane –
// verze i vyznačené změny zůstávají.
export async function setModuleArchived(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("moduleId") ?? "");
  const archived = formData.get("archived") === "1";
  if (!id) return null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: `Změna se nepodařila: ${error.message}` };

  obnovSeznamy();
  return { ok: "Uloženo." };
}

// Smazat jde jen metodika, ke které ještě není žádná verze. Jinak by se
// s ní ztratila i historie – od toho je archivace.
export async function deleteModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("moduleId") ?? "");
  if (!id) return null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("document_versions")
    .select("id", { count: "exact", head: true })
    .eq("module_id", id);

  if ((count ?? 0) > 0) {
    return { error: "Metodika má nahrané verze, smazat nejde. Použijte archivaci." };
  }

  // .select() je tu schválně: bez něj by se o smazání nula řádků (třeba
  // kvůli pravidlům v databázi) uživatel nedozvěděl a hláška by lhala.
  const { data: smazane, error } = await supabase
    .from("modules")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: `Smazání metodiky selhalo: ${error.message}` };
  if (!smazane || smazane.length === 0) {
    return { error: "Metodika se nesmazala — nemáte k ní oprávnění, nebo už je pryč." };
  }

  obnovSeznamy();
  return { ok: "Smazáno." };
}

// Metodiky se nabízejí na čtyřech místech. Když se některá změní nebo
// zmizí, musí se obnovit všechna, ať nikde nezůstane viset.
function obnovSeznamy() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/modules");
  revalidatePath("/admin/upload");
}
