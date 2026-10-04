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
  const { t } = await resolveActiveCountry(user);
  const notifications = await getNotificationsForCurrentUser(user.id);

  // Pruh o náhledu. getCurrentUser v náhledu vrací editora, takže se
  // pozná podle cookie, ne podle role.
  const previewCountryId = await readPreviewCountry();
  let previewCountryName: string | null = null;
  if (previewCountryId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("countries")
      .select("name")
      .eq("id", previewCountryId)
      .maybeSingle();
    previewCountryName = data?.name ?? null;
  }

  return (
    <html lang="cs">
      <body className="font-sans antialiased">
        <AppShell
          user={user}
          t={t}
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
