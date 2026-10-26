// Pomocná funkce pro server komponenty: vrátí přihlášeného uživatele
// spolu s jeho rolí a zemí (z tabulky public.users), ne jen auth údaje.
import { createClient } from "@/lib/supabase/server";
import { readPreviewCountry } from "@/lib/preview";
import type { AppUser } from "@/lib/types";
import { canUpload, normalizeRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { cache } from "react";

export { canUpload };

// Uživatel tak, jak je zapsaný v databázi – bez ohledu na náhled.
// Používej jen tam, kde se o náhledu rozhoduje (pruh nahoře, jeho ukončení).
//
// Layout i stránka se na uživatele ptají v rámci jednoho načtení zvlášť.
// cache() zajistí, že se do Supabase (často přes oceán) jde jen jednou.
export const getRealUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  // Ověření podpisem tokenu, bez cesty na přihlašovací server (viz middleware).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) return null;

  // Oba dotazy potřebují jen id, takže běží souběžně.
  // Uživatel může spravovat víc zemí (viz migrace 0008).
  const [{ data: appUser }, { data: countries }] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase.from("user_countries").select("country_id").eq("user_id", userId),
  ]);

  if (!appUser) return null;

  return {
    ...appUser,
    role: normalizeRole(appUser.role),
    country_ids: (countries ?? []).map((row) => row.country_id),
  } as AppUser;
});

// Uživatel tak, jak ho má vidět zbytek appky. Když má admin zapnutý
// náhled, tváří se jako editor jedné země – a protože z téhle funkce
// vychází všechno ostatní, chová se tak celá appka včetně zápisů.
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const user = await getRealUser();
  if (!user || user.role !== "admin") return user;

  const previewCountryId = await readPreviewCountry();
  if (!previewCountryId) return user;

  // Země mohla mezitím zmizet; pak se náhled prostě neuplatní.
  const supabase = await createClient();
  const { data: country } = await supabase
    .from("countries")
    .select("id")
    .eq("id", previewCountryId)
    .maybeSingle();

  if (!country) return user;

  return { ...user, role: "editor", country_ids: [previewCountryId] };
});

// Použij na stránkách, které vyžadují přihlášení. Pokud uživatel není
// přihlášený, přesměruje na /login.
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (user) return user;

  // Přihlášený v Supabase, ale bez řádku v public.users: obyčejné
  // přesměrování na /login by vypadalo, jako by přihlášení nefungovalo.
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  redirect(authUser ? "/login?error=account" : "/login");
}

// Použij na stránkách jen pro adminy (např. /admin).
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

// Smí uživatel zapisovat za tuhle zemi?
//
// Nahrává se vždycky jen za vlastní zemi – a admin není výjimka. Hlídají
// to i pravidla v databázi (migrace 0005, 0006, 0008), ale appka se na ně
// nespoléhá: formulář cizí zemi nenabídne a server ji odmítne.
export function canWriteForCountry(user: AppUser, countryId: string): boolean {
  return canUpload(user) && user.country_ids.includes(countryId);
}

// Země, za které smí uživatel nahrávat.
export function writableCountries<T extends { id: string }>(
  user: AppUser,
  countries: T[]
): T[] {
  return countries.filter((country) => user.country_ids.includes(country.id));
}
