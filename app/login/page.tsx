"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isRateLimit } from "@/lib/auth-errors";
import { Logo } from "@/components/Logo";
import { LanguageFlags } from "@/components/LanguageFlags";
import { LOCALES, getDictionary, toLocale, type Locale } from "@/lib/i18n";
import { UI_LOCALE_COOKIE } from "@/lib/ui-locale";

// Jazyk přihlašovací stránky: vlaječka vybraná dřív, jinak jazyk
// prohlížeče, jinak čeština. Partner ze Slovenska tak hned čte slovensky.
function initialLocale(): Locale {
  const fromCookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${UI_LOCALE_COOKIE}=`))
    ?.split("=")[1];
  if (fromCookie) return toLocale(fromCookie);

  const fromBrowser = navigator.language.slice(0, 2).toLowerCase();
  return LOCALES.includes(fromBrowser as Locale) ? (fromBrowser as Locale) : "cs";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error" | "rateLimit">(
    "idle"
  );
  // Chyba, se kterou sem appku vrátil přihlašovací odkaz (viz auth/callback
  // a requireUser). Čteme ji až v prohlížeči, ať stránka zůstane statická.
  const [linkError, setLinkError] = useState<"link" | "account" | null>(null);
  const [locale, setLocale] = useState<Locale>("cs");
  const t = getDictionary(locale);
  const supabase = createClient();

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "link" || error === "account") setLinkError(error);
    setLocale(initialLocale());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    // Supabase pustí jen omezený počet e-mailů za hodinu. Bez téhle
    // hlášky uživatel zkouší znovu a limit tím jen drží.
    if (isRateLimit(error)) setStatus("rateLimit");
    else setStatus(error ? "error" : "sent");
  }

  const [sentBefore, sentAfter] = t.loginLinkSent.split("{email}");

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size={64} showName={false} />
          <span className="font-heading text-2xl font-bold tracking-tight text-ink">
            AI kurikulum
          </span>
          <LanguageFlags current={locale} label={t.language} onChange={setLocale} />
        </div>

        {status === "sent" ? (
          <p className="text-center text-sm text-ink/70">
            {sentBefore}
            <strong>{email}</strong>
            {sentAfter}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-ink" htmlFor="email">
              {t.email}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="rounded-xl border border-haze px-4 py-2.5 outline-none focus:border-coral"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-2 rounded-xl bg-coral px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? t.sendingLoginLink : t.sendLoginLink}
            </button>
            {status === "idle" && linkError === "link" && (
              <p className="text-sm text-coral">{t.loginLinkInvalid}</p>
            )}
            {status === "idle" && linkError === "account" && (
              <p className="text-sm text-coral">{t.loginAccountMissing}</p>
            )}
            {status === "rateLimit" && <p className="text-sm text-coral">{t.loginRateLimit}</p>}
            {status === "error" && <p className="text-sm text-coral">{t.loginFailed}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
