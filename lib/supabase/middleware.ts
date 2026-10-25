// Pomocná funkce pro middleware.ts – obnovuje přihlašovací session při každém
// požadavku, aby uživatel nebyl náhodou odhlášen, i když je token starší.
// Zároveň drží cookie s prohlíženou zemí v souladu s adresou.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { VIEW_COUNTRY_COOKIE, VIEW_COUNTRY_MAX_AGE } from "@/lib/view-country";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  // Když adresa nese ?country=..., uložíme si zemi do cookie. Zapisujeme ji
  // i do požadavku, aby ji layout viděl hned při vykreslení téhle stránky,
  // ne až u dalšího kliknutí.
  const countryFromUrl = request.nextUrl.searchParams.get("country");
  if (countryFromUrl) {
    request.cookies.set(VIEW_COUNTRY_COOKIE, countryFromUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims ověří přihlášení podpisem tokenu přímo tady, bez cesty na
  // přihlašovací server Supabase – ta by zdržela každé kliknutí. U starších
  // projektů se symetrickým klíčem se sám vrátí ke getUser().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isLoginPage && !isAuthCallback) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (countryFromUrl) {
    response.cookies.set(VIEW_COUNTRY_COOKIE, countryFromUrl, {
      path: "/",
      maxAge: VIEW_COUNTRY_MAX_AGE,
      sameSite: "lax",
    });
  }

  return response;
}
