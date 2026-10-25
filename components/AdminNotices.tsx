import { fill } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";

// Provozní hlášky jen pro adminy: chybějící migrace, nenastavené
// odesílání e-mailů a vypnuté AI překlady. Běžného uživatele nezajímají, stejně s tím nic
// neudělá – a prázdná appka bez nich vypadá jako prázdná databáze.
export function AdminNotices({
  missing,
  mailConfigured,
  t,
}: {
  missing: string[];
  mailConfigured: boolean;
  t: Dictionary;
}) {
  // Jen jestli je klíč vyplněný; jestli platí, se ukáže až při překladu.
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  if (missing.length === 0 && mailConfigured && aiConfigured) return null;

  return (
    <div className="mb-6 flex flex-col gap-2">
      {missing.length > 0 && (
        <p className="rounded-2xl border border-coral bg-white px-4 py-3 text-sm text-ink">
          {fill(t.schemaOutdated, { files: missing.join(", ") })}
        </p>
      )}
      {!mailConfigured && (
        <p className="rounded-2xl border border-haze bg-white px-4 py-3 text-sm text-ink/70">
          {t.mailNotConfigured}
        </p>
      )}
      {!aiConfigured && (
        <p className="rounded-2xl border border-haze bg-white px-4 py-3 text-sm text-ink/70">
          {t.aiNotConfigured}
        </p>
      )}
    </div>
  );
}
