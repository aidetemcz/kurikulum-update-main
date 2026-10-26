# AI kurikulum

Appka pro sdílení metodik AI kurikula s partnerskými zeměmi (ČR, Slovensko,
Velká Británie, Maďarsko). Admin/editor přidá novou verzi PDF metodiky
a napíše, co se změnilo – lidé z dané země dostanou e-mail a notifikaci
v appce a vidí jen dokumenty pro svou zemi a jazyk.

PDF metodik leží na **Google Drive**, appka si k nim ukládá jen odkaz.
Sdílení souboru v Drive musí být nastavené na „Kdokoli s odkazem“ (režim
Prohlížející), jinak appka PDF nezobrazí.

Postavené na: **Next.js** (appka) + **Supabase** (přihlášení, databáze)
+ **vlastní e-mailová schránka přes SMTP** (posílání e-mailů, např.
Gmail / Google Workspace – nic se neplatí ani neověřuje v DNS).

## Co appka zatím umí (první verze)

1. Přihlášení přes magic link (odkaz v e-mailu, žádné heslo).
2. Admin/editor vloží odkaz na PDF v Google Drive k modulu pro danou zemi
   + napíše poznámku, co a proč se změnilo.
3. Čtenář vidí jen moduly/dokumenty pro svou zemi, v mřížce karet, u každého
   modulu historii verzí a poznámky ke změnám.
4. Při přidání nové verze appka pošle e-mail (z vaší schránky přes SMTP) a vytvoří
   notifikaci (zvoneček nahoře) všem lidem z dané země.
5. Základní administrace: přidání země, pozvání nového uživatele a
   přiřazení země/role.

**Zatím NENÍ implementované** (plánováno na později): propojení s Canvou,
automatická detekce změn mezi PDF verzemi pomocí AI.

## Struktura appky (kam se dívat, když se v tom budeš orientovat s AI)

```
app/                    – jednotlivé stránky appky (routing podle složek)
  page.tsx                 – hlavní přehled (mřížka modulů)
  login/page.tsx            – přihlašovací stránka (magic link)
  modules/[moduleId]/       – detail modulu a historie verzí
  admin/                    – administrace (země, uživatelé)
  admin/upload/              – formulář pro přidání nové verze (odkaz na PDF)
  auth/                     – technické stránky pro přihlášení/odhlášení

components/             – znovupoužitelné kousky UI (karta modulu, sidebar,
                           zvoneček s notifikacemi...)

lib/                    – "mozek" appky mimo UI
  supabase/                – napojení na Supabase databázi
  types.ts                 – popis datových typů (odpovídá tabulkám v DB)
  current-user.ts           – kdo je přihlášený, jakou má roli
  modules-data.ts            – načítání modulů a verzí z databáze
  notify.ts / mail.ts         – posílání notifikací a e-mailů

supabase/migrations/0001_init.sql
                        – SQL skript, který v Supabase založí všechny
                          tabulky a bezpečnostní pravidla (kdo co smí vidět)
```

## Jak appku poprvé nastavit

### 1. Založit Supabase projekt

1. Jdi na [supabase.com](https://supabase.com) → New project (zdarma).
2. Po vytvoření jdi do **SQL Editor** → New query, vlož celý obsah souboru
   `supabase/setup_all.sql` a klikni **Run**. Jsou v něm všechny migrace
   `0001`–`0017` za sebou, takže se založí všechny tabulky a pravidla.
   Když přibude nová migrace, pusť v SQL Editoru jen ji (a doplň ji i do
   `setup_all.sql`).
3. V **Authentication → Providers** zkontroluj, že je zapnuté přihlášení
   e-mailem (Email provider, "Enable email OTP / magic link" – bývá zapnuté
   ve výchozím nastavení).
4. V **Authentication → URL Configuration** nastav Site URL na adresu appky
   (lokálně `http://localhost:3000`, po nasazení URL z Vercelu).
5. V **Settings → API** si zkopíruj `Project URL`, `anon public` klíč a
   `service_role` klíč (ten druhý je tajný, nikam ho nesdílej).

### 2. Nastavit posílání e-mailů (Gmail / Google Workspace)

Všechny e-maily – přihlašovací odkazy, pozvánky i upozornění na změny –
odcházejí z jedné vaší schránky (např. `aplikace@aidetem.cz`). Platí se nic
a v DNS se nic nenastavuje. Google Workspace pustí ~2 000 e-mailů denně,
běžný Gmail ~500.

**a) Heslo pro aplikace v Google účtu**

1. Přihlas se do Google účtu schránky, ze které se bude posílat.
2. Na [myaccount.google.com/security](https://myaccount.google.com/security)
   zapni **Dvoufázové ověření** (bez něj heslo pro aplikace nejde vytvořit).
3. Otevři [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
   napiš název (např. „AI kurikulum“) a klikni **Vytvořit**.
4. Zkopíruj 16místné heslo (mezery nevadí). Je to `SMTP_PASSWORD`, adresa
   schránky je `SMTP_USER`.

U Google Workspace musí mít admin domény povolené dvoufázové ověření
(admin.google.com → Zabezpečení → Ověřování → Dvoufázové ověření).

**b) Supabase – přihlašovací odkazy a pozvánky přes stejnou schránku**

Bez tohohle kroku posílá Supabase přihlašovací e-maily vestavěnou poštou,
která pustí jen pár zpráv za hodinu. Vlastní SMTP jde nastavit i zdarma.

1. V Supabase jdi do **Authentication → Emails → SMTP Settings** a zapni
   **Enable Custom SMTP**.
2. Vyplň:
   - Sender email: adresa schránky (stejná jako `SMTP_USER`)
   - Sender name: `AI kurikulum`
   - Host: `smtp.gmail.com`, Port: `465`
   - Username: adresa schránky, Password: heslo pro aplikace z bodu a)
3. Ulož. Pak v **Authentication → Rate Limits** zvyš „Rate limit for
   sending emails“ (např. na 100 za hodinu).

**Jiná pošta než Google:** postup je stejný, jen se v Supabase i ve Vercelu
vyplní adresa a port SMTP serveru vašeho poskytovatele (`SMTP_HOST`,
`SMTP_PORT`).

### 3. Nastavit appku lokálně

```bash
npm install
cp .env.example .env.local
```

Do `.env.local` vyplň hodnoty ze Supabase a ze schránky (viz `.env.example` –
každá proměnná má komentář, co do ní patří).

```bash
npm run dev
```

Appka poběží na http://localhost:3000.

### 4. Vytvořit prvního admina

Appka na začátku nemá žádného uživatele. Postup:

1. Otevři appku, na `/login` zadej svůj e-mail, přihlas se přes odkaz
   z e-mailu (vytvoří se ti účet s rolí "viewer" a bez přiřazené země).
2. V Supabase jdi do **Table Editor → users**, najdi svůj řádek a ručně mu
   nastav `role` na `admin`.
3. Znovu appku načti – teď uvidíš v levém panelu i "Administrace", kde už
   si můžeš přidat zemi a zvát další lidi normálně přes appku.

### 5. Nasazení na Vercel

Postup je stejný jako u předchozí appky v tomhle repu:
1. vercel.com → Add New → Project → vybrat tenhle repo (větev `main`).
2. V Environment Variables vyplnit stejné proměnné jako v `.env.local`
   (Supabase URL/klíče, `SMTP_USER` a `SMTP_PASSWORD`, případně
   `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL` = URL, kterou ti Vercel přidělí).
3. Deploy.

Na co si dát pozor v Environment Variables na Vercelu:
- Názvy proměnných musí sedět přesně včetně `NEXT_PUBLIC_` na začátku.
  Bez toho prefixu je appka nenajde a spadne na hlášce
  "Your project's URL and Key are required to create a Supabase client".
- Proměnné s `NEXT_PUBLIC_` zakládej jako typ **Config** (ne Secret) –
  appka je potřebuje číst už při sestavování. U anon klíče Vercel upozorní,
  že by mohl být citlivý; u Supabase anon klíče je to v pořádku ("Mark as
  Safe"), chrání ho pravidla Row Level Security v databázi.
- `SUPABASE_SERVICE_ROLE_KEY` naopak nech jako **Secret** a nikdy mu
  nedávej prefix `NEXT_PUBLIC_` – ten se nesmí dostat do prohlížeče.
- Stejně tak `SMTP_PASSWORD` nech jako **Secret**. Kdo ho má, může
  posílat poštu za vaši schránku.
- Po přechodu z Resendu můžeš ve Vercelu smazat `RESEND_API_KEY`
  a `RESEND_FROM_EMAIL`, appka je už nepoužívá.
- Nové proměnné se projeví až při dalším sestavení appky. Po jejich přidání
  je potřeba appku znovu nasadit (Redeploy nebo nový commit).

Po nasazení nezapomeň v Supabase (**Authentication → URL Configuration**)
změnit Site URL na ostrou adresu appky, jinak magic-link odkazy budou mířit
na localhost.
