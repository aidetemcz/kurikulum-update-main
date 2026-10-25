"use client";

// Vlaječky pro volbu jazyka rozhraní. Emoji vlajky Windows nevykreslí
// (ukáže jen písmena „CZ“), proto jsou nakreslené jako SVG.
import { useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/i18n";
import { UI_LOCALE_COOKIE, UI_LOCALE_MAX_AGE } from "@/lib/ui-locale";

const NAMES: Record<Locale, string> = {
  cs: "Čeština",
  sk: "Slovenčina",
  en: "English",
  hu: "Magyar",
};

function Flag({ locale }: { locale: Locale }) {
  switch (locale) {
    case "cs":
      return (
        <svg viewBox="0 0 30 20" className="h-full w-full">
          <rect width="30" height="20" fill="#fff" />
          <rect y="10" width="30" height="10" fill="#d7141a" />
          <path d="M0 0L15 10L0 20Z" fill="#11457e" />
        </svg>
      );
    case "sk":
      return (
        <svg viewBox="0 0 30 20" className="h-full w-full">
          <rect width="30" height="20" fill="#ee1c25" />
          <rect width="30" height="13.33" fill="#0b4ea2" />
          <rect width="30" height="6.67" fill="#fff" />
          <path
            d="M6.5 4.5h8v6c0 2.6-2 4.4-4 5.3c-2-.9-4-2.7-4-5.3z"
            fill="#ee1c25"
            stroke="#fff"
            strokeWidth="0.8"
          />
          <path d="M10.1 6h.8v6.8h-.8zM8.6 7.4h3.8v.8H8.6zM8.1 9.2h4.8v.8H8.1z" fill="#fff" />
          <path d="M7.4 12.8c1-1 2-1 3.1-.3c1.1-.7 2.1-.7 3.1.3c-.8 1.2-1.9 2-3.1 2.6c-1.2-.6-2.3-1.4-3.1-2.6z" fill="#0b4ea2" />
        </svg>
      );
    case "en":
      return (
        <svg viewBox="0 0 60 30" preserveAspectRatio="none" className="h-full w-full">
          <clipPath id="flag-gb-t">
            <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
          </clipPath>
          <rect width="60" height="30" fill="#012169" />
          <path d="M0 0L60 30M60 0L0 30" stroke="#fff" strokeWidth="6" />
          <path d="M0 0L60 30M60 0L0 30" clipPath="url(#flag-gb-t)" stroke="#c8102e" strokeWidth="4" />
          <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
          <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
        </svg>
      );
    case "hu":
      return (
        <svg viewBox="0 0 30 20" className="h-full w-full">
          <rect width="30" height="20" fill="#477050" />
          <rect width="30" height="13.33" fill="#fff" />
          <rect width="30" height="6.67" fill="#ce2939" />
        </svg>
      );
  }
}

export function LanguageFlags({
  current,
  label,
  onChange,
}: {
  current: Locale;
  label: string;
  /** Bez onChange se po výběru překreslí stránka ze serveru. */
  onChange?: (locale: Locale) => void;
}) {
  const router = useRouter();

  function choose(locale: Locale) {
    document.cookie = `${UI_LOCALE_COOKIE}=${locale}; path=/; max-age=${UI_LOCALE_MAX_AGE}; samesite=lax`;
    if (onChange) onChange(locale);
    else router.refresh();
  }

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-2">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => choose(locale)}
          title={NAMES[locale]}
          aria-label={NAMES[locale]}
          aria-pressed={locale === current}
          className={`h-7 w-10 overflow-hidden rounded-md border transition ${
            locale === current
              ? "border-coral ring-2 ring-coral"
              : "border-haze opacity-60 hover:opacity-100"
          }`}
        >
          <Flag locale={locale} />
        </button>
      ))}
    </div>
  );
}
