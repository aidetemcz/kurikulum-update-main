"use client";

import { useMemo, useRef, useState } from "react";
import { matchKey, type MatchResult } from "@/lib/match-module";
import { SECTION_ORDER } from "@/lib/catalog";
import { fill } from "@/lib/format";
import { moduleName } from "@/lib/module-name";
import type { Module } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

// Kolik výsledků se ukáže najednou. Víc už je nepřehledné – kdo nenajde,
// upřesní hledání nebo si vybere sekci.
const MAX_VYSLEDKU = 8;

// Výběr metodiky při nahrávání. Metodik je kolem padesáti, proto se
// nevypisují všechny: hledá se podle názvu, případně se zúží na sekci.
// Vybraná metodika se pak ukáže jako karta s tlačítkem „změnit“.
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
  const [sekce, setSekce] = useState<string | null>(null);
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

  const vysledky = useMemo(() => {
    const klic = matchKey(hledani);
    if (!klic && !sekce) return [];
    return modules.filter((module) => {
      if (sekce && (module.category ?? t.ungrouped) !== sekce) return false;
      if (!klic) return true;
      return (
        matchKey(module.name).includes(klic) ||
        matchKey(module.name_en ?? "").includes(klic) ||
        matchKey(module.category ?? "").includes(klic)
      );
    });
  }, [modules, hledani, sekce, t.ungrouped]);

  function vybrat(moduleId: string) {
    onChange(moduleId);
    setMenim(false);
    setHledani("");
    setSekce(null);
  }

  // Vybraná metodika: jen karta a možnost ji změnit.
  if (vybrana && !menim) {
    const rozpoznana = recognition?.kind === "match" && recognition.best.moduleId === vybrana.id;
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-coral px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{moduleName(vybrana, t)}</p>
          <p className="text-xs text-ink/50">
            {vybrana.category ?? t.ungrouped}
            {rozpoznana && ` · ${t.recognizedFromPdf}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMenim(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="shrink-0 text-sm font-medium text-coral hover:underline"
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

      <div role="group" aria-label={t.module} className="flex flex-wrap gap-1">
        {sekceVKatalogu.map((nazev) => (
          <button
            key={nazev}
            type="button"
            aria-pressed={sekce === nazev}
            onClick={() => setSekce(sekce === nazev ? null : nazev)}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              sekce === nazev ? "bg-coral text-white" : "bg-haze/50 text-ink/70 hover:bg-mist/50"
            }`}
          >
            {nazev}
          </button>
        ))}
      </div>

      {vysledky.length > 0 && (
        <ul className="flex flex-col divide-y divide-haze rounded-xl border border-haze">
          {vysledky.slice(0, MAX_VYSLEDKU).map((module) => (
            <li key={module.id}>
              <button
                type="button"
                onClick={() => vybrat(module.id)}
                className={`w-full px-3 py-2 text-left hover:bg-haze/40 ${
                  module.id === value ? "bg-haze/40" : ""
                }`}
              >
                <span className="block text-sm text-ink">{moduleName(module, t)}</span>
                {!sekce && (
                  <span className="block text-xs text-ink/40">{module.category ?? t.ungrouped}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {vysledky.length > MAX_VYSLEDKU && (
        <p className="text-xs text-ink/50">
          {fill(t.moreResults, { count: vysledky.length - MAX_VYSLEDKU })}
        </p>
      )}

      {(hledani.trim() || sekce) && vysledky.length === 0 && (
        <p className="text-xs text-ink/50">{t.nothingFound}</p>
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
