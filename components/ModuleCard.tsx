import Link from "next/link";
import { FileText } from "lucide-react";
import { versionDate, type CountryLight, type ModuleWithLatestVersion } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ModuleLightDot } from "@/components/ModuleLightDot";
import { moduleName } from "@/lib/module-name";
import { pluralCount } from "@/lib/format";
import { versionLabel } from "@/lib/version-label";

export function ModuleCard({
  module,
  countryId,
  light,
  lightTitle,
  presentationLight,
  presentationLightTitle,
  available = 0,
  presentationAvailable = 0,
  t,
}: {
  module: ModuleWithLatestVersion;
  countryId: string;
  /** Semafor rozpracovanosti pro tuhle metodiku a zobrazenou zemi. */
  light: CountryLight;
  lightTitle: string;
  /** Semafor prezentace k téže lekci – svítí zvlášť. */
  presentationLight: CountryLight;
  presentationLightTitle: string;
  /** Změny od ostatních zemí k lekci, ke které země nemá verzi metodiky. */
  available?: number;
  /** Totéž pro prezentaci. */
  presentationAvailable?: number;
  t: Dictionary;
}) {
  const latest = module.latest_version;
  const presentation = module.latest_presentation;

  const telo = (
    <>
      <h3 className="break-words font-heading text-lg font-bold text-ink">
        {moduleName(module, t)}
      </h3>

      {latest ? (
        <div className="mt-auto text-sm text-ink/60">
          <p>
            {t.currentVersion}: {versionLabel(latest)}
          </p>
          <p className="text-xs text-ink/40">
            {t.uploaded} <LocalDateTime value={versionDate(latest)} locale={t.dateLocale} />
          </p>
          {latest.changes[0] && (
            <p className="mt-1 line-clamp-2 text-ink/50">{latest.changes[0].note}</p>
          )}
        </div>
      ) : (
        <p className="mt-auto text-sm text-ink/40">{t.noVersionYet}</p>
      )}

      {latest && (
        <p className="dashed-divider pt-2 text-xs text-ink/40">
          {pluralCount(module.version_count, t.versionsCountForms, t.dateLocale)}
        </p>
      )}
    </>
  );

  // Horní řádek je mimo odkaz schválně: tečka semaforu vede jinam než
  // karta a odkaz uvnitř odkazu HTML nedovoluje.
  //
  // Bez nahrané verze není kam odkazovat – karta zůstane jen textem
  // a ikona dokumentu se nekreslí.
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-haze bg-white p-5 transition hover:border-coral">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {module.is_new && <span className="badge-pill bg-coral text-white">{t.newBadge}</span>}
          {module.category && <span className="badge-pill break-words">{module.category}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DostupneZmeny count={available} moduleId={module.id} countryId={countryId} t={t} />
          <ModuleLightDot
            moduleId={module.id}
            countryId={countryId}
            light={light}
            label={lightTitle}
          />
          {latest && <FileText size={18} className="text-ink/40" />}
        </div>
      </div>

      {latest ? (
        <Link
          href={`/modules/${module.id}?country=${countryId}`}
          className="flex flex-1 flex-col gap-3"
        >
          {telo}
        </Link>
      ) : (
        <div className="flex flex-1 flex-col gap-3">{telo}</div>
      )}

      {/* Prezentace k lekci: vlastní verze i vlastní semafor. Stojí mimo
          odkaz karty, protože vede jinam (na záložku prezentace). */}
      <div className="dashed-divider flex items-center justify-between gap-2 pt-2 text-sm">
        {presentation ? (
          <Link
            href={`/modules/${module.id}?country=${countryId}&kind=presentation`}
            className="flex min-w-0 flex-1 flex-col text-ink/60 hover:text-coral"
          >
            <span className="font-medium text-ink">
              {t.kindPresentation} · {versionLabel(presentation)}
            </span>
            <span className="text-xs text-ink/40">
              {t.uploaded}{" "}
              <LocalDateTime value={versionDate(presentation)} locale={t.dateLocale} />
            </span>
          </Link>
        ) : (
          <span className="text-ink/40">{t.noPresentationYet}</span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <DostupneZmeny
            count={presentationAvailable}
            moduleId={module.id}
            countryId={countryId}
            t={t}
          />
          <ModuleLightDot
            moduleId={module.id}
            countryId={countryId}
            light={presentationLight}
            label={presentationLightTitle}
          />
        </div>
      </div>
    </div>
  );
}

// Lekce, ke které země nemá verzi, svítí šedě – změny od ostatních zemí
// jsou u ní jen „k dispozici“. Odkaz vede na přehled Změny.
function DostupneZmeny({
  count,
  moduleId,
  countryId,
  t,
}: {
  count: number;
  moduleId: string;
  countryId: string;
  t: Dictionary;
}) {
  if (count <= 0) return null;
  return (
    <Link
      href={`/?country=${countryId}&module=${moduleId}`}
      className="text-xs text-ink/40 hover:text-coral hover:underline"
    >
      {pluralCount(count, t.changesAvailableForms, t.dateLocale)}
    </Link>
  );
}
