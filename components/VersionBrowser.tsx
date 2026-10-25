"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import { MarkLayer } from "@/components/annotations/MarkLayer";
import { MarkCard } from "@/components/annotations/MarkCard";
import { MarkFilterBar, scrollToMarkPosition, useMarkFilter } from "@/components/annotations/MarkFilter";
import { numberMarks, sortMarks } from "@/lib/annotations";
import { driveViewUrl, extractDriveFileId } from "@/lib/drive";
import { fill, pluralCount } from "@/lib/format";
import { LocalDateTime } from "@/components/LocalDateTime";
import { AdminVersionEditor } from "@/components/AdminVersionEditor";
import type { Change, DocumentVersion, Mark } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

const PdfViewer = dynamic(
  () => import("@/components/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false }
);

export type BrowsableVersion = DocumentVersion & {
  changes: Change[];
  uploaded_by_email: string | null;
  unread: boolean;
};

// Přehled zveřejněných verzí. Čistě ke čtení – označovat a upravovat změny
// jde jenom na obrazovce Nahrát.
export function VersionBrowser({
  versions,
  marksByVersion,
  canEdit = false,
  t,
}: {
  /** Seřazené od nejnovější. */
  versions: BrowsableVersion[];
  marksByVersion: Record<string, Mark[]>;
  /** Admin smí cizí nahrávku potichu opravit. */
  canEdit?: boolean;
  t: Dictionary;
}) {
  const [selectedId, setSelectedId] = useState(versions[0]?.id ?? "");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Filtr podle druhu změny platí pro právě otevřenou verzi. Hook musí
  // běžet vždy, proto si značky vybrané verze dohledá ještě před návratem.
  const filter = useMarkFilter(
    marksByVersion[(versions.find((v) => v.id === selectedId) ?? versions[0])?.id ?? ""] ?? []
  );

  if (versions.length === 0) {
    return <p className="text-sm text-ink/50">{t.noVersions}</p>;
  }

  const selected = versions.find((version) => version.id === selectedId) ?? versions[0];
  const selectedIndex = versions.indexOf(selected);
  // Nejbližší starší verze téže země, oproti které se změny popisují.
  const previous = versions[selectedIndex + 1] ?? null;
  const marks = marksByVersion[selected.id] ?? [];
  const numbers = numberMarks(marks);
  const sorted = sortMarks(marks);
  const fileId = extractDriveFileId(selected.file_url);
  const summary = selected.changes[0]?.note ?? "";

  function scrollToMark(mark: Mark) {
    document.getElementById(`pdf-page-${mark.page}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div>
      {/* Záložky verzí, nejnovější vlevo. */}
      <div role="tablist" className="dashed-divider flex flex-wrap gap-1 border-t-0">
        {versions.map((version, index) => (
          <button
            key={version.id}
            type="button"
            role="tab"
            aria-selected={version.id === selected.id}
            onClick={() => setSelectedId(version.id)}
            className={`relative px-4 py-2 text-left ${
              version.id === selected.id ? "border-b-2 border-coral" : "border-b-2 border-transparent"
            }`}
          >
            <span className="block text-sm font-medium text-ink">
              {t.version} {version.version_number}
              {index === 0 && <span className="text-ink/50"> · {t.latest}</span>}
            </span>
            <span className="block text-xs text-ink/40">
              <LocalDateTime value={version.uploaded_at} locale={t.dateLocale} />
            </span>
            {version.unread && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral" />
            )}
          </button>
        ))}
      </div>

      {/* Metadata vybrané verze. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink/60">
        <p>
          {fill(t.uploadedByWho, { who: selected.uploaded_by_email ?? "?" })} ·{" "}
          <LocalDateTime value={selected.uploaded_at} locale={t.dateLocale} /> ·{" "}
          {pluralCount(marks.length, t.markedChangesForms, t.dateLocale)}
        </p>

        <div className="flex items-center gap-4">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="font-medium text-coral hover:underline"
            >
              {editing ? t.adminBackToReading : t.adminEditMode}
            </button>
          )}
          <a
            href={driveViewUrl(selected.file_url)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 font-medium text-coral hover:underline"
          >
            <Download size={16} />
            {t.downloadPdf}
          </a>
        </div>
      </div>

      {canEdit && editing && (
        <div className="mt-5">
          <AdminVersionEditor
            // Přepnutí verze nebo režimu musí editor založit nanovo,
            // jinak by si nechal značky z té předchozí.
            key={selected.id}
            versionId={selected.id}
            fileUrl={selected.file_url}
            initialMarks={marks}
            initialSummary={summary}
            t={t}
          />
        </div>
      )}

      {summary && (
        <p className="mt-2 whitespace-pre-line text-sm text-ink">
          <span className="font-medium">{t.summaryLabel}:</span> {summary}
        </p>
      )}

      {!(canEdit && editing) && (
      <div className="mt-5 grid grid-cols-1 gap-6 [&>*]:min-w-0 doc:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {fileId ? (
            <PdfViewer
              // Přepnutí verze vymění dokument; klíč zajistí, že se načte
              // jen ten vybraný, ne všechny verze najednou.
              key={selected.id}
              src={`/api/pdf/${fileId}`}
              driveUrl={driveViewUrl(selected.file_url)}
              t={t}
              renderPageOverlay={(pageIndex) => (
                <MarkLayer
                  marks={marks.filter((mark) => mark.page === pageIndex)}
                  numbers={numbers}
                  editable={false}
                  hidden={false}
                  hoveredId={hoveredId}
                  mutedIds={filter.mutedIds}
                  showDemo={false}
                  t={t}
                  onCreate={() => {}}
                  onUpdate={() => {}}
                  onDelete={() => {}}
                  onHover={setHoveredId}
                  onOpen={(id) => {
                    const mark = marks.find((item) => item.id === id);
                    if (mark) scrollToMark(mark);
                  }}
                />
              )}
            />
          ) : (
            <p className="text-sm text-ink/50">{t.fileUnavailable}</p>
          )}
        </div>

        <div>
          <aside className="rounded-2xl border border-haze p-5 doc:sticky doc:top-8 doc:max-h-[calc(100vh-4rem)] doc:overflow-y-auto">
            <h2 className="font-heading text-lg font-bold text-ink">
              {previous
                ? fill(t.changesAgainst, { version: previous.version_number })
                : t.firstVersion}
            </h2>

            {previous === null && marks.length === 0 ? (
              <p className="mt-2 text-sm text-ink/50">{t.nothingToCompare}</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-ink/50">
                  {pluralCount(marks.length, t.markedPlacesForms, t.dateLocale)}
                </p>

                <MarkFilterBar
                  marks={marks}
                  filter={filter}
                  t={t}
                  onGo={(mark) => {
                    // Jen odrolovat – zvýraznění jedné značky by upozadilo
                    // i ostatní vybrané a filtr by pak působil zmateně.
                    scrollToMarkPosition(mark);
                  }}
                />

                {sorted.length === 0 ? (
                  <p className="mt-3 text-sm text-ink/50">{t.changesPanelEmpty}</p>
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
                              editable={false}
                              editing={false}
                              dimmed={
                                (hoveredId !== null && hoveredId !== mark.id) ||
                                filter.mutedIds.has(mark.id)
                              }
                              t={t}
                              onHover={setHoveredId}
                              onOpen={() => scrollToMarkPosition(mark)}
                              onDelete={() => {}}
                              onSubmit={() => {}}
                              onCancel={() => {}}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
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
