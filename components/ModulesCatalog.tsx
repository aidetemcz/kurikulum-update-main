"use client";

import { useMemo, useState } from "react";
import { SECTION_ORDER } from "@/lib/catalog";
import { matchKey } from "@/lib/match-module";
import { ModuleCard } from "@/components/ModuleCard";
import { StatusDot } from "@/components/StatusDot";
import { lightKey, type CountryLight, type ModuleWithLatestVersion } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

// Celý katalog metodik rozdělený po sekcích z kurikulum.aidetem.cz.
// Jsou tu i metodiky, ke kterým zatím nikdo nic nenahrál – karta je pak
// jen informace o tom, že verze chybí.
export function ModulesCatalog({
  modules,
  lights,
  countryId,
  t,
}: {
  modules: ModuleWithLatestVersion[];
  /** Stav metodiky i prezentace každé lekce pro zobrazenou zemi (klíč z lightKey). */
  lights: Record<string, CountryLight>;
  countryId: string;
  t: Dictionary;
}) {
  const [hledani, setHledani] = useState("");

  const sekce = useMemo(() => {
    const klic = matchKey(hledani);
    // Hledá se napříč sekcemi; prázdné pole nechá katalog, jak je.
    const nalezene = klic
      ? modules.filter(
          (module) =>
            matchKey(module.name).includes(klic) ||
            matchKey(module.name_en ?? "").includes(klic) ||
            matchKey(module.category ?? "").includes(klic)
        )
      : modules;

    const mapa = new Map<string, ModuleWithLatestVersion[]>();
    for (const module of nalezene) {
      const nazev = module.category ?? t.ungrouped;
      mapa.set(nazev, [...(mapa.get(nazev) ?? []), module]);
    }

    // Pořadí sekcí drží web; co do žádné známé nepatří, jde nakonec.
    return [...mapa.entries()]
      .sort((a, b) => poradi(a[0], t) - poradi(b[0], t))
      .map(
        ([nazev, seznam]) =>
          [
            nazev,
            // Uvnitř sekce pořadí z webu, čísla v názvu ho drží.
            [...seznam].sort(
              (a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name)
            ),
          ] as const
      );
  }, [modules, hledani, t]);

  if (modules.length === 0) {
    return <p className="text-sm text-ink/50">{t.noModules}</p>;
  }

  return (
    <div>
      <input
        type="search"
        value={hledani}
        onChange={(event) => setHledani(event.target.value)}
        placeholder={t.searchModule}
        className="input w-full max-w-md"
      />

      <Legenda t={t} />

      {sekce.length === 0 ? (
        <p className="mt-6 text-sm text-ink/50">{t.nothingFound}</p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {sekce.map(([nazev, seznam]) => (
            <section key={nazev}>
              <h2 className="dashed-divider pb-2 font-heading text-xl font-bold text-ink">
                {nazev}{" "}
                <span className="font-sans text-sm font-normal text-ink/40">
                  ({seznam.length})
                </span>
              </h2>

              <div className="mt-4 grid grid-cols-1 gap-5 nav:grid-cols-2 min-[1400px]:grid-cols-3">
                {seznam.map((module) => {
                  const light = lights[lightKey(module.id, "methodology")] ?? "none";
                  const presentationLight =
                    lights[lightKey(module.id, "presentation")] ?? "none";
                  return (
                    <ModuleCard
                      key={module.id}
                      module={module}
                      countryId={countryId}
                      light={light}
                      lightTitle={lightLabelFor(light, t)}
                      presentationLight={presentationLight}
                      presentationLightTitle={lightLabelFor(presentationLight, t)}
                      t={t}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Legenda({ t }: { t: Dictionary }) {
  const polozky: [CountryLight, string][] = [
    ["none", t.lightNone],
    ["green", t.lightOk],
    ["yellow", t.lightWaiting],
    ["red", t.lightAct],
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/50">
      <span>{t.legendTitle}:</span>
      {polozky.map(([light, popis]) => (
        <span key={light} className="flex items-center gap-1.5">
          <StatusDot light={light} label={popis} size={8} />
          {popis}
        </span>
      ))}
    </div>
  );
}

function lightLabelFor(light: CountryLight, t: Dictionary): string {
  if (light === "red") return t.lightAct;
  if (light === "yellow") return t.lightWaiting;
  if (light === "none") return t.lightNone;
  return t.lightOk;
}

function poradi(nazev: string, t: Dictionary): number {
  if (nazev === t.ungrouped) return SECTION_ORDER.length + 1;

  const index = SECTION_ORDER.indexOf(nazev as (typeof SECTION_ORDER)[number]);
  return index === -1 ? SECTION_ORDER.length : index;
}
