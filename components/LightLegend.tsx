import { StatusDot } from "@/components/StatusDot";
import type { CountryLight } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

// Legenda stavů (semaforu). U teček stačí krátké popisky, tady jsou
// i lhůty – proto jde o jediné místo s delšími texty.
export function LightLegend({ t, className = "" }: { t: Dictionary; className?: string }) {
  const polozky: [CountryLight, string][] = [
    ["none", t.lightNone],
    ["green", t.lightOk],
    ["yellow", t.lightWaiting],
    ["red", t.lightAct],
  ];

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/50 ${className}`}>
      {polozky.map(([light, popis]) => (
        <span key={light} className="flex items-center gap-1.5">
          <StatusDot light={light} label={popis} size={8} />
          {popis}
        </span>
      ))}
    </div>
  );
}
