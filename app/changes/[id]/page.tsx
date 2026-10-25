import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { createClient } from "@/lib/supabase/server";
import { driveViewUrl, extractDriveFileId } from "@/lib/drive";
import { fill } from "@/lib/format";
import { LocalDateTime } from "@/components/LocalDateTime";
import { SharedVersionView } from "@/components/SharedVersionView";
import type { Mark } from "@/lib/types";

type Nested<T> = T | T[] | null;

function one<T>(value: Nested<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Jedna změna z jiné země otevřená přímo v dokumentu, na své stránce
// a na svém místě. Přístup hlídá databáze: k cizí verzi se dostane jen
// země, které byla změna poslána (viz 0004_country_status.sql).
export default async function ChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { t } = await resolveActiveCountry(user);

  const supabase = await createClient();

  const { data } = await supabase
    .from("annotation_country_status")
    .select(
      `id, created_at,
       annotations (
         id, page,
         document_version_id,
         document_versions (
           id, file_url, version_number, kind,
           modules (name),
           countries (name)
         )
       )`
    )
    .eq("id", id)
    .maybeSingle();

  const annotation = one(
    data?.annotations as Nested<{
      id: string;
      page: number;
      document_version_id: string;
      document_versions: Nested<{
        id: string;
        file_url: string;
        version_number: number | null;
        kind: string | null;
        modules: Nested<{ name: string }>;
        countries: Nested<{ name: string }>;
      }>;
    }>
  );
  const version = one(annotation?.document_versions ?? null);

  if (!annotation || !version) {
    return <p className="text-sm text-ink/60">{t.changeNotFound}</p>;
  }

  // Ostatní značky téže verze, aby změna seděla v kontextu celého dokumentu.
  const { data: annotations } = await supabase
    .from("annotations")
    .select("*")
    .eq("document_version_id", annotation.document_version_id);

  const marks: Mark[] = (annotations ?? []).map((row) => ({
    id: row.id,
    page: row.page,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    note: row.note,
    category: row.category,
    quote: row.quote ?? null,
  }));

  const fileId = extractDriveFileId(version.file_url);

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-coral"
      >
        <ArrowLeft size={16} />
        {t.overview}
      </Link>

      <h1 className="font-heading text-3xl font-bold text-ink">
        {one(version.modules)?.name ?? ""}
        {version.kind === "presentation" && (
          <span className="badge-pill ml-3 align-middle bg-coral text-white">{t.kindPresentation}</span>
        )}
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink/50">
        {fill(t.fromCountryVersion, {
          country: one(version.countries)?.name ?? "",
          version: version.version_number ?? "?",
        })}{" "}
        · <LocalDateTime value={data!.created_at} locale={t.dateLocale} />
      </p>

      <SharedVersionView
        fileId={fileId}
        driveUrl={fileId ? driveViewUrl(version.file_url) : ""}
        marks={marks}
        focusMarkId={annotation.id}
        t={t}
      />
    </div>
  );
}
