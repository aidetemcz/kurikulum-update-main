import { canWriteForCountry, requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getFollowed } from "@/lib/followed";
import { getLocalNames, withLocalNames } from "@/lib/local-names";
import { FollowedModules, FollowPrompt } from "@/components/FollowedModules";
import { missingMigrations } from "@/lib/schema-check";
import { mailConfigured } from "@/lib/mail";
import { AdminNotices } from "@/components/AdminNotices";
import { resolveActiveCountry } from "@/lib/active-country";
import { getChanges } from "@/lib/country-status";
import { ChangesFromOthers } from "@/components/ChangesFromOthers";
import { CountrySwitcher } from "@/components/CountrySwitcher";
import { NoCountryNotice } from "@/components/NoCountryNotice";

// Přehled je jen o změnách od ostatních zemí. Katalog metodik má vlastní
// stránku /modules – appka slouží k oznamování aktualizací, ne k
// procházení metodik.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; module?: string }>;
}) {
  const user = await requireUser();
  const { country, module: focusModuleId } = await searchParams;
  const { activeCountryId, countries, t, locale } = await resolveActiveCountry(user, country);

  if (!activeCountryId) {
    return <NoCountryNotice isAdmin={user.role === "admin"} t={t} />;
  }

  const supabase = await createClient();
  // Všechno najednou: každý dotaz do databáze je cesta tam a zpátky.
  const [pending, dismissed, followed, localNames, missing, { data: modules }] = await Promise.all([
    getChanges(activeCountryId, "pending"),
    getChanges(activeCountryId, "dismissed"),
    getFollowed(activeCountryId),
    getLocalNames(activeCountryId),
    user.role === "admin" ? missingMigrations() : Promise.resolve([]),
    supabase
      .from("modules")
      .select("*")
      .is("archived_at", null)
      .order("category")
      .order("order_index")
      .order("name"),
  ]);

  return (
    <div>
      {/* Provozní hlášky patří jen adminovi – a v náhledu jako editor
          se schovají spolu se vším ostatním. */}
      {user.role === "admin" && (
        <AdminNotices
          missing={missing}
          mailConfigured={mailConfigured()}
          t={t}
        />
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-heading text-3xl font-bold text-ink">{t.changesFromOthers}</h1>
        <CountrySwitcher
          countries={countries}
          activeCountryId={activeCountryId}
          basePath="/"
        />
      </div>

      {!followed.chosen && <FollowPrompt t={t} />}

      <ChangesFromOthers
        // Admin vyřizuje za kteroukoli zemi, editor za svou.
        canResolve={user.role === "admin" || canWriteForCountry(user, activeCountryId)}
        pending={pending}
        dismissed={dismissed}
        focusModuleId={focusModuleId}
        locale={locale}
        t={t}
      />

      {/* Appka bude většinu času prázdná a to je v pořádku – ať to
          nevypadá jako nedodělek. */}
      {/* Změny k lekcím bez vlastní verze se do nevyřízených nepočítají. */}
      {!pending.some((item) => !item.forMissingLesson) && (
        <div className="rounded-2xl bg-haze/40 px-5 py-4">
          <p className="text-sm font-medium text-ink">{t.noUpdatesTitle}</p>
        </div>
      )}

      <FollowedModules
        // Po uložení se stránka načte znovu; klíč založí výběr nanovo.
        key={`${activeCountryId}:${followed.chosen}:${[...followed.moduleIds].sort().join(",")}`}
        countryId={activeCountryId}
        modules={withLocalNames(modules ?? [], localNames)}
        followedIds={[...followed.moduleIds]}
        chosen={followed.chosen}
        canEdit={canWriteForCountry(user, activeCountryId)}
        t={t}
      />
    </div>
  );
}
