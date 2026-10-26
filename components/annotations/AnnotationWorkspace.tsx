"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Eye, EyeOff } from "lucide-react";
import { MarkLayer } from "@/components/annotations/MarkLayer";
import { MarkCard } from "@/components/annotations/MarkCard";
import { MarkFilterBar, scrollToMarkPosition, useMarkFilter } from "@/components/annotations/MarkFilter";
import { numberMarks, sortMarks } from "@/lib/annotations";
import { fill } from "@/lib/format";
import type { Mark } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { textInRect, type PdfTextItem, type PdfViewport } from "@/lib/pdf-quote";

const PdfViewer = dynamic(
  () => import("@/components/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false }
);

type Rect = { x: number; y: number; w: number; h: number };

// Dokument se značkami vlevo a panel s popisy vpravo. Používá se stejně
// při nahrávání nové verze i na detailu už uložené verze.
export function AnnotationWorkspace({
  fileId,
  driveUrl,
  marks,
  setMarks,
  editable,
  t,
  panelFooter,
  formColumn,
  documentHeader,
  focusMarkId,
  onFirstPageText,
  onPdfLoad,
  onPdfError,
}: {
  /** Null, dokud uživatel nevloží platný odkaz na Drive. */
  fileId: string | null;
  driveUrl: string;
  marks: Mark[];
  setMarks: (update: (current: Mark[]) => Mark[]) => void;
  editable: boolean;
  t: Dictionary;
  /** Shrnutí a tlačítko pro uložení – liší se podle obrazovky. */
  panelFooter?: ReactNode;
  /** Formulář v pravém panelu nad změnami (obrazovka nahrávání nové verze). */
  formColumn?: ReactNode;
  /** Obsah nad dokumentem, např. seznam verzí. */
  documentHeader?: ReactNode;
  /** Značka, na kterou se má hned po otevření odrolovat a zvýraznit ji. */
  focusMarkId?: string;
  /** Text první strany – podle něj appka pozná, o kterou metodiku jde. */
  onFirstPageText?: (text: string) => void;
  /** PDF se úspěšně načetlo (obrazovka nahrávání to ukazuje v hlavičce). */
  onPdfLoad?: () => void;
  /** PDF se načíst nepodařilo. */
  onPdfError?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(focusMarkId ?? null);
  const [hidden, setHidden] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: Mark } | null>(null);
  // Značky, které ještě nemají popis – když se editace zruší, zahodí se.
  const draftIds = useRef<Set<string>>(new Set());

  const numbers = numberMarks(marks);
  // Při čtení (ne při úpravách) jde značky filtrovat podle druhu změny.
  const filter = useMarkFilter(marks);
  const mutedIds = editable ? undefined : filter.mutedIds;
  const sorted = sortMarks(marks);
  const bezPopisu = marks.filter((mark) => !mark.note.trim()).length;

  const showToast = useCallback((text: string, undo?: Mark) => {
    setToast({ text, undo });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const restore = useCallback(
    (mark: Mark) => {
      setMarks((current) => [...current, mark]);
      setToast(null);
    },
    [setMarks]
  );

  // Text pod značkou: přečte se při nakreslení a při každém posunu nebo
  // změně velikosti. Uložené značky, které text už mají, se nepřepočítávají,
  // ať pouhé otevření dokumentu nevypadá jako úprava.
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const pageTexts = useRef(
    new Map<number, Promise<{ items: PdfTextItem[]; viewport: PdfViewport }>>()
  );
  const quotedRects = useRef(new Map<string, string>());

  useEffect(() => {
    if (!pdf || !editable) return;

    for (const mark of marks) {
      const key = `${mark.page}:${mark.x}:${mark.y}:${mark.w}:${mark.h}`;
      const known = quotedRects.current.get(mark.id);
      if (known === key) continue;
      quotedRects.current.set(mark.id, key);
      if (known === undefined && mark.quote !== undefined) continue;

      let page = pageTexts.current.get(mark.page);
      if (!page) {
        page = pdf.getPage(mark.page + 1).then(async (p) => {
          const items: PdfTextItem[] = [];
          for (const item of (await p.getTextContent()).items) {
            if ("str" in item) items.push(item);
          }
          return { items, viewport: p.getViewport({ scale: 1 }) };
        });
        pageTexts.current.set(mark.page, page);
      }

      page
        .then(({ items, viewport }) => textInRect(items, viewport, mark))
        .catch(() => "")
        .then((quote) => {
          // Mezitím se značka mohla znovu posunout; pak platí novější výsledek.
          if (quotedRects.current.get(mark.id) !== key) return;
          setMarks((current) =>
            current.map((item) => (item.id === mark.id ? { ...item, quote } : item))
          );
        });
    }
  }, [pdf, editable, marks, setMarks]);

  // Otevření na konkrétní značce (příchod ze seznamu změn od ostatních zemí).
  // Čeká se na vykreslení stránky PDF, dřív není kam rolovat.
  const focused = useRef(false);
  useEffect(() => {
    if (!focusMarkId || focused.current) return;
    const mark = marks.find((item) => item.id === focusMarkId);
    if (!mark) return;

    const timer = window.setInterval(() => {
      const page = document.getElementById(`pdf-page-${mark.page}`);
      if (!page) return;
      window.clearInterval(timer);
      focused.current = true;
      page.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);

    return () => window.clearInterval(timer);
  }, [focusMarkId, marks]);

  // Ctrl+Z / Cmd+Z vrátí smazanou značku.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && toast?.undo) {
        event.preventDefault();
        restore(toast.undo);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toast, restore]);

  function handleCreate(page: number, rect: Rect) {
    const id = `new-${crypto.randomUUID()}`;
    draftIds.current.add(id);
    setMarks((current) => [...current, { id, page, ...rect, note: "", category: null }]);
    setEditingId(id);
  }

  function handleUpdate(id: string, rect: Rect) {
    setMarks((current) =>
      current.map((mark) => (mark.id === id ? { ...mark, ...rect } : mark))
    );
  }

  function handleDelete(id: string) {
    const mark = marks.find((m) => m.id === id);
    setMarks((current) => current.filter((m) => m.id !== id));
    if (editingId === id) setEditingId(null);
    if (mark) showToast(t.markDeleted, mark);
  }

  function handleSubmitNote(id: string, note: string, category: string | null) {
    draftIds.current.delete(id);
    setMarks((current) =>
      current.map((mark) => (mark.id === id ? { ...mark, note, category } : mark))
    );
    setEditingId(null);
  }

  function handleCancelNote(id: string) {
    setEditingId(null);
    // Nová značka bez popisu se zahodí, u už popsané se jen zavře úprava.
    if (draftIds.current.has(id)) {
      draftIds.current.delete(id);
      setMarks((current) => current.filter((mark) => mark.id !== id));
      showToast(t.markDiscarded);
    }
  }

  // Klik na značku i na kartičku otevře psaní popisu; čtenáři jen odroluje
  // dokument na dané místo.
  function openMark(id: string) {
    const mark = marks.find((item) => item.id === id);
    if (!mark) return;
    if (editable) setEditingId(id);
    else scrollToMark(mark);
  }

  function scrollToMark(mark: Mark) {
    document.getElementById(`pdf-page-${mark.page}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // Ukázka gesta se přehraje jen tehdy, když ještě nic označeného není.
  const showDemo = editable && !hidden && marks.length === 0;

  // Dokument uprostřed, panel jen vpravo. Při nahrávání stojí formulář
  // (metodika, země, odkaz) v pravém panelu nahoře nad vyznačenými změnami:
  // dokument zabírá obě řady vlevo, formulář a seznam změn jsou pod sebou
  // vpravo. Na úzkém displeji jde všechno pod sebe v pořadí formulář,
  // dokument, změny – nejdřív je potřeba vyplnit, co se nahrává.
  //
  // min-w-0 na buňkách: položka mřížky se jinak nesmrští pod šířku
  // svého obsahu (PDF, dlouhý název) a stránka se roluje do strany.
  const gridClass = formColumn
    ? "grid grid-cols-1 gap-6 [&>*]:min-w-0 doc:grid-cols-[minmax(0,1fr)_380px] doc:grid-rows-[auto_1fr]"
    : "grid grid-cols-1 gap-6 [&>*]:min-w-0 doc:grid-cols-[minmax(0,1fr)_340px]";

  return (
    <div className={gridClass}>
      {formColumn && (
        <div className="rounded-2xl border-2 border-coral bg-white p-5 doc:col-start-2 doc:row-start-1">
          {formColumn}
        </div>
      )}

      <div
        className={
          formColumn
            ? "rounded-2xl bg-haze/30 p-3 doc:col-start-1 doc:row-span-2 doc:row-start-1 doc:p-6"
            : undefined
        }
      >
        <div className={formColumn ? "mx-auto max-w-3xl" : undefined}>
        {documentHeader}

        {fileId !== null && (
        <div className="mb-2 flex items-center justify-between gap-4 rounded-xl bg-haze/40 px-3 py-2">
          <p className="text-xs text-ink/60">{editable ? t.annotateHint : t.changesPanelTitle}</p>
          <button
            type="button"
            onClick={() => setHidden((value) => !value)}
            className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-ink"
          >
            {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
            {hidden ? t.showMarks : t.hideMarks}
          </button>
        </div>
        )}

        {fileId === null ? (
          <div className="flex items-center justify-center rounded-xl bg-haze/30 px-6 py-16 text-center">
            <p className="text-sm text-ink/50">{t.pasteLinkToSeeDocument}</p>
          </div>
        ) : (
        <PdfViewer
          src={`/api/pdf/${fileId}`}
          driveUrl={driveUrl}
          t={t}
          onFirstPageText={onFirstPageText}
          onDocumentLoad={(document) => {
            setPdf(document);
            onPdfLoad?.();
          }}
          onLoadError={onPdfError}
          renderPageOverlay={(pageIndex) => (
            <MarkLayer
              marks={marks.filter((mark) => mark.page === pageIndex)}
              numbers={numbers}
              editable={editable}
              hidden={hidden}
              hoveredId={hoveredId}
              mutedIds={mutedIds}
              showDemo={showDemo && pageIndex === 0}
              t={t}
              onCreate={(rect) => handleCreate(pageIndex, rect)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onHover={setHoveredId}
              onOpen={openMark}
            />
          )}
        />
        )}
        </div>
      </div>

      {/* Buňka mřížky se roztáhne na výšku dokumentu, lepkavý je až panel
          uvnitř – jinak by neměl kam "cestovat" a při rolování by zmizel. */}
      <div className={formColumn ? "doc:col-start-2 doc:row-start-2" : undefined}>
      <aside className="rounded-2xl border border-haze p-5 doc:sticky doc:top-8 doc:max-h-[calc(100vh-4rem)] doc:overflow-y-auto">
        {/* Při nahrávání nadpis s počtem rámečků a kolik z nich ještě nemá popis. */}
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-bold text-ink">
            {editable ? t.markedChangesTitle : t.changesPanelTitle}
          </h2>
          {editable && marks.length > 0 && (
            <span className="shrink-0 text-xs text-ink/50">
              {marks.length}
              {bezPopisu > 0 && ` · ${fill(t.withoutNoteCount, { count: bezPopisu })}`}
            </span>
          )}
        </div>

        {!editable && (
          <MarkFilterBar
            marks={marks}
            filter={filter}
            t={t}
            onGo={(mark) => {
              // Jen odrolovat – viz VersionBrowser.
              scrollToMarkPosition(mark);
            }}
          />
        )}

        {sorted.length === 0 ? (
          // Při nahrávání stačí nápověda pod seznamem.
          !editable && <p className="mt-2 text-sm text-ink/50">{t.changesPanelEmpty}</p>
        ) : editable ? (
          // Při nahrávání jeden seznam – stránku nese každá kartička sama.
          <div className="mt-3 flex flex-col gap-2">
            {sorted.map((mark) => (
              <MarkCard
                key={mark.id}
                mark={mark}
                number={numbers[mark.id]}
                editable
                editing={editingId === mark.id}
                dimmed={hoveredId !== null && hoveredId !== mark.id}
                t={t}
                onHover={setHoveredId}
                onOpen={() => openMark(mark.id)}
                onDelete={() => handleDelete(mark.id)}
                onSubmit={(note, category) => handleSubmitNote(mark.id, note, category)}
                onCancel={() => handleCancelNote(mark.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {groupByPage(sorted).map(([page, pageMarks]) => (
              <div key={page}>
                <p className="mb-2 text-xs font-semibold text-ink/50">
                  {t.pageLabel} {page + 1}
                </p>
                <div className="flex flex-col gap-2">
                  {pageMarks.map((mark) => (
                    <MarkCard
                      key={mark.id}
                      mark={mark}
                      number={numbers[mark.id]}
                      editable={editable}
                      editing={editingId === mark.id}
                      dimmed={
                        (hoveredId !== null && hoveredId !== mark.id) ||
                        Boolean(mutedIds?.has(mark.id))
                      }
                      t={t}
                      onHover={setHoveredId}
                      onOpen={() => openMark(mark.id)}
                      onDelete={() => handleDelete(mark.id)}
                      onSubmit={(note, category) => handleSubmitNote(mark.id, note, category)}
                      onCancel={() => handleCancelNote(mark.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {panelFooter && <div className="dashed-divider mt-5 pt-4">{panelFooter}</div>}
      </aside>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
          {toast.text}
          {toast.undo && (
            <button
              type="button"
              onClick={() => restore(toast.undo!)}
              className="font-medium text-mist hover:underline"
            >
              {t.undo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function groupByPage(marks: Mark[]): [number, Mark[]][] {
  const groups = new Map<number, Mark[]>();
  for (const mark of marks) {
    groups.set(mark.page, [...(groups.get(mark.page) ?? []), mark]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}
