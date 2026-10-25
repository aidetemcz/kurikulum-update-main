// Český slovník textů rozhraní. Je zároveň vzorem pro ostatní jazyky –
// když sem přidáš klíč, TypeScript si vyžádá jeho doplnění i v sk/en/hu.
//
// POZOR: překládá se jen rozhraní appky. Obsah nahraných PDF metodik
// se nikdy nepřekládá ani neupravuje.
export const cs = {
  // formát data podle zvyklostí jazyka
  // kód jazyka – podle něj se vybírá anglický název metodiky
  locale: "cs" as "cs" | "sk" | "en" | "hu",
  dateLocale: "cs-CZ",

  // název appky v levém horním rohu a na přihlášení
  appName: "AI kurikulum",

  // navigace
  // Klíč se jmenuje "overview" historicky, stránka ale od přesunu
  // katalogu na /modules ukazuje jen změny od ostatních zemí.
  overview: "Změny",
  upload: "Nahrát",
  admin: "Administrace",
  logout: "Odhlásit se",
  notifications: "Notifikace",
  noNotifications: "Zatím žádné notifikace.",

  // přehled modulů
  methodologies: "Metodiky",
  noModules: "Zatím žádné moduly",
  currentVersion: "Aktuální verze",
  totalVersions: "Celkem verzí",
  noVersionYet: "Zatím žádná nahraná verze.",
  kindQuestion: "Co nahráváš?",
  kindMethodology: "Metodika",
  kindPresentation: "Prezentace",
  noPresentationYet: "Prezentace zatím není nahraná.",
  kindHint: "Prezentace patří ke stejné lekci jako metodika, ale verzuje se zvlášť. Nahraj ji jako PDF (export z Google Slides, Canvy nebo PowerPointu).",
  noCategory: "Bez kategorie",

  // detail modulu a verze
  version: "Verze",
  uploaded: "Nahráno",
  noVersions: "Pro tento modul zatím není nahraná žádná verze.",
  downloadPdf: "Stáhnout PDF",
  viewPdf: "Zobrazit PDF",
  hidePdf: "Skrýt PDF",
  openPdf: "Otevřít PDF",
  fileUnavailable: "Soubor se nepodařilo načíst.",
  loadingPdf: "Načítám PDF...",
  pdfLoadFailed: "PDF se nepodařilo načíst",
  pdfLoadTry: "Zkontroluj prosím:",
  pdfLoadReasons: [
    "Sdílení souboru v Google Drive je nastavené na „Kdokoli s odkazem“ (Prohlížející). Bez toho appka soubor nestáhne – to je nejčastější příčina.",
    "Odkaz vede na soubor, ne na složku.",
    "Soubor je PDF. Google Dokument, Prezentaci Google, Word nebo PowerPoint nejdřív stáhni jako PDF a na Drive nahraj to PDF.",
    "Soubor není v koši a nikdo ho mezitím nepřesunul.",
  ],
  pdfLoadAfterFix: "Po opravě vlož odkaz znovu nebo obnov stránku.",
  openInDrive: "Otevřít v Google Drive",
  changesPanelTitle: "Co se v této verzi změnilo",
  changesPanelEmpty: "Zatím nic označeného.",

  // značkování změn v dokumentu
  annotateHint:
    "Táhni myší přes místo v dokumentu, které se změnilo — pak napiš, co se tam změnilo.",
  pasteLinkToSeeDocument: "Vlož odkaz na PDF z Google Drive a dokument se načte sem.",
  whatChangedHere: "Co se tady změnilo?",
  cancel: "Zrušit",
  saved: "Uloženo.",
  done: "Hotovo",
  saveChanges: "Uložit změny",
  saveFailedDetail: "Uložení se nepodařilo:",
  uploadedBy: "nahrál/a",
  existingVersionInfo: "Pro {country} už existuje verze {version} ({when}, nahrál/a {who}). Uloží se jako verze {next}.",
  firstVersionInfo: "Pro {country} to bude první verze.",
  concurrentWarning: "Mezitím přibyla verze {version} od {who} ({when}). Tvoje úprava se uložila jako verze {saved} — zkontroluj, jestli se nepřekrývají.",
  openThatVersion: "Otevřít modul",
  olderVersions: "Starší verze",
  latest: "nejnovější",
  firstVersion: "První verze",
  nothingToCompare: "Tohle je první zveřejněná verze, není co porovnávat.",
  changesAgainst: "Změny oproti verzi {version}",
  uploadedByWho: "Nahrál/a {who}",
  markedPlacesForms: "vyznačené místo|vyznačená místa|vyznačených míst",
  markedChangesForms: "vyznačená změna|vyznačené změny|vyznačených změn",
  summaryLabel: "Shrnutí",
  suggestSummary: "Navrhnout shrnutí",
  suggestingSummary: "Navrhuji…",
  suggestFailed: "Návrh se teď nepodařil, napiš shrnutí prosím ručně.",
  aiSuggested: "navrženo",
  noCategory2: "Bez kategorie",
  otherCategory: "Jiná…",
  otherCategoryPlaceholder: "vlastní název kategorie",
  savingDraft: "Ukládám…",
  draftSaved: "Rozpracováno — uloženo v {time}",
  draftFound: "Máš rozpracovanou verzi pro {module} / {country} (uloženo {time}).",
  continueDraft: "Pokračovat",
  startOver: "Začít znovu",
  newerVersionAppeared: "K tvé verzi {version} modulu {module} přibyla novější verze {newVersion}.",
  markDiscarded: "Označení zrušeno — bez popisu se neuloží.",
  markDeleted: "Značka smazána",
  undo: "Vrátit zpět",
  hideMarks: "Skrýt značky",
  showMarks: "Zobrazit značky",
  pageLabel: "Strana",
  summaryOptional: "Celkové shrnutí (nepovinné)",
  demoLabel: "takhle",
  edit: "Upravit",
  delete: "Smazat",
  needMarkOrSummary: "Označ aspoň jedno místo v dokumentu nebo napiš celkové shrnutí.",
  catContent: "Obsahová změna",
  catFix: "Oprava chyby",
  catLocalization: "Lokalizace",
  catNewPart: "Nová část",
  catFormal: "Formální úprava",

  // nahrání nové verze
  uploadNewVersion: "Nahrát novou verzi",
  module: "Modul",
  country: "Země",
  driveLink: "Odkaz na PDF v Google Drive",
  driveLinkHelp:
    "Ve složce/souboru v Drive musí být sdílení nastavené na „Kdokoli s odkazem“ (režim Prohlížející), jinak appka PDF nezobrazí.",
  driveLinkNotRecognized:
    "Nepodařilo se rozpoznat odkaz na Google Drive, zkontroluj prosím formát.",
  uploadMissingFields: "Vyplň prosím modul, zemi, odkaz na PDF i poznámku ke změně.",
  uploadForeignCountry: "Nahrávat jde jen za vlastní zemi.",
  uploadForWhichCountry: "Za kterou zemi nahráváš?",
  uploadForWhichCountryHint:
    "Máš přiřazených víc zemí, proto vybíráš. Kdo má jen jednu zemi, tuhle volbu nevidí a nahrává automaticky za ni.",
  uploadingFor: "Nahráváte za zemi {country}",
  uploadNotAllowed: "Nemáš oprávnění přidávat nové verze.",
  saveFailed: "Uložení se nepodařilo.",
  saving: "Ukládám...",
  changeCategory: "Kategorie změny",
  changeCategoryPlaceholder: "např. oprava, nový obsah, překlad",
  whatChanged: "Co se změnilo",
  whatChangedPlaceholder: "Popiš stručně změnu, ať čtenáři vědí, co se aktualizovalo.",
  uploadAndNotify: "Nahrát a upozornit",
  optional: "volitelné",
  noCountryForUpload: "Bez přiřazené země",

  // administrace
  countries: "Země",
  addCountry: "Přidat zemi",
  countryName: "Název země",
  languageCode: "jazyk (cs, sk, en...)",
  users: "Uživatelé",
  email: "E-mail",
  countryAndRole: "Země / role",
  save: "Uložit",
  inviteUser: "Pozvat uživatele",
  invite: "Pozvat",
  roleViewer: "čtenář",
  roleEditor: "editor",
  roleAdmin: "admin",

  // stavy bez země

  // přihlášení a volba jazyka před přiřazením země
  language: "Jazyk",
  emailPlaceholder: "jmeno@organizace.cz",
  sendLoginLink: "Poslat přihlašovací odkaz",
  sendingLoginLink: "Posílám odkaz...",
  loginLinkSent: "Poslali jsme ti odkaz na přihlášení na {email}. Zkontroluj e-mail (i spam).",
  loginRateLimit:
    "Vyčerpaný hodinový limit odesílání e-mailů. Zkus to prosím za hodinu znovu. Nejde o chybu tvého účtu.",
  loginFailed: "Něco se nepovedlo, zkus to prosím znovu.",
  loginLinkInvalid:
    "Přihlašovací odkaz nefungoval. Mohl vypršet nebo už byl použitý, případně ses o něj řekl/a v jiném prohlížeči. Pošli si nový a otevři ho ve stejném prohlížeči.",
  loginAccountMissing: "Přihlášení proběhlo, ale tvůj účet v appce chybí. Ozvi se prosím administrátorovi.",
  noCountryAssigned: "Zatím ti není přiřazená žádná země. Ozvi se administrátorovi appky.",
  noCountriesYet: "Zatím není založená žádná země. Přidej ji v Administraci.",

  // změny od ostatních zemí a semafor rozpracovanosti
  changesFromOthers: "Změny od ostatních zemí",
  showInDocument: "Zobrazit v dokumentu",
  notRelevant: "Netýká se nás",
  dismissedToast: "Označeno jako netýkající se nás.",
  fromCountryVersion: "{country}, verze {version}",
  readiness: "Semafor rozpracovanosti",
  readinessHint:
    "Barva se řídí nejstarší nevyřešenou změnou: do 14 dnů žlutá, od 14 dnů červená.",
  lightOk: "v pořádku",
  lightWaiting: "čeká se",
  lightAct: "potřeba reagovat",
  moduleColumn: "Metodika",
  changeNotFound: "Tuhle změnu se nepodařilo najít.",
  publishBlocked:
    "Databáze zápis odmítla. Zkontroluj, jestli jsou v Supabase spuštěné všechny migrace ze složky supabase/migrations.",

  changesFromOthersCount: "Změny od ostatních zemí ({count})",
  tabCurrent: "Aktuální",
  tabHidden: "Skryté",
  confirmDismissYes: "Ano, netýká se nás",
  restoreToCurrent: "Vrátit mezi aktuální",
  noHiddenChanges: "Zatím jste nic neskryli.",
  hiddenAt: "Skryto",

  // rozpoznání metodiky a výběr při nahrávání
  recognizedAs: "Rozpoznáno: {name}",
  change: "změnit",
  maybeOneOf: "Vypadá to na jednu z těchto:",
  searchModule: "Hledat metodiku",
  nothingFound: "Nic nenalezeno",
  ungrouped: "Bez zařazení",

  // katalog metodik v administraci
  catalogTitle: "Katalog metodik",
  catalogHint:
    "Zdrojem pravdy je web kurikulum.aidetem.cz. Import nikdy nic nemaže — metodika, která z webu zmizí, se jen archivuje. Ručně přidaných metodik se import nedotkne.",
  catalogLoad: "Načíst katalog z kurikulum.aidetem.cz",
  catalogLoading: "Načítám katalog…",
  catalogPreviewTitle: "Co import udělá",
  catalogWillAdd: "Přibude ({count})",
  catalogWillRename: "Přejmenuje se ({count})",
  catalogWillLink: "Spáruje se s webem ({count})",
  catalogWillArchive: "Archivuje se ({count})",
  catalogWillUnarchive: "Vrátí se z archivu ({count})",
  catalogWillRecategorize: "Přesune se do jiné sekce ({count})",
  catalogWillSetEnglish: "Doplní se anglický název ({count})",
  catalogPunctuationOnly: "liší se jen interpunkcí",
  catalogNotInCatalog: "Není v katalogu webu ({count})",
  catalogNotInCatalogHint:
    "Ručně založené metodiky. Import se jich nedotkne — smazat nebo archivovat je musíš sama.",
  catalogUnmatchedEnglish: "Anglické názvy bez páru ({count})",
  manualModule: "ručně přidaná",
  catalogUnchanged: "Beze změny: {count} z {total}",
  catalogConfirm: "Provést import",
  catalogCancel: "Zrušit",
  catalogNothingToDo: "Katalog je aktuální, není co měnit.",
  catalogDone:
    "Hotovo — přibylo {added}, přejmenováno {renamed}, spárováno {linked}, přesunuto {recategorized}, anglických názvů {english}, archivováno {archived}.",
  addModule: "Přidat metodiku",
  moduleName: "Název metodiky",
  moduleSection: "Sekce",
  moduleNameEn: "Anglický název",
  archiveModule: "Archivovat",
  unarchiveModule: "Vrátit z archivu",
  archivedLabel: "archivováno",
  cannotDeleteModule: "Nejde smazat, existují verze",

  // zkušební e-mail, prázdný stav a překlady poznámek
  testEmail: "Poslat zkušební e-mail",
  testEmailHint: "Pošle ukázkovou notifikaci na tvou adresu, stejnou šablonou jako naostro.",
  testEmailSent: "Zkušební e-mail odešel. Zkontroluj schránku i spam.",
  testEmailFailed: "Odeslání se nepovedlo:",
  noUpdatesTitle: "Žádné nové aktualizace metodik.",
  noUpdatesHint: "Až některá země něco změní, uvidíte to tady.",
  publishedAt: "zveřejněno",
  machineTranslatedFrom: "Automatický překlad {language} — zobrazit originál",
  highlightedText: "Text ve zvýrazněné části",
  showTranslation: "Zobrazit překlad",
  translationFailed: "Překlad se nepovedl, níže je původní znění.",
  langCs: "z češtiny",
  langSk: "ze slovenštiny",
  langEn: "z angličtiny",
  langHu: "z maďarštiny",

  // tiché opravy adminem
  adminEditMode: "Opravit tuhle verzi",
  adminEditHint:
    "Oprava nikomu nic nepošle: nevzniká nová verze, e-maily neodcházejí a ostatním zemím zůstává stav, jaký mají.",
  adminSaveEdit: "Uložit opravu",
  adminDeleteVersion: "Smazat verzi",
  adminBackToReading: "Zpět na čtení",

  mailNotConfigured:
    "Odesílání e-mailů není nastavené — ve Vercelu chybí proměnné SMTP_USER / SMTP_PASSWORD. Appka běží dál, jen notifikace neodcházejí.",
  schemaOutdated: "Databáze není aktuální, chybí migrace {files}. Spusť je v Supabase (SQL Editor).",
  allModules: "Všechny metodiky",
  hideAllModules: "Skrýt ostatní metodiky",
  uiLanguage: "Jazyk rozhraní",
  byCountry: "podle země",

  // potvrzovací okna
  menu: "Menu",
  close: "Zavřít",
  confirmHideTitle: "Opravdu skrýt tuto změnu?",
  confirmHideExplain:
    "Změna se přestane zobrazovat mezi aktuálními. Najdete ji v záložce Skryté a můžete ji kdykoli vrátit zpátky.",
  confirmArchiveTitle: "Opravdu archivovat metodiku?",
  confirmArchiveExplain:
    "Metodika se přestane nabízet při nahrávání a zmizí z Přehledu. Nahrané verze i vyznačené změny zůstávají a archivaci jde kdykoli vrátit.",
  confirmArchiveYes: "Ano, archivovat",
  confirmDeleteModuleTitle: "Opravdu smazat metodiku?",
  confirmDeleteModuleExplain:
    "Metodika nemá žádnou nahranou verzi, takže se smaže úplně. Vrátit to nejde.",
  confirmDeleteYes: "Ano, smazat",
  confirmDiscardDraftTitle: "Opravdu zahodit rozpracovanou verzi?",
  confirmDiscardDraftExplain:
    "Značky, které jste zatím vyznačili, se smažou a začnete znovu od prázdného dokumentu. Vrátit to nejde.",
  confirmDiscardYes: "Ano, zahodit",
  confirmDeleteVersionTitle: "Opravdu smazat celou verzi?",
  confirmDeleteVersionExplain:
    "Verze zmizí i se všemi vyznačenými změnami a ostatní země ji přestanou mít ve schránce. Vrátit to nejde.",

  lightNone: "zatím bez verze",
  legendTitle: "Vysvětlivky",

  previewAsEditor: "Zobrazit jako editor",
  previewHint:
    "Prohlédne appku očima editora vybrané země. Žádná práva se tím nerozšiřují – naopak, v náhledu platí jen práva té jedné země.",
  previewBanner: "Prohlížíte jako editor ({country})",
  previewEnd: "ukončit náhled",
};

export type Dictionary = typeof cs;
