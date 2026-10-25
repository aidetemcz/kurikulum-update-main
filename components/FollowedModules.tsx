"use client";

// Výběr metodik, které země sleduje. Stojí na stránce Změny pod seznamem
// změn; při prvním otevření se rovnou rozbalí (viz FollowPrompt).
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(chosen ? followedIds : modules.map((module) => module.id))
  );
  const [stav, setStav] = useState<{ error?: string; saved?: boolean }>({});
  const [isPending, startTransition] = useTransition();

  const sekce = useMemo(() => {
    const mapa = new Map<string, Module[]>();
    for (const module of modules) {
      const nazev = module.category ?? t.ungrouped;
      mapa.set(nazev, [...(mapa.get(nazev) ?? []), module]);
    }
    const znamePoradi = SECTION_ORDER as readonly string[];
    return [...mapa.entries()].sort(
      ([a], [b]) =>
        (znamePoradi.includes(a) ? znamePoradi.indexOf(a) : 99) -
        (znamePoradi.includes(b) ? znamePoradi.indexOf(b) : 99)
    );
  }, [modules, t.ungrouped]);

  function prepnout(ids: string[], zapnout: boolean) {
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
    <section id={FOLLOW_SECTION_ID} className="mt-10 rounded-2xl border border-haze">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">{t.followTitle}</h2>
          <p className="text-sm text-ink/60">
            {chosen
              ? fill(t.followCount, { count: pocet, total: modules.length })
              : t.followNotChosen}
          </p>
        </div>
        <ChevronDown
          size={20}
          className={`shrink-0 text-ink/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="dashed-divider px-5 pb-5 pt-4">
          <p className="mb-4 max-w-2xl text-sm text-ink/60">{t.followHint}</p>

          {canEdit && (
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => prepnout(modules.map((module) => module.id), true)}
                className="badge-pill hover:bg-mist/50"
              >
                {t.followAll}
              </button>
              <button
                type="button"
                onClick={() => prepnout(modules.map((module) => module.id), false)}
                className="badge-pill hover:bg-mist/50"
              >
                {t.followNone}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 nav:grid-cols-2">
            {sekce.map(([nazev, seznam]) => {
              const vsechnyVybrane = seznam.every((module) => selected.has(module.id));
              return (
                <div key={nazev}>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={vsechnyVybrane}
                      onChange={(event) =>
                        prepnout(
                          seznam.map((module) => module.id),
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 accent-coral"
                    />
                    {nazev}
                  </label>
                  <ul className="flex flex-col gap-1 pl-6">
                    {seznam.map((module) => (
                      <li key={module.id}>
                        <label className="flex items-start gap-2 text-sm text-ink/80">
                          <input
                            type="checkbox"
                            disabled={!canEdit}
                            checked={selected.has(module.id)}
                            onChange={(event) => prepnout([module.id], event.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-coral"
                          />
                          {moduleName(module, t)}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {canEdit ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={ulozit}
                disabled={isPending}
                className="rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? t.saving : fill(t.followSave, { count: selected.size })}
              </button>
              {stav.saved && <span className="text-sm text-ink/60">{t.followSaved}</span>}
              {stav.error && <span className="text-sm text-coral">{stav.error}</span>}
            </div>
          ) : (
            <p className="mt-5 text-xs text-ink/50">{t.followReadOnly}</p>
          )}
        </div>
      )}
    </section>
  );
}

// Výzva nahoře na stránce, dokud si země nevybrala. Odkaz sjede k výběru.
export function FollowPrompt({ t }: { t: Dictionary }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral px-5 py-4">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-ink">{t.followPromptTitle}</p>
        <p className="mt-0.5 text-sm text-ink/60">{t.followPromptText}</p>
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
