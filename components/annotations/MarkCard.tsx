"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { CATEGORY_KEYS, categoryLabel } from "@/lib/annotations";
import type { Mark } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { suggestMarkCategory } from "@/app/admin/upload/suggest-actions";

// Jak dlouho po posledním úhozu do poznámky se appka zeptá na návrh druhu.
const SUGGEST_DEBOUNCE_MS = 1200;

// Kartička jednoho označeného místa v pravém panelu. Kliknutím kamkoli
// na kartičku se otevře k psaní – tužka na to není potřeba.
export function MarkCard({
  mark,
  number,
  editable,
  editing,
  dimmed,
  t,
  onHover,
  onOpen,
  onDelete,
  onSubmit,
  onCancel,
}: {
  mark: Mark;
  number: number;
  editable: boolean;
  editing: boolean;
  dimmed: boolean;
  t: Dictionary;
  onHover: (id: string | null) => void;
  /** Klik na kartičku: u editora otevře psaní, u čtenáře odroluje dokument. */
  onOpen: () => void;
  onDelete: () => void;
  onSubmit: (note: string, category: string | null) => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <MarkEditor
        mark={mark}
        number={number}
        t={t}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
  }

  const label = categoryLabel(mark.category, t);

  return (
    <div
      onMouseEnter={() => onHover(mark.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onOpen}
      className={`cursor-pointer rounded-xl border border-haze p-3 transition-opacity ${
        dimmed ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral text-[10px] font-semibold text-white">
          {number}
        </span>
        <p className="flex-1 text-sm text-ink">{mark.note}</p>

        {editable && (
          <button
            type="button"
            aria-label={t.delete}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="shrink-0 text-ink/40 hover:text-coral"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <span className={`badge-pill mt-2 ${label ? "" : "text-ink/40"}`}>
        {label ?? t.noCategory2}
      </span>
    </div>
  );
}

// Psaní popisu. Bez popisu se značka při zavření zahodí.
function MarkEditor({
  mark,
  number,
  t,
  onSubmit,
  onCancel,
}: {
  mark: Mark;
  number: number;
  t: Dictionary;
  onSubmit: (note: string, category: string | null) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(mark.note);
  // Vlastní kategorie je všechno, co není z pevné nabídky.
  const isCustom =
    mark.category !== null && !CATEGORY_KEYS.includes(mark.category as (typeof CATEGORY_KEYS)[number]);
  const [category, setCategory] = useState<string | null>(isCustom ? null : mark.category);
  const [customOpen, setCustomOpen] = useState(isCustom);
  const [custom, setCustom] = useState(isCustom ? mark.category ?? "" : "");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Návrh druhu změny: chvíli po dopsání poznámky ho appka předvybere.
  // Jen dokud si editor druh nevybral sám – jeho volbu nikdy nepřepíše.
  const categoryTouched = useRef(mark.category !== null);
  const [suggested, setSuggested] = useState<string | null>(null);
  useEffect(() => {
    if (categoryTouched.current || note.trim().length < 8) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const navrh = await suggestMarkCategory(note, mark.quote ?? null).catch(() => ({
        value: null,
        reason: "network",
      }));
      if (cancelled || categoryTouched.current) return;
      // Nepovedený návrh štítku se nehlásí – editor si štítek vybere sám.
      if (!navrh.value) return;
      setCustomOpen(false);
      setCategory(navrh.value);
      setSuggested(navrh.value);
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [note, mark.quote]);

  function chosenCategory(): string | null {
    if (customOpen) return custom.trim() || null;
    return category;
  }

  // Kliknutí na jinou kartičku tuhle zavře – rozepsaný popis se přitom
  // nesmí ztratit, proto se při zavření sám uloží (a bez popisu zahodí).
  const closing = useRef(false);
  const latest = useRef({ note, category: chosenCategory(), onSubmit, onCancel });
  latest.current = { note, category: chosenCategory(), onSubmit, onCancel };

  // Uložení se odkládá o jeden takt. React ve vývojovém režimu efekty
  // schválně jednou "odmountuje" a hned namountuje zpátky – bez odkladu
  // by se čerstvě nakreslená značka rovnou zase zahodila.
  const pending = useRef<number | null>(null);
  useEffect(() => {
    if (pending.current !== null) {
      window.clearTimeout(pending.current);
      pending.current = null;
    }

    return () => {
      if (closing.current) return;
      pending.current = window.setTimeout(() => {
        const current = latest.current;
        if (current.note.trim()) current.onSubmit(current.note.trim(), current.category);
        else current.onCancel();
      }, 0);
    };
  }, []);

  // Záměrně <div>, ne <form>: kartička se zobrazuje i uvnitř formuláře
  // pro nahrání verze a vnořené formuláře HTML nedovoluje.
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          closing.current = true;
          onCancel();
        }
      }}
      className="rounded-xl border border-coral p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[10px] font-semibold text-white">
          {number}
        </span>
        <span className="text-sm font-medium text-ink">{t.whatChangedHere}</span>
      </div>

      <textarea
        ref={inputRef}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        className="input w-full"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {CATEGORY_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              categoryTouched.current = true;
              setSuggested(null);
              setCustomOpen(false);
              setCategory(category === key ? null : key);
            }}
            className={`badge-pill ${category === key && !customOpen ? "bg-coral text-white" : ""}`}
          >
            {categoryLabel(key, t)}
            {suggested === key && category === key && !customOpen && (
              <span className="ml-1 text-[10px] font-normal opacity-80">✦ {t.aiSuggested}</span>
            )}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            categoryTouched.current = true;
            setSuggested(null);
            setCustomOpen((open) => !open);
            setCategory(null);
          }}
          className={`badge-pill ${customOpen ? "bg-coral text-white" : ""}`}
        >
          {t.otherCategory}
        </button>
      </div>

      {customOpen && (
        <input
          type="text"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder={t.otherCategoryPlaceholder}
          className="input mt-2 w-full"
        />
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!note.trim()}
          onClick={() => {
            closing.current = true;
            if (note.trim()) onSubmit(note.trim(), chosenCategory());
          }}
          className="rounded-xl bg-coral px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {t.done}
        </button>
        <button
          type="button"
          onClick={() => {
            closing.current = true;
            onCancel();
          }}
          className="rounded-xl px-3 py-1.5 text-sm text-ink/60 hover:bg-haze"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
