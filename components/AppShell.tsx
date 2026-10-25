import { Sidebar, MobileNav } from "@/components/Sidebar";
import type { AppUser } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

// Rám celé appky: levé menu, hlavička a plocha s obsahem.
//
// Od šířky `nav` (900 px) stojí menu jako sloupec vedle obsahu, pod ní se
// schová pod ikonu v hlavičce a vysune se přes obsah – obsah tak i na
// mobilu dostane celou šířku.
export function AppShell({
  user,
  t,
  bell,
  banner,
  supportUnread = 0,
  children,
}: {
  user: AppUser;
  t: Dictionary;
  /** Zvoneček s notifikacemi – data si načítá layout. */
  bell?: React.ReactNode;
  /** Pruh nad vším, dnes jen náhled jako editor. */
  banner?: React.ReactNode;
  /** Nepřečtené zprávy pro odznak v menu. */
  supportUnread?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {banner}
      <div className="flex">
        <Sidebar user={user} t={t} supportUnread={supportUnread} />
        {/* min-w-0: bez něj se pružný sloupec nesmrští pod šířku svého
            obsahu a stránka se začne rolovat do strany. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-haze px-4 py-3 nav:px-8 nav:py-4">
            <MobileNav user={user} t={t} supportUnread={supportUnread} />
            <div className="ml-auto shrink-0">{bell}</div>
          </header>
          <main className="min-w-0 px-4 py-6 nav:px-8 nav:py-8">{children}</main>
        </div>
      </div>
    </>
  );
}
