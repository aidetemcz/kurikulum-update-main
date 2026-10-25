import { requireAdmin } from "@/lib/current-user";
import { missingMigrations } from "@/lib/schema-check";
import { mailConfigured } from "@/lib/mail";
import { AdminNotices } from "@/components/AdminNotices";
import { resolveActiveCountry } from "@/lib/active-country";
import { createClient } from "@/lib/supabase/server";
import { getLightMatrix } from "@/lib/country-status";
import { CatalogImport } from "@/components/CatalogImport";
import { TestEmailButton } from "@/components/TestEmailButton";
import { ActionForm } from "@/components/ActionForm";
import {
  CountryChecks,
  ModulesTable,
  ReadinessMatrix,
  UsersTable,
} from "@/components/admin/AdminTables";
import { addCountry, addModule, inviteUser, startPreview } from "./actions";
import type { Module } from "@/lib/types";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const user = await requireAdmin();
  const { country } = await searchParams;
  const { t } = await resolveActiveCountry(user, country);

  const supabase = await createClient();
  const { data: countries } = await supabase.from("countries").select("*").order("name");
  const { data: users } = await supabase.from("users").select("*").order("email");

  // Přiřazení zemí k uživatelům (jeden uživatel jich může mít víc).
  const { data: vazby } = await supabase.from("user_countries").select("user_id, country_id");
  const countryIds = new Map<string, string[]>();
  for (const vazba of vazby ?? []) {
    countryIds.set(vazba.user_id, [...(countryIds.get(vazba.user_id) ?? []), vazba.country_id]);
  }
  const { data: vsechnyModuly } = await supabase
    .from("modules")
    .select("*")
    .order("category")
    .order("order_index")
    .order("name");
  const lights = await getLightMatrix();

  // Kolik verzí má která metodika – podle toho se rozhoduje, jestli jde smazat.
  const { data: verze } = await supabase.from("document_versions").select("module_id");
  const pocetVerzi = new Map<string, number>();
  for (const v of verze ?? []) {
    pocetVerzi.set(v.module_id, (pocetVerzi.get(v.module_id) ?? 0) + 1);
  }

  const moduly = (vsechnyModuly ?? []) as Module[];
  const modules = moduly.filter((m) => !m.archived_at);

  return (
    <div className="flex min-w-0 max-w-3xl flex-col gap-10">
      <h1 className="font-heading text-3xl font-bold text-ink">{t.admin}</h1>

      <AdminNotices
        missing={await missingMigrations()}
        mailConfigured={mailConfigured()}
        t={t}
      />

      <section>
        <h2 className="mb-1 font-heading text-xl font-bold text-ink">{t.readiness}</h2>
        <p className="mb-3 text-xs text-ink/50">{t.readinessHint}</p>
        <ReadinessMatrix
          modules={modules ?? []}
          countries={countries ?? []}
          lights={lights}
          t={t}
        />
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl font-bold text-ink">{t.catalogTitle}</h2>
        <CatalogImport t={t} />

        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink/70">{t.methodologies}</h3>
        <ModulesTable modules={moduly} pocetVerzi={pocetVerzi} t={t} />

        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink/70">{t.addModule}</h3>
        <ActionForm action={addModule} className="flex flex-wrap gap-2">
          <input
            name="name"
            placeholder={t.moduleName}
            required
            className="input min-w-0 flex-1 basis-56"
          />
          <input
            name="category"
            placeholder={t.moduleSection}
            className="input min-w-0 flex-1 basis-56"
          />
          <input
            name="nameEn"
            placeholder={t.moduleNameEn}
            className="input min-w-0 flex-1 basis-56"
          />
          <button
            type="submit"
            className="rounded-xl bg-coral px-4 py-2.5 font-medium text-white hover:opacity-90"
          >
            {t.addModule}
          </button>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl font-bold text-ink">{t.countries}</h2>
        <ul className="mb-4 flex flex-wrap gap-2">
          {countries?.map((c) => (
            <li key={c.id} className="badge-pill">
              {c.name} ({c.locale})
            </li>
          ))}
        </ul>
        <ActionForm action={addCountry} className="flex flex-wrap gap-2">
          <input
            name="name"
            placeholder={t.countryName}
            required
            className="input min-w-0 flex-1 basis-48"
          />
          <input
            name="locale"
            placeholder={t.languageCode}
            required
            className="input min-w-0 flex-1 basis-32"
          />
          <button
            type="submit"
            className="rounded-xl bg-coral px-4 py-2.5 font-medium text-white hover:opacity-90"
          >
            {t.addCountry}
          </button>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl font-bold text-ink">{t.users}</h2>
        <UsersTable
          users={users ?? []}
          countries={countries ?? []}
          countryIds={countryIds}
          t={t}
        />

        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink/70">{t.inviteUser}</h3>
        <ActionForm action={inviteUser} className="flex flex-wrap gap-2">
          <input
            name="email"
            type="email"
            placeholder={t.email}
            required
            className="input min-w-0 flex-1 basis-56"
          />
          <CountryChecks countries={countries ?? []} selected={[]} />
          {/* Role "čtenář" se nově nezvou – editor má práva jen ve své zemi.
              Existující čtenáři zůstávají, jak jsou. */}
          <select name="role" required defaultValue="editor" className="input">
            <option value="editor">{t.roleEditor}</option>
            <option value="admin">{t.roleAdmin}</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-coral px-4 py-2.5 font-medium text-white hover:opacity-90"
          >
            {t.invite}
          </button>
        </ActionForm>

        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink/70">{t.previewAsEditor}</h3>
        <p className="mb-2 text-xs text-ink/50">{t.previewHint}</p>
        <ActionForm action={startPreview} className="flex flex-wrap gap-2">
          <select name="countryId" required className="input">
            {countries?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl border border-haze px-4 py-2.5 text-sm text-ink hover:border-coral"
          >
            {t.previewAsEditor}
          </button>
        </ActionForm>

        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink/70">{t.testEmail}</h3>
        <TestEmailButton t={t} />
      </section>
    </div>
  );
}
