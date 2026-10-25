"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  discardDraft,
  ensureDraftVersion,
  publishVersion,
  saveDraftMarks,
  type PublishState,
} from "@/app/admin/upload/actions";
import { AnnotationWorkspace } from "@/components/annotations/AnnotationWorkspace";
import { ModulePicker } from "@/components/ModulePicker";
import { matchModule, type MatchResult } from "@/lib/match-module";
import { driveViewUrl, extractDriveFileId } from "@/lib/drive";
import { fill, formatDateTime } from "@/lib/format";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DOCUMENT_KINDS, type Country, type DocumentKind, type Mark, type Module } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { suggestVersionSummary } from "@/app/admin/upload/suggest-actions";

export type LatestVersion = {
  module_id: string;
  country_id: string;
  kind: DocumentKind;
  version_number: number;
  uploaded_at: string;
  uploaded_by_email: string | null;
};

// Rozpracovaná verze, kterou uživatel nechal rozdělanou při minulé návštěvě.
export type ExistingDraft = {
  id: string;
  module_id: string;
  country_id: string;
  kind: DocumentKind;
  file_url: string;
  saved_at: string;
  marks: Mark[];
};

// Jak dlouho po posledním úhozu se začne načítat náhled.
const LINK_DEBOUNCE_MS = 500;
// Jak dlouho po poslední změně značek se ukládá na server.
const MARKS_DEBOUNCE_MS = 800;

export function UploadWorkspace({
  modules,
  countries,
  defaultCountryId,
  canChooseCountry,
  latestVersions,
  existingDraft,
  t,
}: {
  modules: Module[];
  countries: Country[];
  defaultCountryId: string | null;
  canChooseCountry: boolean;
  latestVersions: LatestVersion[];
  existingDraft: ExistingDraft | null;
  t: Dictionary;
}) {
  // Dokud se uživatel nerozhodne, co s rozdělanou prací, nic nezobrazujeme.
  const [draftChoice, setDraftChoice] = useState<"ask" | "continue" | "fresh">(
    existingDraft ? "ask" : "fresh"
  );
  const [zahoditOtevreno, setZahoditOtevreno] = useState(false);
  // Záměrně prázdné: metodiku buď rozpozná appka, nebo ji vybere uživatel.
  const [moduleId, setModuleId] = useState("");
  const [countryId, setCountryId] = useState(defaultCountryId ?? "");
  // Metodika, nebo prezentace k lekci – verzují se každá zvlášť.
  const [kind, setKind] = useState<DocumentKind>("methodology");
  const [driveLink, setDriveLink] = useState("");
  const [linkForPreview, setLinkForPreview] = useState("");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [summary, setSummary] = useState("");
  const [navrhuji, setNavrhuji] = useState(false);
  const [navrhSelhal, setNavrhSelhal] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  // Podklady pro rozpoznání metodiky z nahrávaného dokumentu.
  const [firstPageText, setFirstPageText] = useState("");
  const [fileName, setFileName] = useState("");
  const [recognition, setRecognition] = useState<MatchResult | null>(null);
  // Jakmile si uživatel metodiku vybere sám, rozpoznávání ji už nepřepisuje.
  const moduleTouched = useRef(false);
  const [saveState, setSaveState] = useState<{ saving: boolean; savedAt: string | null; error?: string }>(
    { saving: false, savedAt: null }
  );

  // Navázání na rozdělanou práci. Musí se dít tady, ne v počátečních
  // hodnotách stavu – ty se podruhé nespustí a odkaz na dokument by
  // zůstal prázdný.
  function continueDraft(draft: ExistingDraft) {
    moduleTouched.current = true;
    setModuleId(draft.module_id);
    setCountryId(draft.country_id);
    setKind(draft.kind);
    setDriveLink(draft.file_url);
    setLinkForPreview(draft.file_url);
    setMarks(draft.marks);
    setDraftId(draft.id);
    setSaveState({ saving: false, savedAt: draft.saved_at });
    setDraftChoice("continue");
  }

  const [state, formAction, isPending] = useActionState<PublishState, FormData>(
    publishVersion,
    null
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setLinkForPreview(driveLink), LINK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [driveLink]);

  const fileId = extractDriveFileId(linkForPreview);

  // Název souboru na Drive bývá pro rozpoznání výmluvnější než text uvnitř.
  useEffect(() => {
    if (!fileId) {
      setFileName("");
      setFirstPageText("");
      setRecognition(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/pdf/${fileId}/name`)
      .then((response) => (response.ok ? response.json() : { name: null }))
      .then((data: { name: string | null }) => {
        if (!cancelled) setFileName(data.name ?? "");
      })
      .catch(() => {
        // Rozpoznávání je jen pomůcka, bez názvu souboru se obejde.
      });

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  useEffect(() => {
    if (!firstPageText && !fileName) return;

    const result = matchModule(modules, firstPageText, fileName);
    setRecognition(result);
    if (result.kind === "match" && !moduleTouched.current) {
      setModuleId(result.best.moduleId);
    }
  }, [modules, firstPageText, fileName]);

  // Jakmile je vyplněný modul, země a platný odkaz, založí se na pozadí
  // rozpracovaná verze, ke které se pak průběžně ukládají značky.
  useEffect(() => {
    if (!fileId || !moduleId || !countryId || draftChoice === "ask") return;
    let cancelled = false;

    (async () => {
      const result = await ensureDraftVersion(moduleId, countryId, linkForPreview, kind);
      if (cancelled) return;
      if ("error" in result) setSaveState((s) => ({ ...s, error: result.error }));
      else setDraftId(result.draftId);
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, moduleId, countryId, linkForPreview, draftChoice, kind]);

  // Průběžné ukládání značek. Posun a zvětšování vyvolá spoustu změn za sebou,
  // proto se ukládá až chvíli po té poslední.
  const firstRun = useRef(true);
  useEffect(() => {
    if (!draftId) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    setSaveState((s) => ({ ...s, saving: true, error: undefined }));
    const timer = window.setTimeout(async () => {
      const result = await saveDraftMarks(draftId, marks);
      setSaveState(
        "error" in result
          ? { saving: false, savedAt: null, error: result.error }
          : { saving: false, savedAt: result.savedAt }
      );
    }, MARKS_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [marks, draftId]);

  const latest = latestVersions.find(
    (version) =>
      version.module_id === moduleId && version.country_id === countryId && version.kind === kind
  );
  const countryName = countries.find((country) => country.id === countryId)?.name ?? "";
  const canPublish = Boolean(draftId) && (marks.length > 0 || summary.trim().length > 0);

  if (draftChoice === "ask" && existingDraft) {
    const draftModule = modules.find((m) => m.id === existingDraft.module_id)?.name ?? "";
    const draftCountry = countries.find((c) => c.id === existingDraft.country_id)?.name ?? "";

    return (
      <div className="max-w-xl rounded-2xl border border-coral p-5">
        <p className="text-sm text-ink">
          {fill(t.draftFound, {
            module: draftModule,
            country: draftCountry,
            time: formatDateTime(existingDraft.saved_at, t.dateLocale, "UTC"),
          })}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => continueDraft(existingDraft)}
            className="rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white"
          >
            {t.continueDraft}
          </button>
          <button
            type="button"
            onClick={() => setZahoditOtevreno(true)}
            className="rounded-xl px-4 py-2 text-sm text-ink/60 hover:bg-haze"
          >
            {t.startOver}
          </button>
        </div>

        <ConfirmDialog
          open={zahoditOtevreno}
          title={t.confirmDiscardDraftTitle}
          explanation={t.confirmDiscardDraftExplain}
          confirmLabel={t.confirmDiscardYes}
          cancelLabel={t.cancel}
          closeLabel={t.close}
          onCancel={() => setZahoditOtevreno(false)}
          onConfirm={async () => {
            setZahoditOtevreno(false);
            await discardDraft(existingDraft.id);
            setDraftChoice("fresh");
          }}
        >
          <p className="text-sm font-medium text-ink">
            {draftModule} / {draftCountry}
          </p>
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="draftId" value={draftId ?? ""} />
      <input type="hidden" name="knownLatest" value={latest?.version_number ?? 0} />

      <AnnotationWorkspace
        fileId={fileId}
        driveUrl={fileId ? driveViewUrl(`https://drive.google.com/file/d/${fileId}/preview`) : ""}
        marks={marks}
        setMarks={setMarks}
        editable
        onFirstPageText={setFirstPageText}
        t={t}
        formColumn={
          <div className="flex flex-col gap-4">
            {/* Schválně ne <Field> – stejně jako u výběru země níž. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t.kindQuestion}</span>
              <div role="group" aria-label={t.kindQuestion} className="flex flex-wrap gap-2">
                {DOCUMENT_KINDS.map((druh) => (
                  <button
                    key={druh}
                    type="button"
                    onClick={() => setKind(druh)}
                    aria-pressed={druh === kind}
                    className={`badge-pill ${druh === kind ? "bg-coral text-white" : "hover:bg-mist/50"}`}
                  >
                    {druh === "presentation" ? t.kindPresentation : t.kindMethodology}
                  </button>
                ))}
              </div>
              {kind === "presentation" && (
                <span className="text-xs text-ink/50">{t.kindHint}</span>
              )}
            </div>

            <Field label={t.module}>
              <ModulePicker
                modules={modules}
                value={moduleId}
                onChange={(id) => {
                  moduleTouched.current = true;
                  setModuleId(id);
                }}
                recognition={recognition}
                t={t}
              />
            </Field>

            {/* Nabízejí se jen vlastní země. S jedinou zemí není co vybírat,
                takže místo pole stojí jen věta, za koho se nahrává. */}
            <input type="hidden" name="countryId" value={countryId} />
            {canChooseCountry ? (
              // Schválně ne <Field>: ten vykresluje <label>, a popisek
              // obalující skupinu tlačítek se plete do jejich názvu
              // pro odečítače obrazovky („Země Velká Británie").
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">{t.uploadForWhichCountry}</span>
                <span className="text-xs text-ink/50">{t.uploadForWhichCountryHint}</span>
                <div role="group" aria-label={t.uploadForWhichCountry} className="flex flex-wrap gap-2">
                  {countries.map((country) => (
                    <button
                      key={country.id}
                      type="button"
                      onClick={() => setCountryId(country.id)}
                      aria-pressed={country.id === countryId}
                      className={`badge-pill ${
                        country.id === countryId
                          ? "bg-coral text-white"
                          : "hover:bg-mist/50"
                      }`}
                    >
                      {country.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium text-ink">
                {countryName
                  ? fill(t.uploadingFor, { country: countryName })
                  : t.noCountryForUpload}
              </p>
            )}

            <p className="rounded-xl bg-haze/40 p-3 text-xs text-ink/70">
              {latest
                ? fill(t.existingVersionInfo, {
                    country: countryName,
                    version: latest.version_number,
                    when: formatDateTime(latest.uploaded_at, t.dateLocale, "UTC"),
                    who: latest.uploaded_by_email ?? "?",
                    next: latest.version_number + 1,
                  })
                : fill(t.firstVersionInfo, { country: countryName })}
            </p>

            <Field label={t.driveLink} help={t.driveLinkHelp}>
              <input
                type="text"
                name="driveLink"
                required
                value={driveLink}
                onChange={(event) => setDriveLink(event.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="input"
              />
            </Field>
          </div>
        }
        panelFooter={
          <div className="flex flex-col gap-3">
            <Field label={t.summaryOptional}>
              <textarea
                name="note"
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder={t.whatChangedPlaceholder}
                className="input"
              />
            </Field>
            {/* Návrh shrnutí z poznámek u značek – předvyplní pole, uloží
                se ale až to, co v něm editor nechá. */}
            {marks.some((mark) => mark.note.trim()) && (
              <div className="-mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={navrhuji}
                  onClick={async () => {
                    setNavrhuji(true);
                    setNavrhSelhal(false);
                    const navrh = await suggestVersionSummary(
                      marks.map((mark) => mark.note),
                      t.locale
                    ).catch(() => null);
                    if (navrh) setSummary(navrh);
                    else setNavrhSelhal(true);
                    setNavrhuji(false);
                  }}
                  className="badge-pill hover:bg-mist/50 disabled:opacity-50"
                >
                  ✦ {navrhuji ? t.suggestingSummary : t.suggestSummary}
                </button>
                {navrhSelhal && <span className="text-xs text-coral">{t.suggestFailed}</span>}
              </div>
            )}

            {/* Stav průběžného ukládání rozpracované verze. */}
            <p id="draft-status" className="text-xs text-ink/50">
              {saveState.error
                ? saveState.error
                : saveState.saving
                  ? t.savingDraft
                  : saveState.savedAt
                    ? fill(t.draftSaved, {
                        time: new Date(saveState.savedAt).toLocaleTimeString(t.dateLocale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })
                    : ""}
            </p>

            <button
              type="submit"
              disabled={isPending || !canPublish}
              className="rounded-xl bg-coral px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? t.saving : `${t.uploadAndNotify} (${marks.length})`}
            </button>

            {state && "error" in state && <p className="text-sm text-coral">{state.error}</p>}

            {state && "warning" in state && (
              <div className="rounded-xl border border-coral p-3 text-sm">
                <p className="text-ink">
                  {fill(t.concurrentWarning, {
                    version: state.warning.otherVersion,
                    who: state.warning.otherAuthor,
                    when: formatDateTime(state.warning.otherUploadedAt, t.dateLocale, "UTC"),
                    saved: state.warning.savedVersion,
                  })}
                </p>
                <Link
                  href={`/modules/${state.warning.moduleId}?country=${state.warning.countryId}`}
                  className="mt-2 inline-block font-medium text-coral hover:underline"
                >
                  {t.openThatVersion}
                </Link>
              </div>
            )}
          </div>
        }
      />
    </form>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      {label}
      {children}
      {help && <span className="text-xs font-normal text-ink/50">{help}</span>}
    </label>
  );
}
