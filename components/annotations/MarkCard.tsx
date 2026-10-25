"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  CATEGORY_KEYS,
  categoryLabel,
  categoryLabels,
  parseCategories,
  serializeCategories,
} from "@/lib/annotations";
import { fill } from "@/lib/format";
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

  return (
    <MarkView
      mark={mark}
      number={number}
      editable={editable}
      dimmed={dimmed}
      t={t}
      onHover={onHover}
      onOpen={onOpen}
      onDelete={onDelete}
    />
  );
}

function MarkView({
  mark,
  number,
  editable,
  dimmed,
  t,
  onHover,
  onOpen,
  onDelete,
}: {
  mark: Mark;
  number: number;
  editable: boolean;
  dimmed: boolean;
  t: Dictionary;
  onHover: (id: string | null) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [originalOpen, setOriginalOpen] = useState(false);
  const labels = categoryLabels(mark.category, t);

  // Cizí změna se čte v jazyce země, která si ji otevřela – poznámka
  // i text pod zvýrazněním (PDF samo zůstává v jazyce originálu).
  // Při úpravách se pracuje vždy s originálem.
  const preklad = editable ? null : (mark.translated ?? null);
  const poznamka = !originalOpen && preklad?.note ? preklad.note : mark.note;
  const citace = preklad?.quote ? (originalOpen ? mark.quote : preklad.quote) : null;

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
        <p className="flex-1 text-sm text-ink">{poznamka}</p>

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

      {citace && (
        <div className="ml-7 mt-2 border-l-2 border-dashed border-coral/50 pl-3">
          <p className="text-xs font-medium text-ink/50">{t.highlightedText}</p>
          <p className="text-sm italic text-ink/80">„{citace}“</p>
        </div>
      )}

      {preklad && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOriginalOpen((open) => !open);
          }}
          className="ml-7 mt-1 text-left text-xs text-ink/40 hover:text-coral"
        >
          {originalOpen
            ? t.showTranslation
            : fill(t.machineTranslatedFrom, { language: jazykOriginalu(preklad.fromLocale, t) })}
        </button>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {labels.length > 0 ? (
          labels.map((label) => (
            <span key={label} className="badge-pill">
              {label}
            </span>
          ))
        ) : (
          <span className="badge-pill text-ink/40">{t.noCategory2}</span>
        )}
      </div>
    </div>
  );
}

function jazykOriginalu(locale: string, t: Dictionary): string {
  if (locale === "sk") return t.langSk;
  if (locale === "en") return t.langEn;
  if (locale === "hu") return t.langHu;
  return t.langCs;
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
  // Druhů změny může být víc. Vlastní (ruční) je všechno, co není
  // z pevné nabídky – smí být nejvýš jeden a stojí vedle vybraných.
  const puvodni = parseCategories(mark.category);
  const jePevny = (key: string) => CATEGORY_KEYS.includes(key as (typeof CATEGORY_KEYS)[number]);
  const puvodniVlastni = puvodni.find((key) => !jePevny(key)) ?? "";
  const [categories, setCategories] = useState<string[]>(puvodni.filter(jePevny));
  const [customOpen, setCustomOpen] = useState(puvodniVlastni !== "");
  const [custom, setCustom] = useState(puvodniVlastni);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Návrh druhu změny: chvíli po dopsání poznámky ho appka předvybere.
  // Jen dokud si editor druh nevybral sám – jeho volbu nikdy nepřepíše.
  const categoryTouched = useRef(mark.category !== null);
  const [suggested, setSuggested] = useState<string[]>([]);
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
      if (!navrh.value || navrh.value.length === 0) return;
      setCategories(navrh.value);
      setSuggested(navrh.value);
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [note, mark.quote]);

  function chosenCategory(): string | null {
    return serializeCategories([...categories, ...(customOpen ? [custom] : [])]);
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
            aria-pressed={categories.includes(key)}
            onClick={() => {
              categoryTouched.current = true;
              setSuggested([]);
              setCategories((current) =>
                current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
              );
            }}
            className={`badge-pill ${categories.includes(key) ? "bg-coral text-white" : ""}`}
          >
            {categoryLabel(key, t)}
            {suggested.includes(key) && categories.includes(key) && (
              <span className="ml-1 text-[10px] font-normal opacity-80">✦ {t.aiSuggested}</span>
            )}
          </button>
        ))}

        <button
          type="button"
          aria-pressed={customOpen}
          onClick={() => {
            categoryTouched.current = true;
            setSuggested([]);
            setCustomOpen((open) => !open);
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
