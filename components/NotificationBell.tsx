"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationWithDetails } from "@/lib/notifications-data";
import type { Dictionary } from "@/lib/i18n";

export function NotificationBell({
  initialNotifications,
  initialUnread,
  t,
}: {
  initialNotifications: NotificationWithDetails[];
  /** Nepřečtené celkem, i ty starší, které se do seznamu nevešly. */
  initialUnread: number;
  t: Dictionary;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  // Kolik jich uživatel přečetl teď, bez nového načtení stránky.
  const [prectenoTed, setPrectenoTed] = useState(0);
  const supabase = createClient();

  const unreadCount = Math.max(0, initialUnread - prectenoTed);

  async function markAsRead(id: string) {
    if (notifications.some((n) => n.id === id && !n.read_at)) setPrectenoTed((pocet) => pocet + 1);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-haze"
        aria-label={t.notifications}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-haze bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold text-ink/60">{t.notifications}</p>
          {notifications.length === 0 && (
            <p className="px-2 py-4 text-sm text-ink/50">{t.noNotifications}</p>
          )}
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => markAsRead(n.id)}
                  className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-haze ${
                    n.read_at ? "text-ink/60" : "text-ink"
                  }`}
                >
                  <span className="block font-medium">
                    {n.module_name} · {n.version_label}
                  </span>
                  <span className="block truncate text-xs text-ink/60">{n.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
