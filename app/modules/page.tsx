import { requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { getModulesForCountry } from "@/lib/modules-data";
import { getLightsForCountry } from "@/lib/country-status";
import { ModulesCatalog } from "@/components/ModulesCatalog";
import { CountrySwitcher } from "@/components/CountrySwitcher";
import { NoCountryNotice } from "@/components/NoCountryNotice";
import type { CountryLight } from "@/lib/types";

// Katalog všech metodik pro vybranou zemi – včetně těch, ke kterým zatím
// nikdo nic nenahrál.
export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const user = await requireUser();
  const { country } = await searchParams;
  const { activeCountryId, countries, t } = await resolveActiveCountry(user, country);

  if (!activeCountryId) {
    return <NoCountryNotice isAdmin={user.role === "admin"} t={t} />;
  }

  const [modules, lights] = await Promise.all([
    getModulesForCountry(activeCountryId),
    getLightsForCountry(activeCountryId),
  ]);

  // Semafor v databázi zná jen to, co čeká na vyřízení; zbytek se pozná
  // podle toho, jestli země vůbec má nahranou verzi.
  const stavy: Record<string, CountryLight> = {};
  for (const module of modules) {
    stavy[module.id] = lights[module.id] ?? (module.latest_version ? "green" : "none");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-heading text-3xl font-bold text-ink">{t.methodologies}</h1>
        <CountrySwitcher
          countries={countries}
          activeCountryId={activeCountryId}
          basePath="/modules"
        />
      </div>

      <ModulesCatalog
        modules={modules}
        lights={stavy}
        countryId={activeCountryId}
        t={t}
      />
    </div>
  );
}
