import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/current-user";
import { readPreviewCountry } from "@/lib/preview";
import { createClient } from "@/lib/supabase/server";
import { PreviewBanner } from "@/components/PreviewBanner";
import { resolveActiveCountry } from "@/lib/active-country";
import { getNotificationsForCurrentUser } from "@/lib/notifications-data";
import { AppShell } from "@/components/AppShell";
import { NotificationBell } from "@/components/NotificationBell";
import { getSupportUnread } from "@/lib/support";
import { translateMissingLater } from "@/lib/translate-missing";

// Nejdelší doba běhu serverové funkce (v sekundách). Po zveřejnění verze
// a po načtení stránky běží na pozadí překlady a e-maily (after()), které
// mají vlastní časové limity; tohle je strop pro celek.
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "AI kurikulum";
const DESCRIPTION = "Sdílení metodik AI kurikula s partnerskými zeměmi";

export const metadata: Metadata = {
  // metadataBase je potřeba, aby se relativní cesta k náhledu doplnila
  // na úplnou adresu – sociální sítě si relativní odkaz nepřeloží.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TITLE,
    locale: "cs_CZ",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AI for children" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <html lang="cs">
        <body className="font-sans antialiased">{children}</body>
      </html>
    );
  }

  // Zemi si resolveActiveCountry přečte z cookie – layout parametry
  // z adresy nedostává.
  // Poznámky, které se při zveřejnění nepřeložily, se dopřeloží na pozadí.
  translateMissingLater();

  // Pruh o náhledu. getCurrentUser v náhledu vrací editora, takže se
  // pozná podle cookie, ne podle role.
  const previewCountryId = await readPreviewCountry();

  // Dotazy na sobě nezávisí, takže běží souběžně.
  const [{ t }, notifications, supportUnread, previewCountryName] = await Promise.all([
    resolveActiveCountry(user),
    getNotificationsForCurrentUser(user.id),
    getSupportUnread(user),
    previewCountryId ? loadCountryName(previewCountryId) : Promise.resolve(null),
  ]);

  return (
    <html lang="cs">
      <body className="font-sans antialiased">
        <AppShell
          user={user}
          t={t}
          supportUnread={supportUnread}
          bell={<NotificationBell initialNotifications={notifications} t={t} />}
          banner={
            previewCountryName && <PreviewBanner countryName={previewCountryName} t={t} />
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

async function loadCountryName(countryId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("countries").select("name").eq("id", countryId).maybeSingle();
  return data?.name ?? null;
}
