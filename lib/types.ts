// Typy, které odpovídají tabulkám v Supabase (viz supabase/migrations/0001_init.sql).
// Když přidáš/změníš sloupec v databázi, uprav ho i tady.

export type UserRole = "admin" | "editor" | "viewer";

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
  order_index: number;
  /** Metodika, která z webu zmizela. Nemaže se, jen se schová. */
  archived_at: string | null;
  created_at: string;
};

export type DocumentVersion = {
  id: string;
  module_id: string;
  country_id: string;
  file_url: string;
  version_number: number;
  uploaded_at: string;
  uploaded_by: string | null;
};

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
  /** Kdy byla verze zveřejněná – to je čas, který dává smysl vedle jejího čísla. */
  publishedAt: string | null;
  /** Jazyk, ve kterém byla poznámka napsaná. */
  sourceLocale: string | null;
  /** Poznámka přeložená do jazyků ostatních zemí. */
  translations: Record<string, string>;
  translationFailed: boolean;
  moduleId: string;
  moduleName: string;
  fromCountryName: string;
  /** Kdo verzi nahrál. U cizí země bývá prázdný – pravidla v databázi
   *  cizí e-maily neukazují. */
  uploadedByEmail: string | null;
  versionNumber: number | null;
  page: number;
  note: string;
  category: string | null;
  /** Text z PDF pod značkou v jazyce originálu a jeho překlady. */
  quote: string | null;
  quoteTranslations: Record<string, string>;
};
