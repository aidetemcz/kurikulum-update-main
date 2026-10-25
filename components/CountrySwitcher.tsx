import type { Country } from "@/lib/types";

// Přepínač zemí pro adminy. Pro ostatní role dostane prázdný seznam zemí
// a nevykreslí se vůbec.
//
// Záměrně používáme obyčejný odkaz místo next/link: Next.js při přepnutí
// bez načtení stránky nevykresluje layout znovu, takže by levý panel zůstal
// v původním jazyce. Plné načtení přeloží celou stránku včetně menu.
export function CountrySwitcher({
  countries,
  activeCountryId,
  basePath,
  label,
  extraQuery = "",
}: {
  countries: Country[];
  activeCountryId: string | null;
  basePath: string;
  /** Popisek před přepínačem, např. „Země“. */
  label?: string;
  /** Další parametry adresy, které mají přepnutí přežít (např. "&kind=presentation"). */
  extraQuery?: string;
}) {
  if (countries.length === 0) return null;

  // Vypadá jinak než štítky na stránce (pilulky), ať se nepletou:
  // obdélníkový přepínač s rámečkem.
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-xs font-medium text-ink/50">{label}:</span>}
      <div className="inline-flex flex-wrap rounded-lg border border-haze p-0.5">
        {countries.map((country) => (
          <a
            key={country.id}
            href={`${basePath}?country=${country.id}${extraQuery}`}
            aria-current={country.id === activeCountryId ? "true" : undefined}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              country.id === activeCountryId ? "bg-ink text-white" : "text-ink/60 hover:bg-haze"
            }`}
          >
            {country.name}
          </a>
        ))}
      </div>
    </div>
  );
}
