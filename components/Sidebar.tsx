"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BookOpen, UploadCloud, Settings, LogOut, Menu, X, MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { AppUser } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

// Levé menu. Od šířky `nav` (900 px) stojí jako sloupec vedle obsahu,
// pod ní se schová pod tlačítko s ikonou a vysune se přes obsah – jinak
// by na mobilu ukrojilo 256 px z 390 a karty by se neměly kam vejít.

export function Sidebar({
  user,
  t,
  supportUnread = 0,
}: {
  user: AppUser;
  t: Dictionary;
  /** Nepřečtené zprávy – adminovi od lidí, ostatním odpovědi adminů. */
  supportUnread?: number;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-haze bg-white px-4 py-6 nav:flex">
      <div className="mb-8 px-2">
        <HomeLogo t={t} />
      </div>

      <NavItems user={user} t={t} supportUnread={supportUnread} />
      <SignOut user={user} t={t} />
    </aside>
  );
}

// Horní pruh pro úzké okno: ikona nabídky a logo. Patří do hlavičky vedle
// zvonečku, proto je to vlastní komponenta a ne součást <aside>.
export function MobileNav({
  user,
  t,
  supportUnread = 0,
}: {
  user: AppUser;
  t: Dictionary;
  supportUnread?: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Po přechodu na jinou stránku nemá vysunuté menu důvod zůstat.
  useEffect(() => setOpen(false), [pathname]);

  // Escape zavře, a dokud je menu přes obsah, stránka pod ním neroluje.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const puvodni = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = puvodni;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="flex min-w-0 items-center gap-3 nav:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.menu}
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-haze"
      >
        <Menu size={20} />
      </button>
      <HomeLogo t={t} />

      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/40"
          onMouseDown={(event) => {
            // Zavírá jen klik na ztmavené pozadí, ne na vysunutý panel.
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="flex h-full w-72 max-w-[85vw] flex-col border-r border-haze bg-white px-4 py-6">
            <div className="mb-8 flex items-center justify-between gap-2 px-2">
              <HomeLogo t={t} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-haze"
              >
                <X size={20} />
              </button>
            </div>

            <NavItems user={user} t={t} supportUnread={supportUnread} />
            <SignOut user={user} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}

function NavItems({
  user,
  t,
  supportUnread,
}: {
  user: AppUser;
  t: Dictionary;
  supportUnread: number;
}) {
  const canManage = user.role === "admin" || user.role === "editor";

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
      <SidebarLink href="/" icon={<LayoutGrid size={18} />} label={t.overview} />
      <SidebarLink href="/modules" icon={<BookOpen size={18} />} label={t.methodologies} />
      {canManage && (
        <SidebarLink href="/admin/upload" icon={<UploadCloud size={18} />} label={t.upload} />
      )}
      {user.role === "admin" && (
        <SidebarLink href="/admin" icon={<Settings size={18} />} label={t.admin} />
      )}
      {/* Admin má schránku od všech, ostatní své vlákno s adminy. */}
      {user.role === "admin" ? (
        <SidebarLink
          href="/admin/messages"
          icon={<MessageCircle size={18} />}
          label={t.messagesNav}
          badge={supportUnread}
        />
      ) : (
        <SidebarLink
          href="/help"
          icon={<MessageCircle size={18} />}
          label={t.helpNav}
          badge={supportUnread}
        />
      )}
    </nav>
  );
}

function SignOut({ user, t }: { user: AppUser; t: Dictionary }) {
  return (
    <div className="dashed-divider mt-4 shrink-0 pt-4">
      {/* Dlouhá adresa se musí zalomit, jinak rozšíří celý panel. */}
      <p className="break-all px-2 text-xs text-ink/60">{user.email}</p>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink/70 hover:bg-haze"
        >
          <LogOut size={16} />
          {t.logout}
        </button>
      </form>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  badge = 0,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  /** Počet nepřečtených; nula se nezobrazuje. */
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-haze"
    >
      <span className="shrink-0">{icon}</span>
      {label}
      {badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

// Logo s názvem appky vede vždy na úvodní stránku (Změny).
function HomeLogo({ t }: { t: Dictionary }) {
  return (
    <Link href="/" aria-label={t.overview} className="inline-flex rounded-lg hover:opacity-80">
      <Logo name={t.appName} />
    </Link>
  );
}
