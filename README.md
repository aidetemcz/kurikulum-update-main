# AI kurikulum

Appka pro sdílení metodik AI kurikula s partnerskými zeměmi (ČR, Slovensko,
Velká Británie, Maďarsko). Admin/editor přidá novou verzi PDF metodiky
a napíše, co se změnilo – lidé z dané země dostanou e-mail a notifikaci
v appce a vidí jen dokumenty pro svou zemi a jazyk.

PDF metodik leží na **Google Drive**, appka si k nim ukládá jen odkaz.
Sdílení souboru v Drive musí být nastavené na „Kdokoli s odkazem“ (režim
Prohlížející), jinak appka PDF nezobrazí.

Postavené na: **Next.js** (appka) + **Supabase** (přihlášení, databáze)
+ **Resend** (posílání e-mailů).

## Co appka zatím umí (první verze)

1. Přihlášení přes magic link (odkaz v e-mailu, žádné heslo).
2. Admin/editor vloží odkaz na PDF v Google Drive k modulu pro danou zemi
   + napíše poznámku, co a proč se změnilo.
3. Čtenář vidí jen moduly/dokumenty pro svou zemi, v mřížce karet, u každého
   modulu historii verzí a poznámky ke změnám.
4. Při přidání nové verze appka pošle e-mail (přes Resend) a vytvoří
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
  notify.ts / resend.ts       – posílání notifikací a e-mailů

supabase/migrations/0001_init.sql
                        – SQL skript, který v Supabase založí všechny
                          tabulky a bezpečnostní pravidla (kdo co smí vidět)
```

## Jak appku poprvé nastavit

### 1. Založit Supabase projekt

1. Jdi na [supabase.com](https://supabase.com) → New project (zdarma).
2. Po vytvoření jdi do **SQL Editor** → New query, vlož celý obsah souboru
   `supabase/migrations/0001_init.sql` a klikni **Run**. Tím se založí
   všechny tabulky a pravidla.
3. V **Authentication → Providers** zkontroluj, že je zapnuté přihlášení
   e-mailem (Email provider, "Enable email OTP / magic link" – bývá zapnuté
   ve výchozím nastavení).
4. V **Authentication → URL Configuration** nastav Site URL na adresu appky
   (lokálně `http://localhost:3000`, po nasazení URL z Vercelu).
5. V **Settings → API** si zkopíruj `Project URL`, `anon public` klíč a
   `service_role` klíč (ten druhý je tajný, nikam ho nesdílej).

### 2. Založit Resend účet (posílání e-mailů)

1. Jdi na [resend.com](https://resend.com), založ účet zdarma.
2. Ověř si doménu nebo použij testovací `onboarding@resend.dev` adresu pro
   začátek.
3. V **API Keys** si vytvoř klíč.

### 3. Nastavit appku lokálně

```bash
npm install
cp .env.example .env.local
```

Do `.env.local` vyplň hodnoty ze Supabase a Resend (viz `.env.example` –
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
   (Supabase URL/klíče, Resend klíč a `RESEND_FROM_EMAIL`, případně
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
- Nové proměnné se projeví až při dalším sestavení appky. Po jejich přidání
  je potřeba appku znovu nasadit (Redeploy nebo nový commit).

Po nasazení nezapomeň v Supabase (**Authentication → URL Configuration**)
změnit Site URL na ostrou adresu appky, jinak magic-link odkazy budou mířit
na localhost.
