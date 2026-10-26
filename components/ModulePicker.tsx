"use client";

import { useMemo, useRef, useState } from "react";
import { matchKey, type MatchResult } from "@/lib/match-module";
import { SECTION_ORDER } from "@/lib/catalog";
import { moduleName } from "@/lib/module-name";
import type { Module } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

// Výběr metodiky při nahrávání: posouvatelný seznam všech metodik
// rozdělený po sekcích (v pořadí katalogu) a nad ním hledání, které
// seznam zúží. Vybraná metodika se pak ukáže jako karta s tlačítkem
// „změnit“.
//
// Rozpoznání z PDF metodiku jen předvyplní – kdykoli jde přepsat.
export function ModulePicker({
  modules,
  value,
  onChange,
  recognition,
  t,
}: {
  modules: Module[];
  value: string;
  onChange: (moduleId: string) => void;
  /** Výsledek rozpoznání z nahrávaného dokumentu. */
  recognition: MatchResult | null;
  t: Dictionary;
}) {
  const [hledani, setHledani] = useState("");
  const [menim, setMenim] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const vybrana = modules.find((module) => module.id === value) ?? null;

  // Sekce v pořadí jako v katalogu, za nimi případné další.
  const sekceVKatalogu = useMemo(() => {
    const vsechny = [...new Set(modules.map((module) => module.category ?? t.ungrouped))];
    const znamePoradi = SECTION_ORDER as readonly string[];
    return [
      ...znamePoradi.filter((nazev) => vsechny.includes(nazev)),
      ...vsechny.filter((nazev) => !znamePoradi.includes(nazev)),
    ];
  }, [modules, t.ungrouped]);

  // Seznam po sekcích; hledání ho jen zúží.
  const skupiny = useMemo(() => {
    const klic = matchKey(hledani);
    const nalezene = klic
      ? modules.filter(
          (module) =>
            matchKey(module.name).includes(klic) ||
            matchKey(module.name_en ?? "").includes(klic) ||
            matchKey(module.local_name ?? "").includes(klic) ||
            Object.values(module.name_translations ?? {}).some((nazev) =>
              matchKey(nazev).includes(klic)
            ) ||
            matchKey(module.category ?? "").includes(klic)
        )
      : modules;

    return sekceVKatalogu
      .map(
        (nazev) =>
          [
            nazev,
            nalezene
              .filter((module) => (module.category ?? t.ungrouped) === nazev)
              .sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name)),
          ] as const
      )
      .filter(([, seznam]) => seznam.length > 0);
  }, [modules, hledani, sekceVKatalogu, t.ungrouped]);

  function vybrat(moduleId: string) {
    onChange(moduleId);
    setMenim(false);
    setHledani("");
  }

  // Vybraná metodika: jen karta a možnost ji změnit.
  if (vybrana && !menim) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-coral px-3 py-2.5 text-white">
        <p className="min-w-0 text-sm font-semibold">{moduleName(vybrana, t)}</p>
        <button
          type="button"
          onClick={() => {
            setMenim(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="shrink-0 text-sm font-medium text-white/90 underline hover:text-white"
        >
          {t.change}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {recognition?.kind === "choice" && (
        <div className="rounded-xl bg-haze/40 px-3 py-2">
          <p className="text-xs text-ink/60">{t.maybeOneOf}</p>
          <div className="mt-1.5 flex flex-col gap-1">
            {recognition.candidates.map((candidate) => (
              <button
                key={candidate.moduleId}
                type="button"
                onClick={() => vybrat(candidate.moduleId)}
                className="rounded-lg px-2 py-1 text-left text-sm text-ink hover:bg-white"
              >
                {candidate.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="search"
        value={hledani}
        onChange={(event) => setHledani(event.target.value)}
        placeholder={t.searchModule}
        className="input"
      />

      {skupiny.length === 0 ? (
        <p className="text-xs text-ink/50">{t.nothingFound}</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-haze">
          {skupiny.map(([nazev, seznam]) => (
            <div key={nazev}>
              <p className="sticky top-0 bg-haze/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                {nazev}
              </p>
              <ul className="divide-y divide-haze">
                {seznam.map((module) => (
                  <li key={module.id}>
                    <button
                      type="button"
                      onClick={() => vybrat(module.id)}
                      className={`w-full px-3 py-2 text-left text-sm text-ink hover:bg-haze/40 ${
                        module.id === value ? "bg-haze/40" : ""
                      }`}
                    >
                      {moduleName(module, t)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {menim && vybrana && (
        <button
          type="button"
          onClick={() => setMenim(false)}
          className="self-start text-xs text-ink/50 hover:text-coral"
        >
          {t.cancel}
        </button>
      )}
    </div>
  );
}
