// Sem uživatele přesměruje odkaz z magic-link e-mailu. Vymění jednorázový
// kód za přihlašovací session a pošle uživatele na hlavní stránku.
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Propadlý nebo už použitý odkaz vrací Supabase s ?error=... Bez téhle
  // větve by middleware uživatele potichu vrátil na přihlášení.
  if (searchParams.get("error")) return NextResponse.redirect(`${origin}/login?error=link`);

  // Pozvánka z administrace nenese ?code, ale přihlašovací údaje za # –
  // ty přečte až prohlížeč. Prohlížeč část za # při přesměrování zachová.
  if (!code) return NextResponse.redirect(`${origin}/auth/finish`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=link`);

  // Řádek v public.users zakládá trigger v databázi (migrace 0001). Účty
  // založené dřív, než trigger existoval, ho ale nemají, a appka by je
  // pak nepustila dál. Doplníme ho tedy i tady – existující nepřepíšeme.
  const { error: upsertError } = await createAdminClient()
    .from("users")
    .upsert(
      { id: data.user.id, email: data.user.email },
      { onConflict: "id", ignoreDuplicates: true }
    );
  if (upsertError) console.error("Nepodařilo se doplnit řádek v users:", upsertError);

  return NextResponse.redirect(`${origin}/`);
}
