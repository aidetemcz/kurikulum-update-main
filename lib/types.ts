// Typy, které odpovídají tabulkám v Supabase (viz supabase/migrations/0001_init.sql).
// Když přidáš/změníš sloupec v databázi, uprav ho i tady.

export type UserRole = "admin" | "editor";

export type Country = {
  id: string;
  name: string;
  locale: string; // jazykový kód, např. "cs", "sk", "en", "hu"
  created_at: string;
};

export type AppUser = {
  id: string; // stejné jako auth.users.id
  email: string;
  /** Zastaralé: jedna země. Appka pracuje s country_ids (viz 0008). */
  country_id: string | null;
  /** Země, které uživatel spravuje. Může jich být víc. */
  country_ids: string[];
  /** Jazyk rozhraní. Prázdné = podle první přiřazené země. */
  locale: string | null;
  role: UserRole;
  created_at: string;
};

export type Module = {
  id: string;
  name: string;
  /** Sekce z webu kurikulum.aidetem.cz. */
  category: string | null;
  /** Část adresy /knowledgebase/<slug>/. U ručně přidaných je prázdný. */
  slug: string | null;
  source_url: string | null;
  name_en: string | null;
  /** Názvy ve slovenštině a maďarštině (migrace 0014). */
  name_translations?: Record<string, string> | null;
  /** Vlastní název zobrazené země (migrace 0016); doplňuje ho server. */
  local_name?: string | null;
  order_index: number;
  /** Nová metodika – stojí nahoře na stránce Metodiky (migrace 0021). */
  is_new?: boolean;
  /** Metodika, která z webu zmizela. Nemaže se, jen se schová. */
  archived_at: string | null;
  created_at: string;
};

/** Co verze obsahuje: metodiku lekce, nebo prezentaci k ní. Verzují se zvlášť. */
export type DocumentKind = "teaching_material" | "presentation";

export const DOCUMENT_KINDS: DocumentKind[] = ["teaching_material", "presentation"];

export function toDocumentKind(value: unknown): DocumentKind {
  return value === "presentation" ? "presentation" : "teaching_material";
}

/** Klíč do mapy semaforů: metodika a prezentace téže lekce svítí zvlášť. */
export function lightKey(moduleId: string, kind: DocumentKind): string {
  return `${moduleId}:${kind}`;
}

export type DocumentVersion = {
  id: string;
  module_id: string;
  country_id: string;
  kind: DocumentKind;
  file_url: string;
  version_number: number;
  /** Kdy vznikl koncept; u verzí zveřejněných před migrací 0018 se liší
   *  od zveřejnění. Pro zobrazení použij versionDate(). */
  uploaded_at: string;
  /** Kdy byla verze zveřejněná. U nejstarších verzí může chybět. */
  published_at?: string | null;
  /** Označení podle měsíce a roku, např. „10/26 – 2“ (migrace 0019).
   *  Pro zobrazení použij versionLabel(). */
  version_label?: string | null;
  uploaded_by: string | null;
};

/** Čas, který se u verze ukazuje: zveřejnění, a jen když chybí, nahrání. */
export function versionDate(version: { published_at?: string | null; uploaded_at: string }): string {
  return version.published_at ?? version.uploaded_at;
}

export type Change = {
  id: string;
  document_version_id: string;
  note: string;
  category: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  change_id: string;
  read_at: string | null;
  email_sent_at: string | null;
};

// Rozšířený tvar pro zobrazení v UI (spojené s modulem a poznámkami)
export type ModuleWithLatestVersion = Module & {
  latest_version: (DocumentVersion & { changes: Change[] }) | null;
  version_count: number;
  /** Nejnovější prezentace k lekci; verzuje se nezávisle na metodice. */
  latest_presentation: (DocumentVersion & { changes: Change[] }) | null;
  presentation_count: number;
};

export type Annotation = {
  id: string;
  document_version_id: string;
  page: number; // číslováno od 0
  // poloha jako podíl 0..1 vůči stránce
  x: number;
  y: number;
  w: number;
  h: number;
  note: string;
  category: string | null;
  created_at: string;
};

// Značka tak, jak s ní pracuje rozhraní – ať už je už uložená v databázi,
// nebo ji uživatel zrovna nakreslil.
export type Mark = {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  note: string;
  category: string | null;
  /** Text z PDF pod značkou (viz lib/pdf-quote.ts). Undefined = ještě nepřečtený. */
  quote?: string | null;
  /** Překlad pro zemi, která si cizí změnu čte (viz lib/mark-translation.ts). */
  translated?: MarkTranslation | null;
};

export type MarkTranslation = {
  note: string | null;
  quote: string | null;
  /** Jazyk originálu. */
  fromLocale: string;
};

// Stav metodiky pro jednu zemi: šedá = země k ní zatím nemá verzi,
// zelená = má verzi a nic nevyřízeného, žlutá = čeká se méně než 14 dní,
// červená = 14 dní a víc.
export type CountryLight = "none" | "green" | "yellow" | "red";

// Jedna vyznačená změna z jiné země, na kterou naše země ještě nereagovala.
export type PendingChange = {
  /** id řádku v annotation_country_status – s ním se změna odbavuje. */
  id: string;
  annotationId: string;
  createdAt: string;
  /** Kdy ji země skryla. Null u nevyřízených. */
  dismissedAt: string | null;
  /** Jak ji země vyřídila; u starších vyřízených chybí (= netýká se nás). */
  resolution: "done" | "not_relevant" | null;
  /** Kdy byla verze zveřejněná – to je čas, který dává smysl vedle jejího čísla. */
  publishedAt: string | null;
  /** Jazyk, ve kterém byla poznámka napsaná. */
  sourceLocale: string | null;
  /** Poznámka přeložená do jazyků ostatních zemí. */
  translations: Record<string, string>;
  translationFailed: boolean;
  moduleId: string;
  /** Český název; pro zobrazení použij moduleName() s moduleNames. */
  moduleName: string;
  moduleNames: {
    name: string;
    name_en: string | null;
    name_translations: Record<string, string> | null;
    local_name: string | null;
  };
  fromCountryName: string;
  /** Kdo verzi nahrál. U cizí země bývá prázdný – pravidla v databázi
   *  cizí e-maily neukazují. */
  uploadedByEmail: string | null;
  versionNumber: number | null;
  /** Označení verze, např. „10/26“. */
  versionLabel: string;
  page: number;
  note: string;
  category: string | null;
  /** Jde o změnu v metodice, nebo v prezentaci. */
  kind: DocumentKind;
  /** Země k lekci zatím nemá vlastní verzi tohohle druhu dokumentu. Takové
   *  změny se ukazují zvlášť a do nevyřízených (ani do semaforu) se nepočítají. */
  forMissingLesson: boolean;
  /** Text z PDF pod značkou v jazyce originálu a jeho překlady. */
  quote: string | null;
  quoteTranslations: Record<string, string>;
};
