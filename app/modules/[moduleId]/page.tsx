import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { getModuleDetail } from "@/lib/modules-data";
import { VersionBrowser } from "@/components/VersionBrowser";
import { CountrySwitcher } from "@/components/CountrySwitcher";
import { NoCountryNotice } from "@/components/NoCountryNotice";
import { moduleName } from "@/lib/module-name";

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const user = await requireUser();
  const { moduleId } = await params;
  const { country } = await searchParams;
  const { activeCountryId, countries, t } = await resolveActiveCountry(user, country);

  if (!activeCountryId) {
    return <NoCountryNotice isAdmin={user.role === "admin"} t={t} />;
  }

  const { module, versions, marksByVersion } = await getModuleDetail(moduleId, activeCountryId);

  if (!module) notFound();

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

      <VersionBrowser
        canEdit={user.role === "admin"} versions={versions} marksByVersion={marksByVersion} t={t} />
    </div>
  );
}
