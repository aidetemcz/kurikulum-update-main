"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
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
import { matchModule, toMatchableModule, type MatchResult } from "@/lib/match-module";
import { driveViewUrl, extractDriveFileId } from "@/lib/drive";
import { fill } from "@/lib/format";
import { useLocalDateTimeFormat } from "@/components/LocalDateTime";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DOCUMENT_KINDS, type Country, type DocumentKind, type Mark, type Module } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { suggestVersionSummary } from "@/app/admin/upload/suggest-actions";
import { suggestFailureMessage } from "@/lib/suggest-message";
import { describedMarks } from "@/lib/draft-marks";
import { moduleName } from "@/lib/module-name";
import { Check } from "lucide-react";

export type LatestVersion = {
  module_id: string;
  country_id: string;
  kind: DocumentKind;
  version_number: number;
  /** Kdy byla verze zveřejněná (u nejstarších verzí kdy byla nahraná). */
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

// Stálý prázdný objekt: nový {} při každém vykreslení by znovu spouštěl
// rozpoznávání lekce.
const BEZ_VLASTNICH_NAZVU: Record<string, Record<string, string>> = {};

export function UploadWorkspace({
  modules,
  localNames = BEZ_VLASTNICH_NAZVU,
  countries,
  defaultCountryId,
  canChooseCountry,
  latestVersions,
  existingDraft,
  t,
}: {
  modules: Module[];
  /** Vlastní názvy metodik podle země: {countryId: {moduleId: název}}. */
  localNames?: Record<string, Record<string, string>>;
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
  const [kind, setKind] = useState<DocumentKind>("teaching_material");
  const [driveLink, setDriveLink] = useState("");
  const [linkForPreview, setLinkForPreview] = useState("");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [summary, setSummary] = useState("");
  const [navrhuji, setNavrhuji] = useState(false);
  // Proč se poslední návrh shrnutí nepovedl; null = nic nehlásit.
  const [navrhSelhal, setNavrhSelhal] = useState<string | null>(null);
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
    // Rámečky právě přišly z databáze, není co ukládat.
    skipNextSave.current = true;
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

  // Časy v místním pásmu uživatele (po načtení v prohlížeči, viz LocalDateTime).
  const casMistne = useLocalDateTimeFormat(t.dateLocale);

  const [state, formAction, isPending] = useActionState<PublishState, FormData>(
    publishVersion,
    null
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setLinkForPreview(driveLink), LINK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [driveLink]);

  const fileId = extractDriveFileId(linkForPreview);
  // Načetlo se PDF z odkazu? Ukazuje se v hlavičce nad dokumentem.
  const [pdfNacteno, setPdfNacteno] = useState(false);
  useEffect(() => setPdfNacteno(false), [fileId]);

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

  // Lekce pro rozpoznávání se všemi jejich názvy; přednost mají názvy
  // v jazyce země, za kterou se nahrává, a její vlastní názvy.
  const jazykZeme = countries.find((country) => country.id === countryId)?.locale ?? "cs";
  const rozpoznatelne = useMemo(
    () =>
      modules.map((module) =>
        toMatchableModule(module, jazykZeme, localNames[countryId]?.[module.id] ?? null)
      ),
    [modules, jazykZeme, localNames, countryId]
  );

  useEffect(() => {
    if (!firstPageText && !fileName) return;

    const result = matchModule(rozpoznatelne, firstPageText, fileName);
    setRecognition(result);
    if (result.kind === "match" && !moduleTouched.current) {
      setModuleId(result.best.moduleId);
    }
  }, [rozpoznatelne, firstPageText, fileName]);

  // Koncept téhle záložky – server podle něj pozná, který koncept má
  // doplnit, a cizí (z jiné záložky) nepřepíše.
  const draftIdRef = useRef<string | null>(null);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  // Jakmile je vyplněný modul, země a platný odkaz, založí se na pozadí
  // rozpracovaná verze, ke které se pak průběžně ukládají značky.
  useEffect(() => {
    if (!fileId || !moduleId || !countryId || draftChoice === "ask") return;
    let cancelled = false;

    (async () => {
      const result = await ensureDraftVersion(
        moduleId,
        countryId,
        linkForPreview,
        kind,
        draftIdRef.current
      );
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
  //
  // Ukládá se i hned po založení konceptu – rámečky nakreslené dřív, než byl
  // vybraný modul a odkaz, by se jinak ztratily. Přeskočí se jen navázání na
  // rozdělanou práci, kde rámečky právě přišly z databáze.
  const skipNextSave = useRef(false);
  // Při zveřejnění se už nic průběžně neukládá: rámečky jdou s formulářem.
  const publishing = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const savingNow = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    if (!draftId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (publishing.current) return;

    setSaveState((s) => ({ ...s, saving: true, error: undefined }));
    const timer = window.setTimeout(() => {
      saveTimer.current = null;
      const ukladani = saveDraftMarks(draftId, marks).then((result) => {
        setSaveState(
          "error" in result
            ? { saving: false, savedAt: null, error: result.error }
            : { saving: false, savedAt: result.savedAt }
        );
      });
      savingNow.current = ukladani;
      ukladani.finally(() => {
        if (savingNow.current === ukladani) savingNow.current = null;
      });
    }, MARKS_DEBOUNCE_MS);
    saveTimer.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (saveTimer.current === timer) saveTimer.current = null;
    };
  }, [marks, draftId]);

  // Zveřejnění: zrušit čekající uložení, počkat na to, které právě běží,
  // a rámečky poslat rovnou s formulářem. Jinak by průběžné uložení mohlo
  // doběhnout až po zveřejnění a přepsat ho.
  async function zverejnit(formData: FormData) {
    publishing.current = true;
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await savingNow.current?.catch(() => {});
    formData.set("marks", JSON.stringify(marks));
    startTransition(() => formAction(formData));
  }

  // Po zveřejnění (i s varováním o souběžné verzi) už koncept neexistuje.
  // Po chybě zůstává koncept konceptem a průběžné ukládání se vrací.
  useEffect(() => {
    if (!state) return;
    publishing.current = false;
    if ("warning" in state) setDraftId(null);
  }, [state]);

  const latest = latestVersions.find(
    (version) =>
      version.module_id === moduleId && version.country_id === countryId && version.kind === kind
  );
  const countryName = countries.find((country) => country.id === countryId)?.name ?? "";
  const lekce = modules.find((module) => module.id === moduleId);
  const vybranaLekce = lekce
    ? moduleName({ ...lekce, local_name: localNames[countryId]?.[lekce.id] ?? null }, t)
    : "";
  // Server rámečky bez poznámky zahazuje, proto se nepočítají ani tady.
  const popsaneRamecky = describedMarks(marks).length;
  // Ostatním zemím přicházejí jednotlivé rámečky, shrnutí jen doplňuje –
  // verze bez rámečku by u nich nebyla vidět, proto jde zveřejnit až s ním.
  const canPublish = Boolean(draftId) && popsaneRamecky > 0;

  if (draftChoice === "ask" && existingDraft) {
    const draftModule = modules.find((m) => m.id === existingDraft.module_id)?.name ?? "";
    const draftCountry = countries.find((c) => c.id === existingDraft.country_id)?.name ?? "";

    return (
      <div className="max-w-xl rounded-2xl border border-coral p-5">
        <p className="text-sm text-ink">
          {fill(t.draftFound, {
            module: draftModule,
            country: draftCountry,
            time: casMistne(existingDraft.saved_at),
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
    <form action={zverejnit}>
      <input type="hidden" name="draftId" value={draftId ?? ""} />
      <input type="hidden" name="knownLatest" value={latest?.version_number ?? 0} />

      {/* Hlavička: co se nahrává – lekce, že se PDF načetlo a jaké číslo
          verze to bude. */}
      {(vybranaLekce || pdfNacteno) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-haze/40 px-4 py-2.5 text-sm">
          {vybranaLekce && <span className="font-semibold text-ink">{vybranaLekce}</span>}
          {pdfNacteno && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <Check size={14} strokeWidth={2.5} />
              {t.pdfLoadedFromDrive}
            </span>
          )}
          {vybranaLekce && countryName && (
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">
              {fill(t.versionWillBe, { country: countryName, date: mesicRok(new Date()) })}
            </span>
          )}
        </div>
      )}

      <AnnotationWorkspace
        fileId={fileId}
        driveUrl={fileId ? driveViewUrl(`https://drive.google.com/file/d/${fileId}/preview`) : ""}
        marks={marks}
        setMarks={setMarks}
        editable
        onFirstPageText={setFirstPageText}
        onPdfLoad={() => setPdfNacteno(true)}
        t={t}
        formColumn={
          <div className="flex flex-col gap-4">
            {/* Odkaz na PDF je nejdůležitější, proto stojí nahoře. */}
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

            {/* Ne <Field>: ten je <label> a klik do nabídky by přesměroval
                na první pole uvnitř – položky by pak nešly vybrat. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t.module}</span>
              <ModulePicker
                modules={modules.map((module) => ({
                  ...module,
                  local_name: localNames[countryId]?.[module.id] ?? null,
                }))}
                value={moduleId}
                onChange={(id) => {
                  moduleTouched.current = true;
                  setModuleId(id);
                }}
                recognition={recognition}
                t={t}
              />
            </div>

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
                    when: casMistne(latest.uploaded_at),
                    who: latest.uploaded_by_email ?? "?",
                    next: latest.version_number + 1,
                  })
                : fill(t.firstVersionInfo, { country: countryName })}
            </p>

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
                    setNavrhSelhal(null);
                    const navrh = await suggestVersionSummary(
                      marks.map((mark) => mark.note),
                      t.locale
                    ).catch(() => ({ value: null, reason: "network" }));
                    if (navrh.value) setSummary(navrh.value);
                    else
                      setNavrhSelhal(
                        ("reason" in navrh ? suggestFailureMessage(navrh.reason, t) : null) ??
                          t.suggestFailed
                      );
                    setNavrhuji(false);
                  }}
                  className="badge-pill hover:bg-mist/50 disabled:opacity-50"
                >
                  ✦ {navrhuji ? t.suggestingSummary : t.suggestSummary}
                </button>
                {navrhSelhal && <span className="text-xs text-coral">{navrhSelhal}</span>}
              </div>
            )}

            {/* Co se nahrává, stojí přímo nad tlačítkem, ať si toho každý všimne.
                Schválně ne <Field> – stejně jako u výběru země. */}
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
              {isPending ? t.saving : `${t.uploadAndNotify} (${popsaneRamecky})`}
            </button>

            {/* Proč zatím nejde zveřejnit – jinak tlačítko jen mlčky šedne. */}
            {!isPending && !canPublish && (
              <p className="text-xs text-ink/50">
                {!countryId
                  ? t.publishNeedsCountry
                  : !fileId
                  ? t.publishNeedsLink
                  : !moduleId
                    ? t.publishNeedsModule
                    : !draftId
                      ? saveState.error ?? t.publishPreparing
                      : t.needMark}
              </p>
            )}

            {state && "error" in state && <p className="text-sm text-coral">{state.error}</p>}

            {state && "warning" in state && (
              <div className="rounded-xl border border-coral p-3 text-sm">
                <p className="text-ink">
                  {fill(t.concurrentWarning, {
                    version: state.warning.otherVersion,
                    who: state.warning.otherAuthor,
                    when: casMistne(state.warning.otherUploadedAt),
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

// Označení verze podle měsíce a roku zveřejnění, např. „10/26“.
function mesicRok(datum: Date): string {
  const mesic = String(datum.getMonth() + 1).padStart(2, "0");
  const rok = String(datum.getFullYear() % 100).padStart(2, "0");
  return `${mesic}/${rok}`;
}
