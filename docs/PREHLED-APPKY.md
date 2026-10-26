# AI kurikulum – přehled appky

Podklad pro revizi: najít díry (logika, UX, bezpečnost) a navrhnout lepší UI.
Kód: repozitář `aidetemcz/kurikulum-update-main`, živě na `https://kurikulum-update-main.vercel.app`.

## O co jde

Nezisková organizace **AI dětem** (ČR) vytváří **AI kurikulum**: sadu zhruba 50 lekcí
pro školy. Každá lekce má **metodiku** (PDF pro učitele, anglicky „teaching material“)
a k ní často **prezentaci** (PDF). Katalog lekcí žije na webu `kurikulum.aidetem.cz`.

Kurikulum používají i **partnerské země**: Česko, Slovensko, Velká Británie, Maďarsko
(další mohou přibýt). Každá země má vlastní, přeložené a lokalizované verze PDF.

**Problém, který appka řeší:** když jedna země lekci upraví (oprava chyby, nový obsah,
změna nástroje…), ostatní země se to musí dozvědět, pochopit *co přesně* se změnilo
a zapracovat to do své verze. Dřív se to ztrácelo v e-mailech.

**Appka slouží k oznamování a sledování změn mezi zeměmi.** Neslouží k procházení
nebo stahování metodik pro učitele. Uživatelé jsou lidé, kteří za danou zemi kurikulum
spravují a překládají (malý počet lidí, žádní žáci ani učitelé).

## Role

| Role | Co smí |
|---|---|
| **admin** (AI dětem) | vše: země, uživatelé, katalog metodik, opravy cizích verzí, zprávy zemím, náhled appky „jako země X“ |
| **editor** | nahrává a zveřejňuje nové verze za svou zemi (země přiřazené k účtu, může jich mít víc), odbavuje změny od ostatních |
| **čtenář** | jen čte |

Uživatel může mít přiřazených víc zemí (např. Česko i Velkou Británii), mezi nimi přepíná.
Uživatel bez přiřazené země vidí jen výzvu a vlaječky pro volbu jazyka.

## Hlavní tok

1. **Nahrání verze** (stránka Nahrát): editor vybere metodiku z katalogu (hledáním,
   případně ji appka rozpozná z PDF), druh dokumentu (metodika / prezentace) a vloží
   **odkaz na PDF v Google Drive** (sdílení „Kdokoli s odkazem“). Soubor se do appky
   nenahrává, ukládá se jen odkaz.
2. **Vyznačení změn:** v náhledu PDF editor tažením nakreslí **červené rámečky** kolem
   změněných míst. Ke každému napíše poznámku („co se tu změnilo“) a zvolí jeden nebo
   víc druhů změny: obsahová změna, oprava chyby, lokalizace, nová část, formální úprava,
   případně vlastní. AI druh změny navrhne podle poznámky. Appka si uloží i text z PDF
   pod rámečkem. Rozpracovaná verze (draft) se ukládá průběžně.
3. **Zveřejnění:** verze dostane číslo, každá vyznačená změna se rozešle **všem ostatním
   zemím, které danou metodiku sledují**. Poznámky, shrnutí i text pod rámečkem se
   **automaticky přeloží** (Claude Haiku) do jazyků ostatních zemí. Lidé z těch zemí
   dostanou e-mail a notifikaci (zvoneček).
4. **Odbavení:** země na přehledu **Změny** vidí nevyřízené změny od ostatních, každou
   otevře přímo v dokumentu na místě rámečku. Poznámka i zvýrazněný text jsou v jejím
   jazyce, originál jde zobrazit. Změnu jde jen skrýt tlačítkem **„Netýká se nás“**
   (jde vrátit mezi aktuální). Samostatný stav „zapracováno“ neexistuje.
5. **Semafor** u každé metodiky a země: šedá = země k lekci nemá verzi, zelená = nic
   nevyřízeného, žlutá = nevyřízená změna mladší 14 dní, červená = 14 dní a víc.
   Metodika a prezentace mají semafor zvlášť.

## Stránky

| Stránka | Pro koho | Obsah |
|---|---|---|
| `/` **Změny** (přehled) | všichni | nevyřízené změny od ostatních zemí, filtr podle druhu změny, šipky předchozí/další, skryté změny; dole sekce **Sledované metodiky** (výběr, které lekce země používá; dokud si nevybere, sleduje vše a nahoře svítí výzva) |
| `/modules` **Metodiky** | všichni | katalog všech lekcí po sekcích, karta = název, aktuální verze, prezentace, semafory |
| `/modules/[id]` detail metodiky | všichni | historie verzí země, náhled PDF s rámečky a panel změn, přejmenování lekce pro svou zemi (tužka), admin může verzi opravit |
| `/changes/[id]` | všichni | jedna změna jiné země otevřená v dokumentu |
| `/admin/upload` **Nahrát** | admin, editor | nahrání a vyznačení nové verze |
| `/help` **Napsat adminovi** | ne-admin | chat s adminy (vlákno na uživatele), odpověď chodí i e-mailem |
| `/admin` **Administrace** | admin | země, uživatelé (pozvání, role, země), import katalogu z webu, matice semaforů, náhled „jako země X“ |
| `/admin/messages` **Zprávy** | admin | psaní zemím (všem lidem vybraných zemí) nebo jednomu člověku; pod tím konverzace s uživateli |
| `/login` | nepřihlášení | přihlášení odkazem v e-mailu (magic link), vlaječky jazyků |

## Jazyky

- Rozhraní: čeština, slovenština, angličtina, maďarština. Jazyk = nastavení uživatele,
  jinak jazyk jeho první země.
- Názvy lekcí: česky (zdroj), anglicky (z anglického webu), slovensky a maďarsky
  (přeloženo). Každá země si může lekci **přejmenovat jen pro sebe**.
- Poznámky ke změnám se překládají automaticky; co se při zveřejnění nepřeložilo
  (např. chyběl klíč k AI), appka dopřeloží na pozadí.
- V angličtině se říká „teaching material“, ne „methodology“.

## Technika (stručně)

Next.js 15 (App Router, server actions) na Vercelu (region Frankfurt) · Supabase (Postgres,
přihlášení magic linkem, RLS pravidla) · PDF přes react-pdf z Google Drive (přes vlastní
proxy `/api/pdf/[id]`) · e-maily přes SMTP (Google Workspace) · Anthropic API (překlady,
návrhy druhu změny). Texty rozhraní v `lib/i18n/{cs,sk,en,hu}.ts`, databáze
v `supabase/migrations/0001–0016`.

## Vizuální styl (AI dětem)

Korálová `#DC5B5B` (hlavní akce, rámečky změn), sekundární `#B3CDD6`, světlá `#DAE7EC`,
tmavý text `#070707`. Písma Darker Grotesque (nadpisy) + Inter (text). Pilulkové štítky,
čárkované oddělovače, plusové odrážky, ikona robota. Méně textu, víc vizuálu, nic
generického („AI slop“).

## Pevná rozhodnutí (neměnit)

- Zemím se **neukazují technické důvody chyb** (chybějící klíč, kredit…), jen obecná
  hláška. Provozní hlášky vidí jen admin.
- Nahrává se vždy jen za vlastní zemi, platí i pro admina.
- Metodiky samotné se nepřekládají, každá země si drží vlastní PDF.
- Appka bude většinu času prázdná (změn je málo) a to je v pořádku.

## Známá slabá místa (k prověření)

- Změna se zemím rozesílá jen ve chvíli zveřejnění. Země přidaná později nebo změna
  sledovaných lekcí zpětně nic nedoplní (nová země už dostává dosavadní změny).
- Chybí stav „zapracováno“: změnu jde jen skrýt jako „Netýká se nás“, i když ji země
  ve skutečnosti zapracovala. Nahrání nové verze vlastní země změny neodbaví samo.
  Semafor proto může svítit červeně, i když je hotovo.
- Závislost na Google Drive: když soubor není sdílený „kdokoli s odkazem“, PDF se
  nenačte. Uživatel to musí pochopit z hlášky.
- Přeložený text pod rámečkem leží přímo v PDF přes originál a písmo se zmenšuje, aby se
  vešel (minimum 6 px). U malého rámečku a dlouhého překladu je nečitelný. Originál se
  ukáže najetím myší, na dotykovém zařízení vůbec.
- E-maily (notifikace, zprávy) jsou jen česky, bez ohledu na jazyk příjemce.
- Názvy zemí se nepřekládají (vidí je všichni tak, jak je admin zapsal).
- Žádné automatické testy uživatelských toků.
- README v repu je zastaralé.
- Mobil: appka je použitelná, ale kreslení rámečků a čtení PDF je primárně na počítač.

## Co od revize chci

1. **Díry v logice a tocích:** kde se změna může ztratit, kde uživatel nepochopí, co má
   udělat, chybějící stavy (prázdné, chyba, načítání), co rozbije přidání nové země nebo
   uživatele s více zeměmi.
2. **Bezpečnost a práva:** kdo co smí vidět a měnit (RLS, server actions, náhled admina).
3. **UI/UX návrh:** přehlednější přehled změn, nahrávání a detail metodiky. Konkrétně:
   co je na které obrazovce zbytečné, co chybí, jak zjednodušit. Návrhy jako popis
   obrazovek nebo kód v Tailwindu (`components/`), ve stylu AI dětem výše.
4. Seřadit podle dopadu: nejdřív to, co uživatelům reálně vadí nebo ztrácí data.
