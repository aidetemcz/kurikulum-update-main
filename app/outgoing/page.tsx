import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { getOutgoing } from "@/lib/outgoing";
import { CountrySwitcher } from "@/components/CountrySwitcher";
import { NoCountryNotice } from "@/components/NoCountryNotice";
import { OutgoingVersionCard } from "@/components/OutgoingVersionCard";

// Odchozí změny: co zobrazená země zveřejnila, od nejnovějšího. Každá verze
// i s rámečky a odkazem rovnou do dokumentu.
export default async function OutgoingPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; mine?: string }>;
}) {
  const user = await requireUser();
  const { country, mine } = await searchParams;
  const { activeCountryId, countries, t } = await resolveActiveCountry(user, country);

  if (!activeCountryId) {
    return <NoCountryNotice isAdmin={user.role === "admin"} t={t} />;
  }

  const jenMoje = mine === "1";
  const versions = await getOutgoing(activeCountryId, jenMoje ? user.id : null);
  const odkaz = (moje: boolean) => `/outgoing?country=${activeCountryId}${moje ? "&mine=1" : ""}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-heading text-3xl font-bold text-ink">{t.outgoing}</h1>
        <CountrySwitcher
          countries={countries}
          activeCountryId={activeCountryId}
          basePath="/outgoing"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[false, true].map((moje) => (
          <Link
            key={String(moje)}
            href={odkaz(moje)}
            aria-current={moje === jenMoje ? "page" : undefined}
            className={`badge-pill ${moje === jenMoje ? "bg-coral text-white" : "hover:bg-mist/50"}`}
          >
            {moje ? t.outgoingMine : t.outgoingAll}
          </Link>
        ))}
      </div>

      {versions.length === 0 ? (
        <div className="rounded-2xl bg-haze/40 px-5 py-4">
          <p className="text-sm font-medium text-ink">{t.outgoingEmpty}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => (
            <OutgoingVersionCard key={version.id} version={version} countryId={activeCountryId} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
