import Link from "next/link";
import { categoryLabels } from "@/lib/annotations";
import { moduleName } from "@/lib/module-name";
import { pluralCount } from "@/lib/format";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { OutgoingVersion } from "@/lib/outgoing";
import type { Dictionary } from "@/lib/i18n";

// Jedna zveřejněná verze v Odchozích změnách: co, kdy, kdo a rámečky.
export function OutgoingVersionCard({
  version,
  countryId,
  t,
}: {
  version: OutgoingVersion;
  countryId: string;
  t: Dictionary;
}) {
  return (
    <li className="rounded-2xl border border-haze bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words font-heading text-lg font-bold text-ink">
              {moduleName(version.module, t)}
            </h2>
            {version.kind === "presentation" && (
              <span className="badge-pill bg-coral text-white">{t.kindPresentation}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink/50">
            {t.version} {version.versionLabel} ·{" "}
            <LocalDateTime value={version.publishedAt} locale={t.dateLocale} />
            {version.authorEmail && <> · {version.authorEmail}</>}
            {version.marks.length > 0 && (
              <> · {pluralCount(version.marks.length, t.markedChangesForms, t.dateLocale)}</>
            )}
          </p>
        </div>
        <Link
          href={`/modules/${version.moduleId}?country=${countryId}&kind=${version.kind}&version=${version.id}`}
          className="shrink-0 rounded-xl bg-coral px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          {t.showInDocument}
        </Link>
      </div>

      {version.summary && (
        <p className="mt-3 whitespace-pre-line border-l-2 border-dashed border-coral pl-3 text-sm text-ink">
          {version.summary}
        </p>
      )}

      {version.marks.length > 0 && (
        <ol className="dashed-divider mt-3 flex flex-col gap-2 pt-3">
          {version.marks.map((mark, index) => (
            <li key={mark.id} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coral text-xs font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="break-words text-ink">{mark.note}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink/50">
                  {t.pageLabel} {mark.page + 1}
                  {categoryLabels(mark.category, t).map((label) => (
                    <span key={label} className="badge-pill">
                      {label}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
