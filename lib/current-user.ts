// Pomocná funkce pro server komponenty: vrátí přihlášeného uživatele
// spolu s jeho rolí a zemí (z tabulky public.users), ne jen auth údaje.
import { createClient } from "@/lib/supabase/server";
import { readPreviewCountry } from "@/lib/preview";
import type { AppUser } from "@/lib/types";
import { redirect } from "next/navigation";

// Uživatel tak, jak je zapsaný v databázi – bez ohledu na náhled.
// Používej jen tam, kde se o náhledu rozhoduje (pruh nahoře, jeho ukončení).
export async function getRealUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!appUser) return null;

  // Uživatel může spravovat víc zemí (viz migrace 0008).
  const { data: countries } = await supabase
    .from("user_countries")
    .select("country_id")
    .eq("user_id", authUser.id);

  return {
    ...appUser,
    country_ids: (countries ?? []).map((row) => row.country_id),
  } as AppUser;
}

// Uživatel tak, jak ho má vidět zbytek appky. Když má admin zapnutý
// náhled, tváří se jako editor jedné země – a protože z téhle funkce
// vychází všechno ostatní, chová se tak celá appka včetně zápisů.
export async function getCurrentUser(): Promise<AppUser | null> {
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
}

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

// Nahrávat nové verze dokumentů může admin i editor.
export function canUpload(user: AppUser): boolean {
  return user.role === "admin" || user.role === "editor";
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
