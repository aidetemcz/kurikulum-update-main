// Názvy zemí v jazyce rozhraní. V databázi jsou česky (countries.name);
// u zemí, které tu neznáme, se ukáže uložený název beze změny.
import type { Locale } from "@/lib/i18n";

const NAZVY: Record<string, Record<Locale, string>> = {
  cesko: { cs: "Česko", sk: "Česko", en: "Czechia", hu: "Csehország" },
  slovensko: { cs: "Slovensko", sk: "Slovensko", en: "Slovakia", hu: "Szlovákia" },
  "velka britanie": {
    cs: "Velká Británie",
    sk: "Veľká Británia",
    en: "United Kingdom",
    hu: "Egyesült Királyság",
  },
  madarsko: { cs: "Maďarsko", sk: "Maďarsko", en: "Hungary", hu: "Magyarország" },
};

// Kdyby admin zemi pojmenoval jinak, než se čeká.
const ALIASY: Record<string, string> = {
  "ceska republika": "cesko",
  czechia: "cesko",
  "czech republic": "cesko",
  slovakia: "slovensko",
  "united kingdom": "velka britanie",
  uk: "velka britanie",
  "great britain": "velka britanie",
  hungary: "madarsko",
};

function klic(nazev: string): string {
  return nazev
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function countryName(name: string, locale: string): string {
  const k = klic(name);
  const preklady = NAZVY[ALIASY[k] ?? k];
  return preklady?.[locale as Locale] ?? name;
}

/** Totéž pro celý seznam zemí. */
export function withCountryNames<T extends { name: string }>(countries: T[], locale: string): T[] {
  return countries.map((country) => ({ ...country, name: countryName(country.name, locale) }));
}
