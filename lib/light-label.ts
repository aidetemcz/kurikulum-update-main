import type { CountryLight } from "@/lib/types";

// Krátký popisek stavu pro tečky a jejich tooltip. Delší verze se lhůtou
// je jen v legendě (components/LightLegend.tsx).
export function lightLabel(
  light: CountryLight,
  t: { lightNone: string; lightOk: string; lightWaitingShort: string; lightActShort: string }
): string {
  if (light === "red") return t.lightActShort;
  if (light === "yellow") return t.lightWaitingShort;
  if (light === "none") return t.lightNone;
  return t.lightOk;
}
