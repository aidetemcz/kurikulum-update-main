import { redirect } from "next/navigation";
import { requireUser, canUpload, writableCountries } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { createClient } from "@/lib/supabase/server";
import { toDocumentKind } from "@/lib/types";
import { getLocalNamesForCountries } from "@/lib/local-names";
import {
  UploadWorkspace,
  type ExistingDraft,
  type LatestVersion,
} from "@/components/UploadWorkspace";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const user = await requireUser();
  if (!canUpload(user)) redirect("/");

  const { country } = await searchParams;
  const { activeCountryId, t } = await resolveActiveCountry(user, country);

  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("*")
    .is("archived_at", null)
    .order("category")
    .order("order_index")
    .order("name");
  const { data: vsechnyZeme } = await supabase.from("countries").select("*").order("name");
  // Nahrávat jde jen za zemi, kterou má uživatel přiřazenou – admin není
  // výjimka (hlídá to i server a databáze). Nabízet mu cizí země by vedlo
  // jen k chybě až po vyplnění celého formuláře.
  const countries = writableCountries(user, vsechnyZeme ?? []);

  // Poslední zveřejněná verze pro každou dvojici modul + země, ať je vidět,
  // na co se navazuje a jaké číslo nová verze dostane.
  const { data: versions } = await supabase
    .from("document_versions")
    .select("module_id, country_id, kind, version_number, uploaded_at, users:uploaded_by (email)")
    .eq("status", "published")
    .order("version_number", { ascending: false });

  const latestVersions: LatestVersion[] = [];
  for (const version of versions ?? []) {
    const kind = toDocumentKind(version.kind);
    const already = latestVersions.some(
      (item) =>
        item.module_id === version.module_id &&
        item.country_id === version.country_id &&
        item.kind === kind
    );
    if (already) continue;
    const uploader = Array.isArray(version.users) ? version.users[0] : version.users;
    latestVersions.push({
      module_id: version.module_id,
      country_id: version.country_id,
      kind,
      version_number: version.version_number,
      uploaded_at: version.uploaded_at,
      uploaded_by_email: uploader?.email ?? null,
    });
  }

  // Za kterou zemi nahrával naposledy – ta se předvybere. Když takovou
  // zemi mezitím ztratil, spadne se na první z jeho zemí.
  const { data: posledni } = await supabase
    .from("document_versions")
    .select("country_id")
    .eq("uploaded_by", user.id)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const posledniVlastni = countries.some((c) => c.id === posledni?.country_id)
    ? posledni!.country_id
    : null;
  const defaultCountryId = posledniVlastni ?? countries[0]?.id ?? null;

  // Rozdělaná práce z minulé návštěvy.
  const { data: draft } = await supabase
    .from("document_versions")
    .select("id, module_id, country_id, kind, file_url, uploaded_at")
    .eq("uploaded_by", user.id)
    .eq("status", "draft")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let existingDraft: ExistingDraft | null = null;
  if (draft) {
    const { data: annotations } = await supabase
      .from("annotations")
      .select("*")
      .eq("document_version_id", draft.id);

    existingDraft = {
      id: draft.id,
      module_id: draft.module_id,
      country_id: draft.country_id,
      kind: toDocumentKind(draft.kind),
      file_url: draft.file_url,
      saved_at: draft.uploaded_at,
      marks: (annotations ?? []).map((annotation) => ({
        id: annotation.id,
        page: annotation.page,
        x: annotation.x,
        y: annotation.y,
        w: annotation.w,
        h: annotation.h,
        note: annotation.note,
        category: annotation.category,
        quote: annotation.quote ?? null,
      })),
    };
  }

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl font-bold text-ink">{t.uploadNewVersion}</h1>

      <UploadWorkspace
        modules={modules ?? []}
        localNames={await getLocalNamesForCountries(countries.map((country) => country.id))}
        countries={countries}
        defaultCountryId={defaultCountryId}
        canChooseCountry={countries.length > 1}
        latestVersions={latestVersions}
        existingDraft={existingDraft}
        t={t}
      />
    </div>
  );
}
