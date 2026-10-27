// Názvy zemí v jazyce rozhraní.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countryName } from "@/lib/country-name";

test("název země v jazyce rozhraní", () => {
  assert.equal(countryName("Velká Británie", "en"), "United Kingdom");
  assert.equal(countryName("Velká Británie", "sk"), "Veľká Británia");
  assert.equal(countryName("Maďarsko", "hu"), "Magyarország");
  assert.equal(countryName("Česko", "cs"), "Česko");
});

test("neznámá země zůstane, jak je uložená", () => {
  assert.equal(countryName("Polsko", "en"), "Polsko");
});

test("drobné odchylky v zápisu nevadí", () => {
  assert.equal(countryName(" velka  britanie", "en"), "United Kingdom");
  assert.equal(countryName("United Kingdom", "cs"), "Velká Británie");
});
