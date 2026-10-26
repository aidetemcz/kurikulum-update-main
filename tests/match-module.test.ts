// Rozpoznání lekce z první strany PDF ve všech jazycích.
// Spuštění: npm test
//
// Katalog se bere ze seedů v supabase/seed, takže lekce soupeří se všemi
// ostatními – i s těmi, které se jmenují podobně.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchModule, toMatchableModule } from "@/lib/match-module";

const seed = (soubor: string) =>
  readFileSync(new URL(`../supabase/seed/${soubor}`, import.meta.url), "utf8");

// SQL řetězec v apostrofech (zdvojený apostrof uvnitř = apostrof).
const RETEZEC = "'((?:[^']|'')*)'";
const odSql = (hodnota: string) => hodnota.replace(/''/g, "'");

type Radek = {
  id: string;
  name: string;
  name_en: string | null;
  name_translations: Record<string, string>;
};

function nactiKatalog(): Radek[] {
  const lekce = new Map<string, Radek>();
  for (const [, nazev, slug] of seed("katalog-metodik.sql").matchAll(
    new RegExp(`\\(${RETEZEC}, ${RETEZEC},`, "g")
  )) {
    lekce.set(slug, { id: slug, name: odSql(nazev), name_en: null, name_translations: {} });
  }
  for (const [, slug, en] of seed("anglicke-nazvy.sql").matchAll(
    new RegExp(`\\(${RETEZEC}, ${RETEZEC}\\)`, "g")
  )) {
    const radek = lekce.get(slug);
    if (radek) radek.name_en = odSql(en);
  }
  for (const [, slug, sk, hu] of seed("nazvy-sk-hu.sql").matchAll(
    new RegExp(`\\(${RETEZEC}, ${RETEZEC}, ${RETEZEC}\\)`, "g")
  )) {
    const radek = lekce.get(slug);
    if (radek) radek.name_translations = { sk: odSql(sk), hu: odSql(hu) };
  }
  return [...lekce.values()];
}

const katalog = nactiKatalog();

function rozpoznej(prvniStrana: string, jazyk: string) {
  const lekce = katalog.map((radek) => toMatchableModule(radek, jazyk, null));
  return matchModule(lekce, prvniStrana, "");
}

test("katalog ze seedů má názvy ve všech jazycích", () => {
  assert.ok(katalog.length >= 40);
  assert.ok(katalog.every((radek) => radek.name_en));
  assert.ok(katalog.every((radek) => radek.name_translations.sk && radek.name_translations.hu));
});

const PRIKLADY = [
  {
    jazyk: "cs",
    prvniStrana:
      "Metodický materiál AI dětem Strojové učení 02 — Strojové učení s učitelem Cílem lekce je, aby žáci",
    lekce: "strojove-uceni-02-strojove-uceni-s-ucitelem",
  },
  {
    jazyk: "en",
    prvniStrana:
      "Teaching material AI for children 05 Robots at the Cat Exhibition – Learning from Examples Lesson goals",
    lekce: "05-uceni-se-z-prikladu-roboti-na-vystave-kocek",
  },
  {
    jazyk: "sk",
    prvniStrana:
      "Metodický materiál 07 Ju a Pí na nákupe — Predpojatosť Cieľom hodiny je, aby žiaci",
    lekce: "07-predpojatost-ju-a-pi-na-nakupu",
  },
  {
    jazyk: "hu",
    prvniStrana:
      "Módszertani anyag 04 Robotok a felhők között — Adatok és felhő Az óra célja, hogy a tanulók",
    lekce: "04-data-cloud-roboti-s-hlavou-v-oblacich",
  },
];

for (const priklad of PRIKLADY) {
  test(`titulek první strany v jazyce ${priklad.jazyk} → správná lekce`, () => {
    const vysledek = rozpoznej(priklad.prvniStrana, priklad.jazyk);
    assert.equal(vysledek.kind, "match", JSON.stringify(vysledek));
    if (vysledek.kind === "match") assert.equal(vysledek.best.moduleId, priklad.lekce);
  });
}

test("v nabídce je název v jazyce nahrávající země", () => {
  const vysledek = rozpoznej(PRIKLADY[1].prvniStrana, "en");
  assert.equal(vysledek.kind, "match");
  if (vysledek.kind === "match") {
    assert.equal(vysledek.best.name, "05 Robots at the Cat Exhibition – Learning from Examples");
  }
});
