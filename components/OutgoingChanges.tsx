"use client";

import { ChangeCard } from "@/components/ChangesFromOthers";
import type { OutgoingChange } from "@/lib/outgoing";
import type { Dictionary, Locale } from "@/lib/i18n";

// Odchozí změny ve stejných kartách jako příchozí – jen bez vyřizování.
export function OutgoingChanges({
  changes,
  locale,
  t,
}: {
  changes: OutgoingChange[];
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 nav:grid-cols-2 min-[1400px]:grid-cols-3">
      {changes.map((item) => (
        <ChangeCard
          key={item.id}
          item={item}
          documentHref={item.href}
          hidden={false}
          resolution={null}
          canResolve={false}
          leaving={false}
          focus={false}
          locale={locale}
          t={t}
          onDismiss={() => {}}
          onDone={() => {}}
          onRestore={() => {}}
        />
      ))}
    </ul>
  );
}
