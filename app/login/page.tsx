"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isRateLimit } from "@/lib/auth-errors";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error" | "rateLimit">(
    "idle"
  );
  // Chyba, se kterou sem appku vrátil přihlašovací odkaz (viz auth/callback
  // a requireUser). Čteme ji až v prohlížeči, ať stránka zůstane statická.
  const [linkError, setLinkError] = useState<"link" | "account" | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "link" || error === "account") setLinkError(error);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size={64} showName={false} />
          <span className="font-heading text-2xl font-bold tracking-tight text-ink">
            AI kurikulum
          </span>
        </div>

        {status === "sent" ? (
          <p className="text-center text-sm text-ink/70">
            Poslali jsme ti odkaz na přihlášení na <strong>{email}</strong>. Zkontroluj e-mail
            (i spam).
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-ink" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jmeno@organizace.cz"
              className="rounded-xl border border-haze px-4 py-2.5 outline-none focus:border-coral"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-2 rounded-xl bg-coral px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "Posílám odkaz..." : "Poslat přihlašovací odkaz"}
            </button>
            {status === "idle" && linkError === "link" && (
              <p className="text-sm text-coral">
                Přihlašovací odkaz nefungoval. Mohl vypršet nebo už byl použitý, případně
                ses o něj řekla v jiném prohlížeči. Pošli si nový a otevři ho ve stejném
                prohlížeči.
              </p>
            )}
            {status === "idle" && linkError === "account" && (
              <p className="text-sm text-coral">
                Přihlášení proběhlo, ale tvůj účet v appce chybí. Ozvi se prosím adminovi.
              </p>
            )}
            {status === "rateLimit" && (
              <p className="text-sm text-coral">
                Vyčerpaný hodinový limit odesílání e-mailů. Zkus to prosím za hodinu znovu —
                jde o dočasné omezení testovací pošty, ne o chybu tvého účtu.
              </p>
            )}
            {status === "error" && (
              <p className="text-sm text-coral">Něco se nepovedlo, zkus to prosím znovu.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
