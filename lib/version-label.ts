// Označení verze podle měsíce a roku zveřejnění, např. „10/26“, další
// verze téže lekce v tom samém měsíci „10/26 – 2“. Označení počítá
// databáze při zveřejnění (migrace 0019, sloupec version_label).

/** Jak se verze ukazuje. Bez označení (před migrací 0019) pořadové číslo. */
export function versionLabel(version: {
  version_label?: string | null;
  version_number?: number | null;
}): string {
  const label = version.version_label?.trim();
  if (label) return label;
  return version.version_number != null ? `v${version.version_number}` : "?";
}

/** Měsíc a rok v pražském čase, např. „10/26“ – stejně jako v databázi. */
export function versionMonth(date: Date): string {
  const casti = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(date);
  const mesic = casti.find((cast) => cast.type === "month")?.value ?? "";
  const rok = casti.find((cast) => cast.type === "year")?.value ?? "";
  return `${mesic}/${rok}`;
}

/** Jak se bude jmenovat verze zveřejněná teď, když poslední je `latestLabel`. */
export function nextVersionLabel(latestLabel: string | null, now: Date = new Date()): string {
  const mesic = versionMonth(now);
  if (!latestLabel?.startsWith(mesic)) return mesic;

  const poradi = Number(latestLabel.slice(mesic.length).replace(/[^0-9]/g, "")) || 1;
  return `${mesic} – ${poradi + 1}`;
}
