-- Celá databáze appky najednou: migrace 0001–0016 za sebou.
-- Vlož do Supabase → SQL Editor → New query a klikni na Run.
-- Je určená pro prázdný projekt. Kde už migrace běžely, pouštěj jen ty chybějící.

-- ====================================================================
-- 0001_init.sql
-- ====================================================================
-- AI kurikulum – základní databázové schéma
-- Spustit v Supabase projektu: SQL Editor -> New query -> vlož celý soubor -> Run
-- (nebo přes Supabase CLI: supabase db push)

-- ---------------------------------------------------------------------
-- 1. Tabulky
-- ---------------------------------------------------------------------

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  locale text not null, -- napr. 'cs', 'sk', 'en', 'hu'
  created_at timestamptz not null default now()
);

do $$ begin
  create type user_role as enum ('admin', 'editor', 'viewer');
exception
  when duplicate_object then null;
end $$;

-- Vlastní tabulka uživatelů, propojená 1:1 s auth.users (přihlašování řeší Supabase Auth).
create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  country_id uuid references countries (id) on delete set null,
  role user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules (id) on delete cascade,
  country_id uuid not null references countries (id) on delete cascade,
  file_url text not null,
  version_number integer not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references users (id) on delete set null,
  unique (module_id, country_id, version_number)
);

create table if not exists changes (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references document_versions (id) on delete cascade,
  note text not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  change_id uuid not null references changes (id) on delete cascade,
  read_at timestamptz,
  email_sent_at timestamptz
);

-- ---------------------------------------------------------------------
-- 2. Automatické založení řádku v public.users při registraci
-- ---------------------------------------------------------------------
-- Když se někdo poprvé přihlásí přes magic link, Supabase Auth vytvoří
-- záznam v auth.users. Tenhle trigger k němu automaticky založí i řádek
-- v public.users (zatím bez země, s rolí 'viewer') – admin mu pak v appce
-- přiřadí zemi a případně vyšší roli.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- 3. Row Level Security (kdo co smí vidět/měnit)
-- ---------------------------------------------------------------------

alter table countries enable row level security;
alter table users enable row level security;
alter table modules enable row level security;
alter table document_versions enable row level security;
alter table changes enable row level security;
alter table notifications enable row level security;

-- Pomocná funkce: je aktuálně přihlášený uživatel admin?
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- Pomocná funkce: country_id aktuálně přihlášeného uživatele.
create or replace function public.current_country_id()
returns uuid
language sql security definer set search_path = public
as $$
  select country_id from public.users where id = auth.uid();
$$;

-- countries: číst může každý přihlášený, měnit jen admin.
create policy "countries jsou viditelne pro prihlasene" on countries
  for select to authenticated using (true);
create policy "countries meni jen admin" on countries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- users: každý vidí sám sebe, admin vidí a spravuje všechny.
create policy "uzivatel vidi sam sebe" on users
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admin spravuje uzivatele" on users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "uzivatel si upravi jen sebe (bez zmeny role)" on users
  for update to authenticated using (id = auth.uid());

-- modules: číst může každý přihlášený, spravovat jen admin.
create policy "moduly jsou viditelne pro prihlasene" on modules
  for select to authenticated using (true);
create policy "moduly meni jen admin" on modules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- document_versions: viewer vidí jen svou zemi, admin/editor vidí i nahrávají.
create policy "verze vidi jen sva zeme nebo admin" on document_versions
  for select to authenticated
  using (country_id = public.current_country_id() or public.is_admin());
create policy "verze naharava admin nebo editor" on document_versions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

-- changes: viditelné, pokud je vidět příslušná verze dokumentu.
create policy "zmeny vidi kdo vidi verzi" on changes
  for select to authenticated
  using (
    exists (
      select 1 from document_versions dv
      where dv.id = changes.document_version_id
        and (dv.country_id = public.current_country_id() or public.is_admin())
    )
  );
create policy "zmeny zapisuje admin nebo editor" on changes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

-- notifications: uživatel vidí a upravuje (označí přečtené) jen svoje.
create policy "notifikace vidi jen vlastnik" on notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifikace oznaci precteno jen vlastnik" on notifications
  for update to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. PDF soubory
-- ---------------------------------------------------------------------
-- PDF metodik leží na Google Drive, v databázi je jen odkaz na ně
-- (document_versions.file_url). Appka proto nepotřebuje žádné vlastní
-- úložiště souborů.


-- ====================================================================
-- 0002_annotations.sql
-- ====================================================================
-- Označená místa v dokumentu (značky) a jejich popisy.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

create table if not exists annotations (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references document_versions (id) on delete cascade,
  page int not null, -- číslováno od 0
  -- poloha a velikost jako podíl 0..1 vůči stránce, aby značka seděla
  -- i po změně velikosti okna
  x real not null,
  y real not null,
  w real not null,
  h real not null,
  note text not null,
  category text,
  created_at timestamptz not null default now()
);

create index if not exists annotations_version_idx
  on annotations (document_version_id);

alter table annotations enable row level security;

-- Značky vidí ten, kdo vidí příslušnou verzi dokumentu.
create policy "znacky vidi kdo vidi verzi" on annotations
  for select to authenticated
  using (
    exists (
      select 1 from document_versions dv
      where dv.id = annotations.document_version_id
        and (dv.country_id = public.current_country_id() or public.is_admin())
    )
  );

-- Zakládat, upravovat a mazat je smí admin a editor.
create policy "znacky zapisuje admin nebo editor" on annotations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

create policy "znacky upravuje admin nebo editor" on annotations
  for update to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

create policy "znacky maze admin nebo editor" on annotations
  for delete to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );


-- ====================================================================
-- 0003_drafts.sql
-- ====================================================================
-- Rozpracovaná verze (draft): značky se ukládají průběžně, ale verze se
-- v přehledu objeví a notifikace odejdou až při zveřejnění.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

alter table document_versions
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz;

-- Číslo verze se přiděluje až při zveřejnění, rozpracovaná ho nemá.
alter table document_versions
  alter column version_number drop not null;

-- Všechno, co v databázi bylo před touhle změnou, je zveřejněné.
update document_versions
  set status = 'published',
      published_at = coalesce(published_at, uploaded_at)
  where published_at is null and version_number is not null;

-- Rozpracované verze mají version_number prázdné a Postgres bere každou
-- prázdnou hodnotu jako jinou, takže si navzájem nepřekážejí. Unikátnost
-- čísel u zveřejněných verzí (module_id, country_id, version_number)
-- zůstává z první migrace v platnosti.

create index if not exists document_versions_draft_idx
  on document_versions (uploaded_by, status);


-- ====================================================================
-- 0004_country_status.sql
-- ====================================================================
-- Informování ostatních zemí o změnách + semafor rozpracovanosti.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- ---------------------------------------------------------------------
-- 1. Tabulka: kdo má na kterou značku ještě zareagovat
-- ---------------------------------------------------------------------
-- Jeden řádek = jedna vyznačená změna + jedna země, které se to týká.
-- country_id je PŘÍJEMCE, ne autor změny. Řádky vznikají až při zveřejnění
-- verze, u rozpracované ne.

create table if not exists annotation_country_status (
  id uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references annotations (id) on delete cascade,
  country_id uuid not null references countries (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'dismissed')),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  dismissed_by uuid references users (id) on delete set null,
  unique (annotation_id, country_id)
);

create index if not exists annotation_country_status_country_idx
  on annotation_country_status (country_id, status);

alter table annotation_country_status enable row level security;

-- ---------------------------------------------------------------------
-- 2. Pomocné funkce
-- ---------------------------------------------------------------------
-- Obě jsou "security definer", takže samy o sobě nepodléhají RLS pravidlům.
-- Kdyby pravidlo pro značky sahalo na verze a pravidlo pro verze zpátky na
-- značky, Postgres by skončil chybou o nekonečném zanoření.

create or replace function public.annotation_shared_with_me(a_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.annotation_country_status s
    where s.annotation_id = a_id
      and s.country_id = public.current_country_id()
  );
$$;

create or replace function public.version_shared_with_me(v_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.annotation_country_status s
    join public.annotations a on a.id = s.annotation_id
    where a.document_version_id = v_id
      and s.country_id = public.current_country_id()
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------
-- Editor i čtenář vidí a řeší jen řádky své země, admin vidí všechno.

create policy "stav zmeny vidi jen jeji zeme nebo admin" on annotation_country_status
  for select to authenticated
  using (country_id = public.current_country_id() or public.is_admin());

-- "Netýká se nás" je úprava existujícího řádku, proto jen update.
create policy "stav zmeny meni jen jeji zeme nebo admin" on annotation_country_status
  for update to authenticated
  using (country_id = public.current_country_id() or public.is_admin())
  with check (country_id = public.current_country_id() or public.is_admin());

-- Řádky zakládá ten, kdo zveřejňuje verzi.
create policy "stav zmeny zaklada admin nebo editor" on annotation_country_status
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'editor')
    )
  );

-- Aby země viděla cizí značku, kterou má vyřešit, musí se dostat i k samotné
-- značce a k verzi dokumentu, ve které leží. Pravidla se sčítají (stačí,
-- aby platilo jedno), takže tohle nijak nerozšiřuje přístup k ostatnímu.

create policy "znacku vidi i zeme, ktera ji ma vyresit" on annotations
  for select to authenticated
  using (public.annotation_shared_with_me(id));

create policy "verzi vidi i zeme, ktera resi jeji znacky" on document_versions
  for select to authenticated
  using (public.version_shared_with_me(id));

-- ---------------------------------------------------------------------
-- 4. Semafor
-- ---------------------------------------------------------------------
-- Barva se nikam neukládá, počítá se vždy z nejstaršího nevyřešeného řádku.
-- Modul, který v seznamu není, je v pořádku (zelená).
-- security_invoker = pohled se dívá očima přihlášeného uživatele, takže
-- platí stejná RLS pravidla jako na tabulkách pod ním.

create or replace view module_country_light
with (security_invoker = true) as
select
  dv.module_id,
  s.country_id,
  count(*) as pending_count,
  min(s.created_at) as oldest_pending_at,
  case
    when min(s.created_at) > now() - interval '14 days' then 'yellow'
    else 'red'
  end as light
from annotation_country_status s
join annotations a on a.id = s.annotation_id
join document_versions dv on dv.id = a.document_version_id
where s.status = 'pending'
group by dv.module_id, s.country_id;

-- Supabase běžně práva novým tabulkám přiděluje samo, tohle je jen pojistka.
grant select, insert, update on annotation_country_status to authenticated;
grant select on module_country_light to authenticated;


-- ====================================================================
-- 0005_version_write_rules.sql
-- ====================================================================
-- Oprávnění k zápisu do verzí dokumentů a značek.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run
--
-- První migrace dala tabulce document_versions jen pravidla pro čtení a
-- vkládání. Na úpravu a mazání žádné pravidlo nebylo, a co RLS výslovně
-- nepovolí, to zakazuje – takže zveřejnění verze (draft -> published),
-- přepsání rozpracované verze i zahození rozdělané práce tiše měnily
-- nula řádků. Appka to hlásila jako "Cannot coerce the result to a single
-- JSON object", protože po úpravě čekala právě jeden vrácený řádek.
--
-- Zároveň se tady dorovnává, že editor má práva jen ve své zemi. Dosud
-- stačilo mít roli editor a šlo zapisovat i pod cizí zemi.

-- ---------------------------------------------------------------------
-- Pomocná funkce: smí přihlášený uživatel zapisovat do téhle verze?
-- ---------------------------------------------------------------------
-- "security definer" = funkce se sama neřídí RLS pravidly. Kdyby se jimi
-- řídila, pravidlo pro značky by sahalo na verze a pravidlo pro verze
-- zpátky na značky a Postgres by to odmítl jako nekonečné zanoření.

create or replace function public.can_write_version(v_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.document_versions dv
    join public.users u on u.id = auth.uid()
    where dv.id = v_id
      and u.role in ('admin', 'editor')
      and (u.role = 'admin' or dv.country_id = u.country_id)
  );
$$;

-- Totéž pro řádek, který teprve vzniká (u insertu ještě verze neexistuje).
create or replace function public.can_write_for_country(c_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'editor')
      and (u.role = 'admin' or u.country_id = c_id)
  );
$$;

-- ---------------------------------------------------------------------
-- Verze dokumentů
-- ---------------------------------------------------------------------

drop policy if exists "verze naharava admin nebo editor" on document_versions;

create policy "verzi zaklada admin nebo editor sve zeme" on document_versions
  for insert to authenticated
  with check (public.can_write_for_country(country_id));

-- Kvůli zveřejnění (draft -> published) a přepsání rozpracované verze.
create policy "verzi upravuje admin nebo editor sve zeme" on document_versions
  for update to authenticated
  using (public.can_write_for_country(country_id))
  with check (public.can_write_for_country(country_id));

-- Mazat jde jen rozpracovaná verze, a to vlastní (nebo jako admin).
-- Zveřejněná verze je součást historie a nemaže ji nikdo.
create policy "rozpracovanou verzi maze jeji autor nebo admin" on document_versions
  for delete to authenticated
  using (
    status = 'draft'
    and (uploaded_by = auth.uid() or public.is_admin())
  );

-- ---------------------------------------------------------------------
-- Značky
-- ---------------------------------------------------------------------
-- Dosud stačila role, nehledělo se na zemi. Nově musí značka patřit
-- k verzi, do které uživatel smí zapisovat.

drop policy if exists "znacky zapisuje admin nebo editor" on annotations;
drop policy if exists "znacky upravuje admin nebo editor" on annotations;
drop policy if exists "znacky maze admin nebo editor" on annotations;

create policy "znacky zapisuje kdo smi do verze" on annotations
  for insert to authenticated
  with check (public.can_write_version(document_version_id));

create policy "znacky upravuje kdo smi do verze" on annotations
  for update to authenticated
  using (public.can_write_version(document_version_id))
  with check (public.can_write_version(document_version_id));

create policy "znacky maze kdo smi do verze" on annotations
  for delete to authenticated
  using (public.can_write_version(document_version_id));


-- ====================================================================
-- 0006_close_write_gaps.sql
-- ====================================================================
-- Dvě díry v oprávněních, které našla kontrola zápisů proti pravidlům.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- ---------------------------------------------------------------------
-- 1. Uživatel si mohl sám přepsat roli na admin
-- ---------------------------------------------------------------------
-- První migrace měla pravidlo nazvané "bez zmeny role", jenže RLS umí
-- hlídat jen celé řádky, ne jednotlivé sloupce, a chyběla mu i podmínka
-- na výsledný řádek. Kdokoli přihlášený tak mohl svému řádku v tabulce
-- users nastavit role = 'admin' – stačil k tomu veřejný anon klíč, který
-- appka posílá do prohlížeče, a vlastní přihlášení.
--
-- Appka nikde nepotřebuje, aby si uživatel upravoval vlastní řádek;
-- zemi i roli nastavuje admin v Administraci. Pravidlo proto ruším celé.

drop policy if exists "uzivatel si upravi jen sebe (bez zmeny role)" on users;

-- ---------------------------------------------------------------------
-- 2. Editor mohl přidat shrnutí k verzi cizí země
-- ---------------------------------------------------------------------
-- U shrnutí verze se dosud hlídala jen role, ne země. Editor tak mohl
-- připsat text k verzi, která patří jiné zemi. Nově platí stejná
-- podmínka jako u značek.

drop policy if exists "zmeny zapisuje admin nebo editor" on changes;

create policy "zmeny zapisuje kdo smi do verze" on changes
  for insert to authenticated
  with check (public.can_write_version(document_version_id));

-- ---------------------------------------------------------------------
-- 3. Drobnost: notifikace si šlo přepsat na cizího vlastníka
-- ---------------------------------------------------------------------
-- Pravidlo na označení přečteno kontrolovalo jen původní řádek, ne ten
-- výsledný, takže šlo vlastní notifikaci přepsat na jiného uživatele.

drop policy if exists "notifikace oznaci precteno jen vlastnik" on notifications;

create policy "notifikace oznaci precteno jen vlastnik" on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ====================================================================
-- 0007_catalog.sql
-- ====================================================================
-- Katalog metodik se natahuje z kurikulum.aidetem.cz, ne klikáním ručně.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

alter table modules
  -- část adresy /knowledgebase/<slug>/ – podle ní se metodika poznává
  -- při dalším importu, i když se přejmenuje
  add column if not exists slug text,
  add column if not exists source_url text,
  add column if not exists name_en text,
  -- pořadí, v jakém metodika stojí na webu ve své sekci
  add column if not exists order_index integer not null default 0,
  -- metodika, která z webu zmizela. Nikdy se nemaže, jen se schová.
  add column if not exists archived_at timestamptz;

-- Sekce z webu se ukládá do sloupce category, který už existuje
-- a na přehledu se zobrazuje jako pilulka.

create unique index if not exists modules_slug_key
  on modules (slug) where slug is not null;

create index if not exists modules_archived_idx
  on modules (archived_at);


-- ====================================================================
-- 0008_user_countries.sql
-- ====================================================================
-- Uživatel může spravovat víc zemí (např. Česko i anglickou verzi).
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- ---------------------------------------------------------------------
-- 1. Vazební tabulka a převod dosavadních přiřazení
-- ---------------------------------------------------------------------

create table if not exists user_countries (
  user_id uuid not null references users (id) on delete cascade,
  country_id uuid not null references countries (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, country_id)
);

insert into user_countries (user_id, country_id)
  select id, country_id from users where country_id is not null
  on conflict do nothing;

-- users.country_id zůstává, ale appka ho už nečte. Nechává se kvůli
-- starším záznamům a pro případ, že by se převod musel opakovat.

alter table user_countries enable row level security;

create policy "sve zeme vidi kazdy, cizi jen admin" on user_countries
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "prirazeni zemi meni jen admin" on user_countries
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. Pomocné funkce: místo "jeho země" nově "jedna z jeho zemí"
-- ---------------------------------------------------------------------

create or replace function public.is_my_country(c_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.user_countries
    where user_id = auth.uid() and country_id = c_id
  );
$$;

-- current_country_id() vracelo jedinou zemi a dál by lhalo. Pravidla pod
-- ním se přepisují níž, funkce sama se ruší, ať ji nikdo nepoužije omylem.

create or replace function public.can_write_for_country(c_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'editor')
      and (u.role = 'admin' or public.is_my_country(c_id))
  );
$$;

create or replace function public.can_write_version(v_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.document_versions dv
    join public.users u on u.id = auth.uid()
    where dv.id = v_id
      and u.role in ('admin', 'editor')
      and (u.role = 'admin' or public.is_my_country(dv.country_id))
  );
$$;

create or replace function public.annotation_shared_with_me(a_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.annotation_country_status s
    where s.annotation_id = a_id and public.is_my_country(s.country_id)
  );
$$;

create or replace function public.version_shared_with_me(v_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.annotation_country_status s
    join public.annotations a on a.id = s.annotation_id
    where a.document_version_id = v_id and public.is_my_country(s.country_id)
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Pravidla, která se ptala na jedinou zemi
-- ---------------------------------------------------------------------

drop policy if exists "verze vidi jen sva zeme nebo admin" on document_versions;
create policy "verze vidi jen sve zeme nebo admin" on document_versions
  for select to authenticated
  using (public.is_my_country(country_id) or public.is_admin());

drop policy if exists "zmeny vidi kdo vidi verzi" on changes;
create policy "zmeny vidi kdo vidi verzi" on changes
  for select to authenticated
  using (
    exists (
      select 1 from document_versions dv
      where dv.id = changes.document_version_id
        and (public.is_my_country(dv.country_id) or public.is_admin())
    )
  );

drop policy if exists "znacky vidi kdo vidi verzi" on annotations;
create policy "znacky vidi kdo vidi verzi" on annotations
  for select to authenticated
  using (
    exists (
      select 1 from document_versions dv
      where dv.id = annotations.document_version_id
        and (public.is_my_country(dv.country_id) or public.is_admin())
    )
  );

drop policy if exists "stav zmeny vidi jen jeji zeme nebo admin" on annotation_country_status;
create policy "stav zmeny vidi jen jeji zeme nebo admin" on annotation_country_status
  for select to authenticated
  using (public.is_my_country(country_id) or public.is_admin());

drop policy if exists "stav zmeny meni jen jeji zeme nebo admin" on annotation_country_status;
create policy "stav zmeny meni jen jeji zeme nebo admin" on annotation_country_status
  for update to authenticated
  using (public.is_my_country(country_id) or public.is_admin())
  with check (public.is_my_country(country_id) or public.is_admin());

-- Funkci se pokusíme zrušit, ale nevadí, když to hned nevyjde: v produkci
-- na ní visela stará pravidla u úložiště souborů. Uklízí je migrace 0010.
do $$
begin
  drop function if exists public.current_country_id();
exception
  when dependent_objects_still_exist then
    raise notice 'current_country_id() zatím zůstává, visí na ní jiné objekty. Uklidí to migrace 0010.';
end $$;


-- ====================================================================
-- 0009_translations_and_admin_edits.sql
-- ====================================================================
-- Překlad poznámek do jazyků ostatních zemí + tichý záznam adminových oprav.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- ---------------------------------------------------------------------
-- 1. Překlady
-- ---------------------------------------------------------------------
-- Originál zůstává v note a nikdy se nepřepisuje. Překlady leží vedle něj
-- jako {"cs": "...", "sk": "...", ...}. Metodiky samotné se nepřekládají,
-- jen poznámky ke změnám a celkové shrnutí.

alter table annotations
  add column if not exists source_locale text,
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_failed boolean not null default false;

alter table changes
  add column if not exists source_locale text,
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_failed boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. Tichý záznam adminových oprav
-- ---------------------------------------------------------------------
-- Admin smí opravit i cizí nahrávku. Nevzniká nová verze, nic se
-- nerozesílá a v appce to není vidět – ale musí se to dát dohledat.

create table if not exists admin_edits (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- 'annotation' | 'change' | 'version'
  entity text not null,
  entity_id uuid,
  document_version_id uuid references document_versions (id) on delete set null,
  -- 'insert' | 'update' | 'delete'
  action text not null,
  before jsonb,
  after jsonb
);

create index if not exists admin_edits_version_idx
  on admin_edits (document_version_id, created_at desc);

alter table admin_edits enable row level security;

create policy "zaznam oprav vidi jen admin" on admin_edits
  for select to authenticated using (public.is_admin());

create policy "zaznam oprav zapisuje jen admin" on admin_edits
  for insert to authenticated with check (public.is_admin());

grant select, insert on admin_edits to authenticated;

-- ---------------------------------------------------------------------
-- 3. Admin smí uklidit i cizí zveřejněnou verzi
-- ---------------------------------------------------------------------
-- Pravidlo z migrace 0005 pouštělo mazání jen u rozpracovaných verzí.
-- Pravidla se sčítají, tohle je přidává adminovi na všechny.

create policy "verzi maze i admin" on document_versions
  for delete to authenticated
  using (public.is_admin());


-- ====================================================================
-- 0010_cleanup_storage_and_ui_locale.sql
-- ====================================================================
-- Dokončení migrace 0008 + jazyk rozhraní podle uživatele.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- ---------------------------------------------------------------------
-- 1. Stará pravidla na úložišti souborů
-- ---------------------------------------------------------------------
-- Migrace 0008 chtěla zrušit funkci current_country_id(), ale v produkci
-- na ní visela dvě pravidla z doby, kdy se PDF nahrávala do Supabase
-- Storage (bucket "documents"). Dneska appka drží jen odkazy na Google
-- Drive, do úložiště nic nezapisuje ani z něj nečte.
--
-- Ta pravidla proto ruším. Nechat je nejde: current_country_id() vracelo
-- jedinou zemi, takže by od migrace 0008 rozhodovala špatně – uživateli
-- se dvěma zeměmi by pustila jen jednu, a to náhodně vybranou.
-- Soubory v bucketu zůstávají, jen k nim běžný uživatel nemá přístup
-- (bez pravidla RLS zakazuje vše). Kdyby se úložiště někdy vrátilo,
-- napíšou se pravidla nová, nad is_my_country().

do $$
begin
  drop policy if exists "cteni pdf jen pro svou zemi nebo admina" on storage.objects;
  drop policy if exists "nahravani pdf jen admin nebo editor" on storage.objects;
exception
  when insufficient_privilege then
    raise notice 'Na pravidla u storage.objects chybí oprávnění. Smaž je prosím ručně: Storage -> Policies -> bucket documents.';
  when undefined_table then
    raise notice 'storage.objects tady není, přeskakuji.';
end $$;

-- Teprve teď jde zrušit funkci, kterou nahradila is_my_country().
do $$
begin
  drop function if exists public.current_country_id();
exception
  when dependent_objects_still_exist then
    raise notice 'Na current_country_id() ještě něco visí, funkce zůstává. Zkontroluj pravidla, která ji používají.';
end $$;

-- ---------------------------------------------------------------------
-- 2. Jazyk rozhraní podle uživatele
-- ---------------------------------------------------------------------
-- Rozhraní se dosud řídilo prohlíženou zemí, takže se adminovi přepnulo
-- do slovenštiny jen proto, že se díval na Slovensko. Nově má jazyk
-- vlastní. Prázdná hodnota znamená "podle první přiřazené země".

alter table users
  add column if not exists locale text;

-- ====================================================================
-- 0011_mark_quote.sql
-- ====================================================================
-- Text pod vyznačenou značkou a jeho překlad pro ostatní země.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Značka je obdélník přes PDF. Text, který pod ní leží, si appka přečte
-- při kreslení značky a při zveřejnění ho nechá přeložit stejně jako
-- poznámku. U naskenovaných PDF a obrázků zůstává prázdný.
alter table annotations
  add column if not exists quote text,
  add column if not exists quote_translations jsonb not null default '{}'::jsonb;
-- ====================================================================
-- 0012_presentations.sql
-- ====================================================================
-- Prezentace k lekcím vedle metodik.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- ---------------------------------------------------------------------
-- 1. Co je verze zač: metodika, nebo prezentace
-- ---------------------------------------------------------------------
-- Prezentace patří ke stejné lekci (modulu) jako metodika, ale verzuje se
-- zvlášť: v3 metodiky a v1 prezentace téže lekce vedle sebe klidně žijí.
-- Dosavadní verze jsou všechno metodiky.
alter table document_versions
  add column if not exists kind text not null default 'teaching_material';

alter table document_versions drop constraint if exists document_versions_kind_check;
alter table document_versions
  add constraint document_versions_kind_check check (kind in ('teaching_material', 'presentation'));

-- Čísla verzí jsou unikátní zvlášť pro metodiku a zvlášť pro prezentaci.
alter table document_versions
  drop constraint if exists document_versions_module_id_country_id_version_number_key;
create unique index if not exists document_versions_number_per_kind
  on document_versions (module_id, country_id, kind, version_number);

-- ---------------------------------------------------------------------
-- 2. Semafor zvlášť pro metodiku a pro prezentaci
-- ---------------------------------------------------------------------
-- Pohled přibírá sloupec kind, proto se musí zahodit a založit znovu.
drop view if exists module_country_light;
create view module_country_light
with (security_invoker = true) as
select
  dv.module_id,
  dv.kind,
  s.country_id,
  count(*) as pending_count,
  min(s.created_at) as oldest_pending_at,
  case
    when min(s.created_at) > now() - interval '14 days' then 'yellow'
    else 'red'
  end as light
from annotation_country_status s
join annotations a on a.id = s.annotation_id
join document_versions dv on dv.id = a.document_version_id
where s.status = 'pending'
group by dv.module_id, dv.kind, s.country_id;

grant select on module_country_light to authenticated;
-- ====================================================================
-- 0013_support_messages.sql
-- ====================================================================
-- Zprávy adminům přímo z appky („Napsat adminovi“).
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Každý uživatel má s adminy jedno vlákno. user_id je, čí vlákno to je;
-- author_id, kdo zprávu napsal (on sám, nebo některý z adminů).
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  author_id uuid references users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  -- Kdy zprávu uživatele viděl admin / kdy odpověď admina viděl uživatel.
  -- Zapisuje je server (service role), proto pro ně není pravidlo update.
  read_by_admin_at timestamptz,
  read_by_user_at timestamptz
);

create index if not exists support_messages_thread_idx
  on support_messages (user_id, created_at);

alter table support_messages enable row level security;

drop policy if exists "vlakno vidi jeho majitel nebo admin" on support_messages;
create policy "vlakno vidi jeho majitel nebo admin" on support_messages
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Do svého vlákna píše uživatel sám za sebe, admin do kteréhokoli.
drop policy if exists "do vlakna pise majitel nebo admin" on support_messages;
create policy "do vlakna pise majitel nebo admin" on support_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (user_id = auth.uid() or public.is_admin())
  );

grant select, insert on support_messages to authenticated;
-- ====================================================================
-- 0014_module_name_translations.sql
-- ====================================================================
-- Názvy metodik ve slovenštině a maďarštině (angličtina má vlastní name_en).
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Všechny země vidí celý katalog. Aby mu rozuměly, má každá metodika
-- název i v jejich jazyce: {"sk": "...", "hu": "..."}. Import z českého
-- webu tenhle sloupec nepřepisuje.
alter table modules
  add column if not exists name_translations jsonb not null default '{}'::jsonb;
-- ====================================================================
-- 0015_followed_modules.sql
-- ====================================================================
-- Které metodiky země sleduje. Změny, semafor i upozornění pak chodí jen
-- k nim – Maďarsko s deseti metodikami nemá dostávat změny ve čtyřiceti
-- dalších.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

create table if not exists country_modules (
  country_id uuid not null references countries (id) on delete cascade,
  module_id uuid not null references modules (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (country_id, module_id)
);

-- Kdy si země výběr naposledy uložila. Null = ještě nevybírala: pak sleduje
-- všechno (jako dřív) a appka ji vyzve, ať si vybere.
alter table countries
  add column if not exists modules_chosen_at timestamptz;

alter table country_modules enable row level security;

-- Číst smí každý přihlášený (výběr ovlivňuje, komu se změna pošle).
-- Zapisuje jen server po kontrole práv (service role), proto tu pravidla
-- pro zápis nejsou.
drop policy if exists "sledovane metodiky vidi prihlaseni" on country_modules;
create policy "sledovane metodiky vidi prihlaseni" on country_modules
  for select to authenticated using (true);

grant select on country_modules to authenticated;
-- ====================================================================
-- 0016_country_module_names.sql
-- ====================================================================
-- Vlastní název metodiky pro jednu zemi.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Metodika se v každé zemi může jmenovat jinak (u nás „Poezie mezi
-- prompty“, v Maďarsku úplně jinak). Přejmenování platí jen pro danou
-- zemi, ostatní dál vidí svůj název.
create table if not exists country_module_names (
  country_id uuid not null references countries (id) on delete cascade,
  module_id uuid not null references modules (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 300),
  updated_at timestamptz not null default now(),
  primary key (country_id, module_id)
);

alter table country_module_names enable row level security;

-- Číst smí každý přihlášený; zapisuje server po kontrole práv (service role).
drop policy if exists "vlastni nazvy vidi prihlaseni" on country_module_names;
create policy "vlastni nazvy vidi prihlaseni" on country_module_names
  for select to authenticated using (true);

grant select on country_module_names to authenticated;

-- ====================================================================
-- Doplnit řádky pro účty, které se přihlásily dřív, než tabulka users
-- existovala (trigger z 0001 zachytí jen nové registrace).
-- ====================================================================
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;
