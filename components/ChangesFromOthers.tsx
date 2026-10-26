"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { dismissChange, restoreChange, type Resolution } from "@/app/changes/actions";
import { categoryLabels } from "@/lib/annotations";
import { moduleName } from "@/lib/module-name";
import { fill } from "@/lib/format";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { PendingChange } from "@/lib/types";
import type { Dictionary, Locale } from "@/lib/i18n";

// Jak dlouho je vidět lišta s vrácením zpět.
const UNDO_MS = 8000;
// Jak dlouho trvá, než odbavená kartička odjede pryč.
const FADE_MS = 200;

type Stav = "pending" | "dismissed";

// Blok se změnami z ostatních zemí. Stojí nad kartami metodik na Přehledu.
//
// Skrytí je dvoukrokové (klik → potvrzení → zápis) a vratné dvakrát:
// hned z lišty dole, nebo kdykoli později ze záložky Skryté.
export function ChangesFromOthers({
  pending,
  dismissed,
  focusModuleId,
  locale,
  canResolve,
  t,
}: {
  pending: PendingChange[];
  dismissed: PendingChange[];
  /** Smí uživatel změny vyřizovat? Čtenář jen čte. */
  canResolve: boolean;
  /** Metodika, na jejíž změnu se má hned po otevření odrolovat. */
  focusModuleId?: string;
  /** Jazyk zobrazené země – v něm se ukazují přeložené poznámky. */
  locale: Locale;
  t: Dictionary;
}) {
  // Co uživatel v téhle relaci přehodil. Server o tom ví taky (zapisuje se
  // rovnou), tohle je jen proto, aby se seznam překreslil bez čekání.
  const [zmeny, setZmeny] = useState<Record<string, Stav>>({});
  const [tab, setTab] = useState<"current" | "hidden">("current");
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  // Lišta si drží jen id. Položku dohledáme až při kliknutí, ať se
  // nepracuje s obrázkem, který mezitím zestaral.
  const [toastId, setToastId] = useState<string | null>(null);
  const [toastText, setToastText] = useState("");
  // Jak to uživatel v téhle relaci vyřídil – kvůli štítku ve Vyřízených.
  const [duvody, setDuvody] = useState<Record<string, Resolution>>({});
  const [error, setError] = useState<string | null>(null);

  const vse = [...pending, ...dismissed];
  const stav = (item: PendingChange): Stav =>
    zmeny[item.id] ?? (item.dismissedAt ? "dismissed" : "pending");

  // Nejnovější napřed – v mřížce plynou karty zleva doprava, takže
  // nejčerstvější změna je vlevo nahoře.
  const nevyrizene = vse
    .filter((item) => stav(item) === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Změny k lekcím, ke kterým země nemá vlastní verzi, se nemíchají
  // s ostatními: nejsou co zapracovat, jen k dispozici. Stojí ve vlastním
  // sbaleném bloku a do počtu nevyřízených se nepočítají.
  const current = nevyrizene.filter((item) => !item.forMissingLesson);
  const bezVerze = nevyrizene.filter((item) => item.forMissingLesson);
  // Když semafor u lekce bez verze odkázal sem, blok se rovnou rozbalí.
  const [bezVerzeOpen, setBezVerzeOpen] = useState(() =>
    pending.some((item) => item.forMissingLesson && item.moduleId === focusModuleId)
  );
  const hidden = vse
    .filter((item) => stav(item) === "dismissed")
    .sort((a, b) => (b.dismissedAt ?? "").localeCompare(a.dismissedAt ?? ""));

  const closeConfirm = useCallback(() => setConfirmingId(null), []);

  const toastTimer = useRef<number | null>(null);

  async function skryt(item: PendingChange, resolution: Resolution = "not_relevant") {
    setConfirmingId(null);
    setError(null);
    setLeavingId(item.id);

    // Výpadek sítě by jinak zůstal viset jako nevyřízený slib a kartička
    // by se zasekla v polovině odchodu.
    const result = await dismissChange(item.id, resolution).catch((chyba: Error) => ({
      error: chyba.message,
    }));
    if (result.error) {
      setLeavingId(null);
      setError(result.error);
      return;
    }

    window.setTimeout(() => {
      setLeavingId((current) => (current === item.id ? null : current));
      setZmeny((prev) => ({ ...prev, [item.id]: "dismissed" }));
      setDuvody((prev) => ({ ...prev, [item.id]: resolution }));
    }, FADE_MS);

    setToastText(resolution === "done" ? t.doneToast : t.dismissedToast);
    setToastId(item.id);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastId(null), UNDO_MS);

    // Překreslení si vyžádá sama serverová akce přes revalidatePath.
    // Druhý router.refresh() by běžel souběžně s ním a přepisoval stav,
    // který si tady držíme.
  }

  async function vratit(statusId: string) {
    setError(null);
    const result = await restoreChange(statusId).catch((chyba: Error) => ({
      error: chyba.message,
    }));
    if (result.error) {
      setError(result.error);
      return;
    }

    setZmeny((prev) => ({ ...prev, [statusId]: "pending" }));
    setToastId((current) => (current === statusId ? null : current));
  }

  if (current.length === 0 && hidden.length === 0 && bezVerze.length === 0) return null;

  const karty = (seznam: PendingChange[]) =>
    seznam.map((item) => (
      <ChangeCard
        key={item.id}
        item={item}
        hidden={stav(item) === "dismissed"}
        resolution={duvody[item.id] ?? item.resolution}
        canResolve={canResolve}
        leaving={leavingId === item.id}
        confirming={confirmingId === item.id}
        focus={focusModuleId === item.moduleId}
        locale={locale}
        t={t}
        onAskDismiss={() => setConfirmingId(item.id)}
        onCancelDismiss={closeConfirm}
        onDismiss={() => skryt(item)}
        onDone={() => skryt(item, "done")}
        onRestore={() => vratit(item.id)}
      />
    ));

  // Bez nevyřízených změn zůstane z bloku jen nenápadný rozbalovák,
  // ať Přehled zbytečně nenabobtná.
  const compact = current.length === 0;
  const zobrazit = compact ? (hiddenOpen ? hidden : null) : tab === "current" ? current : hidden;

  return (
    <section className="mb-8">
      {compact ? (
        <button
          type="button"
          onClick={() => setHiddenOpen((open) => !open)}
          className="text-sm text-ink/50 hover:text-coral"
        >
          {t.tabHidden} ({hidden.length})
        </button>
      ) : (
        <>
          {/* Nadpis bloku nese stránka – tady by se jen zdvojil. */}
          <div role="tablist" className="flex gap-1">
            <Tab
              label={`${t.tabCurrent} (${current.length})`}
              selected={tab === "current"}
              onSelect={() => setTab("current")}
            />
            <Tab
              label={`${t.tabHidden} (${hidden.length})`}
              selected={tab === "hidden"}
              onSelect={() => setTab("hidden")}
            />
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-coral">{error}</p>}

      {zobrazit && (
        <ul className="mt-4 grid grid-cols-1 gap-4 nav:grid-cols-2 min-[1400px]:grid-cols-3">
          {zobrazit.length === 0 ? (
            <p className="text-sm text-ink/50">{t.noHiddenChanges}</p>
          ) : (
            karty(zobrazit)
          )}
        </ul>
      )}

      {bezVerze.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            aria-expanded={bezVerzeOpen}
            onClick={() => setBezVerzeOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-coral"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${bezVerzeOpen ? "" : "-rotate-90"}`}
            />
            {t.changesForMissingTitle} ({bezVerze.length})
          </button>
          {bezVerzeOpen && (
            <>
              <p className="mt-1 text-xs text-ink/50">{t.changesForMissingHint}</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 nav:grid-cols-2 min-[1400px]:grid-cols-3">
                {karty(bezVerze)}
              </ul>
            </>
          )}
        </div>
      )}

      {toastId && (
        <div className="fixed bottom-6 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
          {toastText}
          {/* Záměrně onMouseDown, ne onClick: kliknutí těsně před vypršením
              lišty se tak stihne uplatnit ještě při stisku. */}
          <button
            type="button"
            onMouseDown={() => vratit(toastId)}
            className="font-medium text-mist hover:underline"
          >
            {t.undo}
          </button>
        </div>
      )}
    </section>
  );
}

function Tab({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`border-b-2 px-3 py-1.5 text-sm font-medium transition ${
        selected ? "border-coral text-ink" : "border-transparent text-ink/50 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ChangeCard({
  item,
  hidden,
  resolution,
  canResolve,
  leaving,
  confirming,
  focus,
  locale,
  t,
  onAskDismiss,
  onCancelDismiss,
  onDismiss,
  onDone,
  onRestore,
}: {
  item: PendingChange;
  hidden: boolean;
  resolution: Resolution | null;
  canResolve: boolean;
  leaving: boolean;
  confirming: boolean;
  /** Na tuhle změnu se odrolovalo ze semaforu. */
  focus: boolean;
  locale: Locale;
  t: Dictionary;
  onAskDismiss: () => void;
  onCancelDismiss: () => void;
  onDismiss: () => void;
  onDone: () => void;
  onRestore: () => void;
}) {
  const labels = categoryLabels(item.category, t);

  return (
    <li
      id={`zmena-${item.id}`}
      data-zmena-karta={item.id}
      data-zmena-modul={hidden ? undefined : item.moduleId}
      // flex-col + mt-auto u akcí: karty v řádku mají stejnou výšku
      // a tlačítka jim sedí na stejné lince, ať se text liší, jak chce.
      className={`flex flex-col rounded-2xl border bg-white p-4 transition-all duration-200 ${
        leaving ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100"
      } ${focus ? "border-coral ring-2 ring-coral/30" : "border-haze"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 break-words font-heading text-base font-bold text-ink">{moduleName(item.moduleNames, t)}</h3>
        {item.kind === "presentation" && (
          <span className="badge-pill bg-coral text-white">{t.kindPresentation}</span>
        )}
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

      <Note item={item} locale={locale} t={t} />

      <p className="mt-1 text-xs text-ink/50">
        {fill(t.fromCountryVersion, {
          country: item.fromCountryName,
          version: item.versionNumber ?? "?",
        })}{" "}
        · {t.publishedAt}{" "}
        <LocalDateTime value={item.publishedAt ?? item.createdAt} locale={t.dateLocale} /> ·{" "}
        {t.pageLabel} {item.page + 1}
        {hidden && item.dismissedAt && (
          <>
            {" "}
            · {t.hiddenAt}{" "}
            <LocalDateTime value={item.dismissedAt} locale={t.dateLocale} />
          </>
        )}
      </p>

      {hidden ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <span
            className={`badge-pill ${resolution === "done" ? "bg-coral/10 text-coral" : "text-ink/50"}`}
          >
            {resolution === "done" && <Check size={12} strokeWidth={3} className="mr-1 inline" />}
            {resolution === "done" ? t.changeDone : t.notRelevant}
          </span>
          {canResolve && (
            <button
              type="button"
              onClick={onRestore}
              className="rounded-xl border border-haze px-3 py-1.5 text-sm text-ink hover:border-coral hover:text-coral"
            >
              {t.restoreToCurrent}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <Link
            href={`/changes/${item.id}`}
            className="rounded-xl bg-coral px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {t.showInDocument}
          </Link>
          {/* Hotovo se nepotvrzuje – jde vrátit z lišty i z Vyřízených.
              Čtenáři se vyřizovací tlačítka neukazují vůbec. */}
          {canResolve && (
            <>
              <button
                type="button"
                onClick={onDone}
                className="inline-flex items-center gap-1 rounded-xl border border-coral/40 px-3 py-1.5 text-sm font-medium text-coral hover:bg-coral/5"
              >
                <Check size={14} strokeWidth={3} />
                {t.changeDone}
              </button>
              {/* Samostatná akce, ne odeslání formuláře. */}
              <button
                type="button"
                onClick={onAskDismiss}
                className="rounded-xl px-3 py-1.5 text-sm text-ink/60 hover:bg-haze"
              >
                {t.notRelevant}
              </button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={t.confirmHideTitle}
        explanation={t.confirmHideExplain}
        confirmLabel={t.confirmDismissYes}
        cancelLabel={t.cancel}
        closeLabel={t.close}
        onConfirm={onDismiss}
        onCancel={onCancelDismiss}
      >
        <p className="font-heading text-base font-bold text-ink">{moduleName(item.moduleNames, t)}</p>
        <p className="mt-0.5 text-xs text-ink/50">
          {fill(t.fromCountryVersion, {
            country: item.fromCountryName,
            version: item.versionNumber ?? "?",
          })}
          {item.uploadedByEmail && ` · ${fill(t.uploadedByWho, { who: item.uploadedByEmail })}`}
        </p>
        <p className="mt-2 rounded-xl bg-haze/40 px-3 py-2 text-sm text-ink">{item.note}</p>
      </ConfirmDialog>
    </li>
  );
}

// Poznámka v jazyce zobrazené země. Originál je vždy po ruce – překlad
// dělá stroj a u odborného textu se může minout.
//
// Pod poznámkou je text, který leží ve zvýrazněné části PDF – taky
// přeložený, protože PDF samo zůstává v jazyce země, která ho nahrála.
function Note({
  item,
  locale,
  t,
}: {
  item: PendingChange;
  locale: Locale;
  t: Dictionary;
}) {
  const [originalOpen, setOriginalOpen] = useState(false);

  const jazykOriginalu = jazykNazev(item.sourceLocale, t);
  const jeVlastni = !item.sourceLocale || item.sourceLocale === locale;
  const preklad = jeVlastni ? undefined : item.translations[locale];
  const citacePreklad = jeVlastni ? undefined : item.quoteTranslations[locale];
  const maPreklad = Boolean(preklad || citacePreklad);

  const poznamka = !originalOpen && preklad ? preklad : item.note;
  const citace = !originalOpen && citacePreklad ? citacePreklad : item.quote;

  return (
    <div className="mt-2">
      <p className="text-sm text-ink">{poznamka}</p>
      {citace && (
        <div className="mt-2 border-l-2 border-dashed border-coral/50 pl-3">
          <p className="text-xs font-medium text-ink/50">{t.highlightedText}</p>
          <p className="text-sm italic text-ink/80">„{citace}“</p>
        </div>
      )}
      {!jeVlastni && !maPreklad && item.translationFailed && (
        <p className="mt-0.5 text-xs text-coral">{t.translationFailed}</p>
      )}
      {maPreklad && (
        <button
          type="button"
          onClick={() => setOriginalOpen((open) => !open)}
          className="mt-0.5 text-xs text-ink/40 hover:text-coral"
        >
          {originalOpen
            ? t.showTranslation
            : fill(t.machineTranslatedFrom, { language: jazykOriginalu })}
        </button>
      )}
    </div>
  );
}

function jazykNazev(locale: string | null, t: Dictionary): string {
  if (locale === "sk") return t.langSk;
  if (locale === "en") return t.langEn;
  if (locale === "hu") return t.langHu;
  return t.langCs;
}
