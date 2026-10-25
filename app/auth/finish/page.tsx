"use client";

// Dokončení přihlášení z pozvánky. Pozvánku posílá server (inviteUserByEmail)
// a Supabase po ní vrací přihlašovací údaje v části adresy za #, kterou
// server nevidí. auth/callback sem proto pošle každý odkaz bez ?code a tady
// si údaje přečteme v prohlížeči.
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthFinishPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      window.location.replace("/login?error=link");
      return;
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        // Celé načtení stránky, ať server uvidí čerstvé přihlašovací cookies.
        window.location.replace(error ? "/login?error=link" : "/");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <p className="text-sm text-ink/70">Přihlašuji…</p>
    </div>
  );
}
