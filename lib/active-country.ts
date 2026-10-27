// Která země se má uživateli právě zobrazit a v jakém jazyce.
//
// Admin spravuje všechny země, ostatní jen ty, které mají přiřazené –
// a těch může být víc (Česko i anglická verze pod jedním účtem).
// Mezi svými zeměmi se přepíná parametrem ?country=... v adrese. Cizí zemi
// si ručním přepsáním adresy zobrazit nejde: hledá se jen mezi povolenými.
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, toLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { VIEW_COUNTRY_COOKIE } from "@/lib/view-country";
import { UI_LOCALE_COOKIE } from "@/lib/ui-locale";
import type { AppUser, Country } from "@/lib/types";
import { withCountryNames } from "@/lib/country-name";

export type ActiveCountry = {
  activeCountryId: string | null;
  /** Země pro přepínač. Prázdné, když je co vybírat jen jedna. */
  countries: Country[];
  /** Texty rozhraní v jazyce prohlížené země. */
  t: Dictionary;
  /** Jazyk prohlížené země – v něm se ukazují přeložené poznámky. */
  locale: Locale;
};

export async function resolveActiveCountry(
  user: AppUser,
  requestedCountryId?: string
): Promise<ActiveCountry> {
  const vsechny = await loadCountries();

  // Admin vidí všechny země, ostatní jen ty svoje.
  const countries = user.role === "admin"
    ? vsechny
    : vsechny.filter((country) => user.country_ids.includes(country.id));

  if (countries.length === 0) {
    // Bez země nemá podle čeho jazyk určit, proto platí vlaječka, kterou
    // si člověk sám vybral (NoCountryNotice), pak jeho nastavení.
    const chosen = (await cookies()).get(UI_LOCALE_COOKIE)?.value;
    const uiLocale = toLocale(chosen ?? user.locale);
    return {
      activeCountryId: null,
      countries: [],
      t: getDictionary(uiLocale),
      locale: uiLocale,
    };
  }

  // Layout parametry z adresy nedostává, proto se zemí drží i v cookie.
  const countryFromCookie = (await cookies()).get(VIEW_COUNTRY_COOKIE)?.value;

  // Pořadí: země z adresy, pak z cookie, pak první ze seznamu. Do obou
  // se kouká jen mezi země, na které uživatel má právo.
  const active =
    countries.find((country) => country.id === requestedCountryId) ??
    countries.find((country) => country.id === countryFromCookie) ??
    countries[0];

  const locale = toLocale(active.locale);

  return {
    activeCountryId: active.id,
    // Přepínač se vykreslí, jen když je z čeho vybírat. Názvy zemí
    // v jazyce rozhraní.
    countries: countries.length > 1 ? withCountryNames(countries, locale) : [],
    // Rozhraní mluví jazykem prohlížené země: po přepnutí na Velkou
    // Británii je celé anglicky. Vlastní nastavení jazyka u uživatele platí
    // jen pro účet bez země (viz výše).
    t: getDictionary(locale),
    locale,
  };
}

// Seznam zemí chce layout i stránka; v rámci jednoho načtení stačí jednou.
const loadCountries = cache(async (): Promise<Country[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("countries").select("*").order("name");
  return data ?? [];
});
