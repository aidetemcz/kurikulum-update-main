import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
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
  const { activeCountryId, countries, t } = await resolveActiveCountry(user, country);

  if (!activeCountryId) {
    return <NoCountryNotice isAdmin={user.role === "admin"} t={t} />;
  }

  const { module, versions, marksByVersion } = await getModuleDetail(moduleId, activeCountryId);

  if (!module) notFound();

  // Metodika a prezentace téže lekce mají každá svou řadu verzí. Bez
  // výslovné volby se ukáže metodika – leda by lekce měla jen prezentaci.
  const pocty = {
    methodology: versions.filter((v) => v.kind === "methodology").length,
    presentation: versions.filter((v) => v.kind === "presentation").length,
  };
  const kind =
    kindParam !== undefined
      ? toDocumentKind(kindParam)
      : pocty.methodology === 0 && pocty.presentation > 0
        ? "presentation"
        : "methodology";
  const zobrazene = versions.filter((v) => v.kind === kind);

  return (
    <div>
      {countries.length > 0 && (
        <div className="mb-5">
          <CountrySwitcher
            countries={countries}
            activeCountryId={activeCountryId}
            basePath={`/modules/${moduleId}`}
          />
        </div>
      )}

      <p className="badge-pill mb-3">{module.category ?? t.noCategory}</p>
      <h1 className="mb-6 font-heading text-3xl font-bold text-ink">
        {moduleName(module, t)}
      </h1>

      <div role="tablist" className="mb-6 flex gap-2">
        {DOCUMENT_KINDS.map((druh) => (
          <Link
            key={druh}
            role="tab"
            aria-selected={druh === kind}
            href={`/modules/${moduleId}?country=${activeCountryId}&kind=${druh}`}
            className={`badge-pill ${druh === kind ? "bg-coral text-white" : "hover:bg-mist/50"}`}
          >
            {druh === "presentation" ? t.kindPresentation : t.kindMethodology} ({pocty[druh]})
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
