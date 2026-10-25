// Stránka pro člověka, kterému admin ještě nepřiřadil zemi. Vlaječky mu
// dovolí přepnout jazyk, aby rozuměl, co se po něm chce.
import { LanguageFlags } from "@/components/LanguageFlags";
import type { Dictionary } from "@/lib/i18n";

export function NoCountryNotice({ isAdmin, t }: { isAdmin: boolean; t: Dictionary }) {
  if (isAdmin) return <p className="text-sm text-ink/60">{t.noCountriesYet}</p>;

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-ink/60">{t.noCountryAssigned}</p>
      <LanguageFlags current={t.locale} label={t.language} />
    </div>
  );
}
