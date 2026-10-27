"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { SECTION_ORDER } from "@/lib/catalog";
import { matchKey } from "@/lib/match-module";
import { ModuleCard } from "@/components/ModuleCard";
import { LightLegend } from "@/components/LightLegend";
import { lightLabel } from "@/lib/light-label";
import { lightKey, type CountryLight, type ModuleWithLatestVersion } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

// Celý katalog metodik rozdělený po sekcích z kurikulum.aidetem.cz.
// Jsou tu i metodiky, ke kterým zatím nikdo nic nenahrál – karta je pak
// jen informace o tom, že verze chybí.
export function ModulesCatalog({
  modules,
  lights,
  available,
  countryId,
  t,
}: {
  modules: ModuleWithLatestVersion[];
  /** Stav metodiky i prezentace každé lekce pro zobrazenou zemi (klíč z lightKey). */
  lights: Record<string, CountryLight>;
  /** Počet změn od ostatních u lekcí, ke kterým země nemá verzi (klíč z lightKey). */
  available: Record<string, number>;
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
            matchKey(module.local_name ?? "").includes(klic) ||
            Object.values(module.name_translations ?? {}).some((nazev) =>
              matchKey(nazev).includes(klic)
            ) ||
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

  const karta = (module: ModuleWithLatestVersion) => {
    const light = lights[lightKey(module.id, "teaching_material")] ?? "none";
    const presentationLight = lights[lightKey(module.id, "presentation")] ?? "none";
    return (
      <ModuleCard
        key={module.id}
        module={module}
        countryId={countryId}
        light={light}
        lightTitle={lightLabel(light, t)}
        presentationLight={presentationLight}
        presentationLightTitle={lightLabel(presentationLight, t)}
        available={available[lightKey(module.id, "teaching_material")] ?? 0}
        presentationAvailable={available[lightKey(module.id, "presentation")] ?? 0}
        t={t}
      />
    );
  };
  const nove = modules.filter((module) => module.is_new);

  return (
    <div>
      {/* Nové metodiky nahoře a barevně, ať je nikdo nepřehlédne. V seznamu
          pod tím jsou taky, se štítkem „Nová“. Prázdný blok zůstává, ať je
          vidět, kam nové metodiky přibudou. */}
      <section className="mb-8 rounded-2xl border-2 border-coral/40 bg-coral/5 p-5">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-ink">
          <Sparkles size={20} className="text-coral" />
          {t.newModulesTitle}
        </h2>
        {nove.length === 0 ? (
          <p className="mt-2 text-sm text-ink/50">{t.newModulesEmpty}</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 nav:grid-cols-2 min-[1400px]:grid-cols-3">
            {nove.map(karta)}
          </div>
        )}
      </section>

      <input
        type="search"
        value={hledani}
        onChange={(event) => setHledani(event.target.value)}
        placeholder={t.searchModule}
        className="input w-full max-w-md"
      />

      <LightLegend t={t} className="mt-3" />

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
                {seznam.map(karta)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}


function poradi(nazev: string, t: Dictionary): number {
  if (nazev === t.ungrouped) return SECTION_ORDER.length + 1;

  const index = SECTION_ORDER.indexOf(nazev as (typeof SECTION_ORDER)[number]);
  return index === -1 ? SECTION_ORDER.length : index;
}
