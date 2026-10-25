import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { canWriteForCountry, requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ModuleTitle } from "@/components/ModuleTitle";
import { resolveActiveCountry } from "@/lib/active-country";
import { getModuleDetail } from "@/lib/modules-data";
import { VersionBrowser } from "@/components/VersionBrowser";
import { CountrySwitcher } from "@/components/CountrySwitcher";
import { NoCountryNotice } from "@/components/NoCountryNotice";
import { moduleName } from "@/lib/module-name";
import { DOCUMENT_KINDS, toDocumentKind } from "@/lib/types";

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ country?: string; kind?: string }>;
}) {
  const user = await requireUser();
  const { moduleId } = await params;
  const { country, kind: kindParam } = await searchParams;
  const { activeCountryId, countries, t, locale } = await resolveActiveCountry(user, country);

  if (!activeCountryId) {
    return <NoCountryNotice isAdmin={user.role === "admin"} t={t} />;
  }

  const { module, versions, marksByVersion } = await getModuleDetail(moduleId, activeCountryId, locale);

  if (!module) notFound();

  // Metodika a prezentace téže lekce mají každá svou řadu verzí. Bez
  // výslovné volby se ukáže metodika – leda by lekce měla jen prezentaci.
  const pocty = {
    teaching_material: versions.filter((v) => v.kind === "teaching_material").length,
    presentation: versions.filter((v) => v.kind === "presentation").length,
  };
  const kind =
    kindParam !== undefined
      ? toDocumentKind(kindParam)
      : pocty.teaching_material === 0 && pocty.presentation > 0
        ? "presentation"
        : "teaching_material";
  const zobrazene = versions.filter((v) => v.kind === kind);

  // Název zobrazené země do popisku přejmenování; seznam zemí přepínače
  // bývá prázdný, proto zvlášť.
  const supabase = await createClient();
  const { data: zobrazenaZeme } = await supabase
    .from("countries")
    .select("name")
    .eq("id", activeCountryId)
    .maybeSingle();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <a
          href={`/modules?country=${activeCountryId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-coral"
        >
          <ArrowLeft size={16} />
          {t.backToCatalog}
        </a>
        <CountrySwitcher
          countries={countries}
          activeCountryId={activeCountryId}
          basePath={`/modules/${moduleId}`}
          label={t.country}
          extraQuery={`&kind=${kind}`}
        />
      </div>

      <p className="mb-1 text-sm text-ink/50">{module.category ?? t.noCategory}</p>
      <ModuleTitle
        title={moduleName(module, t)}
        standardName={moduleName({ ...module, local_name: null }, t)}
        localName={module.local_name ?? null}
        countryId={activeCountryId}
        countryName={zobrazenaZeme?.name ?? ""}
        moduleId={moduleId}
        canRename={canWriteForCountry(user, activeCountryId)}
        t={t}
      />

      {/* Metodika a prezentace jako záložky – každá má svou řadu verzí. */}
      <div role="tablist" className="mb-6 flex gap-6 border-b border-haze">
        {DOCUMENT_KINDS.map((druh) => (
          <Link
            key={druh}
            role="tab"
            aria-selected={druh === kind}
            href={`/modules/${moduleId}?country=${activeCountryId}&kind=${druh}`}
            className={`-mb-px border-b-2 pb-2 text-base font-medium ${
              druh === kind ? "border-coral text-ink" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {druh === "presentation" ? t.kindPresentation : t.kindMethodology}
            <span className="ml-1.5 text-sm text-ink/40">{pocty[druh]}</span>
          </Link>
        ))}
      </div>

      <VersionBrowser
        key={kind}
        canEdit={user.role === "admin"}
        versions={zobrazene}
        marksByVersion={marksByVersion}
        t={t}
      />
    </div>
  );
}
