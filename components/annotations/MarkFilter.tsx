"use client";

// Filtr značek podle druhu změny při čtení verze. Výchozí je „Vše“ –
// všechny značky v pořadí čtení. Po výběru jednoho nebo víc druhů se
// ostatní značky upozadí (nezmizí) a šipky posouvají jen po vybraných.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CATEGORY_KEYS, categoryLabel, parseCategories, sortMarks } from "@/lib/annotations";
import type { Mark } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

export function useMarkFilter(marks: Mark[]) {
  const [selected, setSelected] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);

  const matching = useMemo(() => {
    const vsechny = sortMarks(marks);
    if (selected.length === 0) return vsechny;
    return vsechny.filter((mark) =>
      parseCategories(mark.category).some((key) => selected.includes(key))
    );
  }, [marks, selected]);

  const mutedIds = useMemo(() => {
    if (selected.length === 0) return new Set<string>();
    const vybrane = new Set(matching.map((mark) => mark.id));
    return new Set(marks.filter((mark) => !vybrane.has(mark.id)).map((mark) => mark.id));
  }, [marks, matching, selected]);

  function toggle(key: string | null) {
    setIndex(-1);
    if (key === null) setSelected([]);
    else {
      setSelected((current) =>
        current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
      );
    }
  }

  // Další/předchozí vybraná značka; na konci se začne znovu od začátku.
  function step(direction: 1 | -1): Mark | null {
    if (matching.length === 0) return null;
    const dalsi = (index + direction + matching.length) % matching.length;
    setIndex(dalsi);
    return matching[dalsi];
  }

  return { selected, toggle, matching, mutedIds, index, step };
}

// Odroluje dokument tak, aby značka byla kousek pod horním okrajem okna.
export function scrollToMarkPosition(mark: Mark) {
  const stranka = document.getElementById(`pdf-page-${mark.page}`);
  if (!stranka) return;
  const box = stranka.getBoundingClientRect();
  window.scrollTo({
    top: window.scrollY + box.top + mark.y * box.height - 120,
    behavior: "smooth",
  });
}

export function MarkFilterBar({
  marks,
  filter,
  t,
  onGo,
}: {
  marks: Mark[];
  filter: ReturnType<typeof useMarkFilter>;
  t: Dictionary;
  /** Zavolá se se značkou, na kterou se má přejít. */
  onGo: (mark: Mark) => void;
}) {
  // Nabízí se jen druhy, které se ve verzi opravdu vyskytují, pevné
  // v obvyklém pořadí a za nimi ruční.
  const pocty = new Map<string, number>();
  for (const mark of marks) {
    for (const key of parseCategories(mark.category)) pocty.set(key, (pocty.get(key) ?? 0) + 1);
  }
  const druhy = [
    ...CATEGORY_KEYS.filter((key) => pocty.has(key)),
    ...[...pocty.keys()].filter((key) => !CATEGORY_KEYS.includes(key as (typeof CATEGORY_KEYS)[number])),
  ];

  if (marks.length === 0) return null;

  const { selected, toggle, matching, index, step } = filter;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div role="group" aria-label={t.filterByType} className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={selected.length === 0}
          onClick={() => toggle(null)}
          className={`badge-pill ${selected.length === 0 ? "bg-coral text-white" : "hover:bg-mist/50"}`}
        >
          {t.allChanges} ({marks.length})
        </button>
        {druhy.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected.includes(key)}
            onClick={() => toggle(key)}
            className={`badge-pill ${selected.includes(key) ? "bg-coral text-white" : "hover:bg-mist/50"}`}
          >
            {categoryLabel(key, t)} ({pocty.get(key)})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-ink/60">
        <button
          type="button"
          aria-label={t.previousChange}
          disabled={matching.length === 0}
          onClick={() => {
            const mark = step(-1);
            if (mark) onGo(mark);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-haze hover:border-coral disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label={t.nextChange}
          disabled={matching.length === 0}
          onClick={() => {
            const mark = step(1);
            if (mark) onGo(mark);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-haze hover:border-coral disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
        <span>
          {matching.length === 0
            ? t.noChangesOfType
            : `${index >= 0 ? index + 1 : "–"} / ${matching.length}`}
        </span>
      </div>
    </div>
  );
}
