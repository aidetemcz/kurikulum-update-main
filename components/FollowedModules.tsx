"use client";

// Výběr metodik, které země sleduje. Stojí na stránce Změny pod seznamem
// změn; při prvním otevření se rovnou rozbalí (viz FollowPrompt).
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkCheck, Check, ChevronDown, Search } from "lucide-react";
import { matchKey } from "@/lib/match-module";
import { SECTION_ORDER } from "@/lib/catalog";
import { moduleName } from "@/lib/module-name";
import { fill } from "@/lib/format";
import { saveFollowedModules } from "@/app/followed/actions";
import type { Module } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

export const FOLLOW_SECTION_ID = "sledovane-metodiky";

export function FollowedModules({
  countryId,
  modules,
  followedIds,
  chosen,
  canEdit,
  t,
}: {
  countryId: string;
  modules: Module[];
  followedIds: string[];
  /** Vybrala si už země? Když ne, sleduje všechno a sekce je rozbalená. */
  chosen: boolean;
  canEdit: boolean;
  t: Dictionary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!chosen);
  // Bez výběru se předvyplní všechno – stejně se teď sleduje všechno.
  const vychozi = useMemo(
    () => new Set(chosen ? followedIds : modules.map((module) => module.id)),
    [chosen, followedIds, modules]
  );
  const [selected, setSelected] = useState<Set<string>>(vychozi);
  const [hledani, setHledani] = useState("");
  const [pohled, setPohled] = useState<"all" | "on" | "off">("all");
  const [stav, setStav] = useState<{ error?: string; saved?: boolean }>({});
  const [isPending, startTransition] = useTransition();

  // Neuložené změny: liší se výběr od toho, co je v databázi? U země, která
  // si ještě nevybírala, je uložení vždycky krok vpřed.
  const zmeneno =
    !chosen ||
    selected.size !== vychozi.size ||
    [...selected].some((id) => !vychozi.has(id));

  const sekce = useMemo(() => {
    const klic = matchKey(hledani);
    const mapa = new Map<string, Module[]>();
    for (const module of modules) {
      if (klic && !matchKey(moduleName(module, t)).includes(klic)) continue;
      const nazev = module.category ?? t.ungrouped;
      mapa.set(nazev, [...(mapa.get(nazev) ?? []), module]);
    }
    const znamePoradi = SECTION_ORDER as readonly string[];
    return [...mapa.entries()].sort(
      ([a], [b]) =>
        (znamePoradi.includes(a) ? znamePoradi.indexOf(a) : 99) -
        (znamePoradi.includes(b) ? znamePoradi.indexOf(b) : 99)
    );
  }, [modules, hledani, t]);

  function prepnout(ids: string[], zapnout: boolean) {
    if (!canEdit) return;
    setStav({});
    setSelected((current) => {
      const dalsi = new Set(current);
      for (const id of ids) {
        if (zapnout) dalsi.add(id);
        else dalsi.delete(id);
      }
      return dalsi;
    });
  }

  function ulozit() {
    startTransition(async () => {
      const vysledek = await saveFollowedModules(countryId, [...selected]);
      if (vysledek && "error" in vysledek) setStav({ error: vysledek.error });
      else {
        setStav({ saved: true });
        router.refresh();
      }
    });
  }

  const pocet = chosen ? followedIds.length : modules.length;

  return (
    <section id={FOLLOW_SECTION_ID} className="mt-10 overflow-hidden rounded-3xl border border-haze bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-6 py-5 text-left hover:bg-haze/20"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral/10 text-coral">
          <BookmarkCheck size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-bold text-ink">{t.followTitle}</span>
          <span className="block text-sm text-ink/60">
            {chosen
              ? fill(t.followCount, { count: pocet, total: modules.length })
              : t.followNotChosen}
          </span>
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-dashed border-mist px-6 pb-6 pt-5">
          <p className="mb-5 max-w-2xl text-sm text-ink/60">{t.followHint}</p>

          {/* Hledání a přepínač pohledu. */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 basis-60">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="search"
                value={hledani}
                onChange={(event) => setHledani(event.target.value)}
                placeholder={t.searchModule}
                className="input w-full pl-10"
              />
            </div>
            <div className="inline-flex rounded-xl bg-haze/50 p-1 text-sm">
              {(["all", "on", "off"] as const).map((hodnota) => (
                <button
                  key={hodnota}
                  type="button"
                  onClick={() => setPohled(hodnota)}
                  aria-pressed={pohled === hodnota}
                  className={`rounded-lg px-3 py-1.5 font-medium ${
                    pohled === hodnota ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {hodnota === "all" ? t.allChanges : hodnota === "on" ? t.followOn : t.followOff}
                </button>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => prepnout(modules.map((module) => module.id), true)}
                  className="rounded-lg px-2.5 py-1.5 font-medium text-coral hover:bg-coral/10"
                >
                  {t.followAll}
                </button>
                <button
                  type="button"
                  onClick={() => prepnout(modules.map((module) => module.id), false)}
                  className="rounded-lg px-2.5 py-1.5 font-medium text-ink/60 hover:bg-haze/60"
                >
                  {t.followNone}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-7">
            {sekce.map(([nazev, seznam]) => {
              const vybranych = seznam.filter((module) => selected.has(module.id)).length;
              const viditelne = seznam.filter((module) =>
                pohled === "all" ? true : pohled === "on" ? selected.has(module.id) : !selected.has(module.id)
              );
              if (viditelne.length === 0) return null;
              const vse = vybranych === seznam.length;

              return (
                <div key={nazev}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {nazev}
                      <span className="rounded-full bg-haze px-2 py-0.5 text-[11px] font-medium text-ink/60">
                        {vybranych}/{seznam.length}
                      </span>
                    </h3>
                    {canEdit && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={vse}
                        aria-label={nazev}
                        onClick={() => prepnout(seznam.map((module) => module.id), !vse)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          vse ? "bg-coral" : "bg-mist"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            vse ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1200px]:grid-cols-3">
                    {viditelne.map((module) => {
                      const zapnuto = selected.has(module.id);
                      return (
                        <button
                          key={module.id}
                          type="button"
                          aria-pressed={zapnuto}
                          disabled={!canEdit}
                          onClick={() => prepnout([module.id], !zapnuto)}
                          className={`group flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm transition ${
                            zapnuto
                              ? "border-coral/60 bg-coral/5 text-ink"
                              : "border-haze bg-white text-ink/60 hover:border-mist hover:text-ink"
                          } disabled:cursor-default`}
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
                              zapnuto ? "bg-coral text-white" : "border-2 border-mist group-hover:border-coral/50"
                            }`}
                          >
                            {zapnuto && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className="leading-snug">{moduleName(module, t)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lepkavý pruh: uložení je vždy po ruce, i uprostřed dlouhého seznamu. */}
          {canEdit ? (
            <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-3 text-white shadow-lg">
              <span className="text-sm">
                {stav.error
                  ? stav.error
                  : stav.saved && !zmeneno
                    ? t.followSaved
                    : fill(t.followSelectedCount, { count: selected.size, total: modules.length })}
              </span>
              <div className="flex items-center gap-2">
                {zmeneno && chosen && (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(vychozi))}
                    className="rounded-xl px-3 py-1.5 text-sm text-white/70 hover:text-white"
                  >
                    {t.cancel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={ulozit}
                  disabled={isPending || !zmeneno}
                  className="rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                >
                  {isPending ? t.saving : fill(t.followSave, { count: selected.size })}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

// Výzva nahoře na stránce, dokud si země nevybrala. Odkaz sjede k výběru.
export function FollowPrompt({ t }: { t: Dictionary }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4">
      <div className="flex max-w-2xl items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral text-white">
          <BookmarkCheck size={20} />
        </span>
        <p className="self-center font-heading text-lg font-bold leading-tight text-ink">
          {t.followPromptTitle}
        </p>
      </div>
      <a
        href={`#${FOLLOW_SECTION_ID}`}
        className="shrink-0 rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {t.followPromptButton}
      </a>
    </div>
  );
}
