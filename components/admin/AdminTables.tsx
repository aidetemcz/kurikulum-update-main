import Link from "next/link";
import { lightLabel, type MatrixCell } from "@/lib/country-status";
import { StatusDot } from "@/components/StatusDot";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { ActionForm } from "@/components/ActionForm";
import {
  deleteModule,
  setModuleArchived,
  updateModule,
  updateUserRoleAndCountries,
} from "@/app/admin/actions";
import type { Country, AppUser, Module } from "@/lib/types";
import { normalizeRole } from "@/lib/permissions";
import type { Dictionary } from "@/lib/i18n";

// Tabulky Administrace. Bydlí mimo stránku, aby šly vykreslit i samostatně
// (kontrola rozvržení na úzkém okně) – stránka sama je serverová a bez
// databáze se nerozběhne.

export function UsersTable({
  users,
  countries,
  countryIds,
  t,
}: {
  users: AppUser[];
  countries: Country[];
  /** Země podle uživatele. */
  countryIds: Map<string, string[]>;
  t: Dictionary;
}) {
  return (
    <table className="w-full table-fixed text-left text-sm">
      <thead>
        <tr className="dashed-divider text-ink/50">
          <th className="w-40 py-2 font-medium">{t.email}</th>
          <th className="py-2 font-medium">{t.countryAndRole} / {t.uiLanguage}</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="dashed-divider">
            <td className="break-all py-2 pr-3 align-top">{u.email}</td>
            <td className="py-2 align-top">
              <ActionForm action={updateUserRoleAndCountries} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <CountryChecks countries={countries} selected={countryIds.get(u.id) ?? []} />
                <select name="locale" defaultValue={u.locale ?? ""} className="input py-1">
                  <option value="">{t.byCountry}</option>
                  <option value="cs">cs</option>
                  <option value="sk">sk</option>
                  <option value="en">en</option>
                  <option value="hu">hu</option>
                </select>
                <select name="role" defaultValue={normalizeRole(u.role)} className="input py-1">
                  <option value="editor">{t.roleEditor}</option>
                  <option value="admin">{t.roleAdmin}</option>
                </select>
                <button type="submit" className="text-coral hover:underline">
                  {t.save}
                </button>
              </ActionForm>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Matice metodika × země. Klik na tečku otevře seznam změn té země
// omezený na tu metodiku.
export function ReadinessMatrix({
  modules,
  countries,
  lights,
  t,
}: {
  modules: Module[];
  countries: Country[];
  lights: Record<string, MatrixCell>;
  t: Dictionary;
}) {
  if (modules.length === 0 || countries.length === 0) {
    return <p className="text-sm text-ink/50">{t.noModules}</p>;
  }

  // Čtyři země vedle sebe se na mobil nevejdou. Matice si proto roluje
  // sama uvnitř svého rámečku – stránka pod ní zůstává v klidu.
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="dashed-divider text-ink/50">
            <th className="w-full py-2 pr-3 font-medium">{t.moduleColumn}</th>
            {countries.map((country) => (
              <th
                key={country.id}
                className="whitespace-nowrap px-3 py-2 text-center font-medium"
              >
                {country.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr key={module.id} className="dashed-divider">
              <td className="py-2 pr-3">{module.name}</td>
              {countries.map((country) => {
                const cell = lights[`${module.id}:${country.id}`] ?? { light: "none" };
                // Šedá znamená buď „nemá verzi“, nebo „nesleduje“ – popisek
                // to rozliší.
                const label = cell.notFollowed ? t.lightNotFollowed : lightLabel(cell.light, t);
                return (
                  <td key={country.id} className="px-3 py-2 text-center">
                    <Link
                      href={`/?country=${country.id}&module=${module.id}`}
                      className="inline-flex rounded-full p-1 hover:bg-haze"
                    >
                      <StatusDot light={cell.light} label={label} size={12} />
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Seznam metodik. Přejmenovat a zařadit jde i ručně, hlavní cesta je ale
// import z webu. Mazat jde jen metodika bez jediné verze – jinak archivace.
export function ModulesTable({
  modules,
  pocetVerzi,
  t,
}: {
  modules: Module[];
  pocetVerzi: Map<string, number>;
  t: Dictionary;
}) {
  if (modules.length === 0) {
    return <p className="text-sm text-ink/50">{t.noModules}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {modules.map((module) => {
        const maVerze = (pocetVerzi.get(module.id) ?? 0) > 0;
        const archivovana = Boolean(module.archived_at);

        // Na úzkém okně jde řádek pod sebe: pole nahoře, akce dole. Vedle
        // sebe by se tři pole a tři akce smrskly na nečitelné pahýly.
        return (
          <div
            key={module.id}
            className={`flex flex-col gap-2 rounded-xl border border-haze p-2 doc:flex-row doc:flex-wrap doc:items-center ${
              archivovana ? "opacity-50" : ""
            }`}
          >
            <ActionForm
              action={updateModule}
              wrapperClassName="min-w-0 doc:flex-1"
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="moduleId" value={module.id} />
              <input
                name="name"
                defaultValue={module.name}
                required
                className="input min-w-0 flex-1 basis-full py-1 sm:basis-48"
              />
              <input
                name="category"
                defaultValue={module.category ?? ""}
                placeholder={t.moduleSection}
                className="input min-w-0 flex-1 basis-full py-1 sm:basis-40"
              />
              <input
                name="nameEn"
                defaultValue={module.name_en ?? ""}
                placeholder={t.moduleNameEn}
                className="input min-w-0 flex-1 basis-full py-1 sm:basis-40"
              />
              <button type="submit" className="text-sm text-coral hover:underline">
                {t.save}
              </button>
            </ActionForm>

            <div className="flex flex-wrap items-center gap-3">
            {/* Bez slugu = metodika není z katalogu webu. Import se jí
                nedotkne, takže je potřeba, aby to bylo vidět. */}
            {!module.slug && (
              <span className="badge-pill bg-mist/40 text-ink/70">{t.manualModule}</span>
            )}
            {archivovana && <span className="badge-pill">{t.archivedLabel}</span>}

            <ActionForm action={setModuleArchived}>
              <input type="hidden" name="moduleId" value={module.id} />
              <input type="hidden" name="archived" value={archivovana ? "0" : "1"} />
              {/* Vracet z archivu je neškodné, potvrzuje se jen archivace. */}
              {archivovana ? (
                <button type="submit" className="text-sm text-ink/50 hover:text-ink">
                  {t.unarchiveModule}
                </button>
              ) : (
                <ConfirmSubmit
                  label={t.archiveModule}
                  title={t.confirmArchiveTitle}
                  explanation={t.confirmArchiveExplain}
                  confirmLabel={t.confirmArchiveYes}
                  detail={module.name}
                  className="text-sm text-ink/50 hover:text-ink"
                  t={t}
                />
              )}
            </ActionForm>

            {maVerze ? (
              <span className="text-xs text-ink/40">{t.cannotDeleteModule}</span>
            ) : (
              <ActionForm action={deleteModule}>
                <input type="hidden" name="moduleId" value={module.id} />
                <ConfirmSubmit
                  label={t.delete}
                  title={t.confirmDeleteModuleTitle}
                  explanation={t.confirmDeleteModuleExplain}
                  confirmLabel={t.confirmDeleteYes}
                  detail={module.name}
                  t={t}
                />
              </ActionForm>
            )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Země se u uživatele vybírají zaškrtávátky – jeden účet může spravovat
// víc zemí (například Česko i anglickou verzi).
export function CountryChecks({
  countries,
  selected,
}: {
  countries: Country[];
  selected: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {countries.map((country) => (
        <label key={country.id} className="flex items-center gap-1.5 text-sm text-ink">
          <input
            type="checkbox"
            name="countryIds"
            value={country.id}
            defaultChecked={selected.includes(country.id)}
            className="accent-coral"
          />
          {country.name}
        </label>
      ))}
    </div>
  );
}
