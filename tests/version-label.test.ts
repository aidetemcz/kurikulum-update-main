// Označení verzí podle měsíce a roku.
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextVersionLabel, versionLabel, versionMonth } from "@/lib/version-label";

const RIJEN = new Date("2026-10-15T10:00:00Z");

test("měsíc a rok v pražském čase", () => {
  assert.equal(versionMonth(RIJEN), "10/26");
  // 31. 8. 23:30 UTC je v Praze už 1. září.
  assert.equal(versionMonth(new Date("2026-08-31T23:30:00Z")), "09/26");
});

test("další verze: nový měsíc bez čísla, ve stejném měsíci s pomlčkou", () => {
  assert.equal(nextVersionLabel(null, RIJEN), "10/26");
  assert.equal(nextVersionLabel("09/26", RIJEN), "10/26");
  assert.equal(nextVersionLabel("10/26", RIJEN), "10/26 – 2");
  assert.equal(nextVersionLabel("10/26 – 2", RIJEN), "10/26 – 3");
});

test("bez označení z databáze se ukáže pořadové číslo", () => {
  assert.equal(versionLabel({ version_label: "10/26 – 2", version_number: 7 }), "10/26 – 2");
  assert.equal(versionLabel({ version_label: null, version_number: 7 }), "v7");
});
