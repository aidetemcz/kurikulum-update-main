-- Opravy z revize: ztráty dat při nahrávání a zveřejnění, práva k zápisu.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run
-- Dá se spustit i opakovaně, nic se tím nerozbije.
--
-- (Číslo 0018, protože 0017 už je obsazená migrací 0017_change_resolution.sql.)

-- ---------------------------------------------------------------------
-- A1. Ukládání rozpracované verze (konceptu) jen do konceptu
-- ---------------------------------------------------------------------
-- Průběžné ukládání rámečků smazalo staré a vložilo nové – a nekontrolovalo,
-- jestli je verze pořád koncept. Když doběhlo až po zveřejnění, smazalo
-- rámečky zveřejněné verze a s nimi i změny čekající u ostatních zemí.
--
-- Nově jde všechno najednou v jedné transakci a se zámkem na řádku verze.
-- Zveřejnění (publish_version níž) bere stejný zámek, takže se ukládání
-- a zveřejnění nikdy nepotkají v půlce.

create or replace function public.save_draft_marks(p_draft_id uuid, p_marks jsonb)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_draft document_versions%rowtype;
begin
  select role into v_role from users where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'editor') then
    raise exception 'draft_forbidden' using errcode = '42501';
  end if;

  select * into v_draft from document_versions where id = p_draft_id for update;
  if not found or v_draft.status <> 'draft' then
    raise exception 'draft_not_editable';
  end if;
  -- Editor jen do vlastního konceptu ve své zemi, admin do jakéhokoli.
  if v_role <> 'admin'
     and not (v_draft.uploaded_by = auth.uid() and public.is_my_country(v_draft.country_id)) then
    raise exception 'draft_forbidden' using errcode = '42501';
  end if;

  delete from annotations where document_version_id = v_draft.id;

  -- Rámečky bez poznámky se neukládají, stejně jako dřív.
  insert into annotations (document_version_id, page, x, y, w, h, note, category, quote)
  select
    v_draft.id,
    (m ->> 'page')::int,
    (m ->> 'x')::real,
    (m ->> 'y')::real,
    (m ->> 'w')::real,
    (m ->> 'h')::real,
    m ->> 'note',
    nullif(m ->> 'category', ''),
    m ->> 'quote'
  from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) as m
  where btrim(coalesce(m ->> 'note', '')) <> '';

  return now();
end;
$$;

revoke all on function public.save_draft_marks(uuid, jsonb) from public;
grant execute on function public.save_draft_marks(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- A3. Zveřejnění celé, nebo vůbec
-- ---------------------------------------------------------------------
-- Dřív se verze přepnula na zveřejněnou dřív, než vznikl řádek se shrnutím
-- a řádky pro ostatní země. Když pak něco selhalo, verze visela zveřejněná,
-- nikomu nepřišla a zopakovat to nešlo.
--
-- Teď to dělá jedna funkce v jedné transakci: přidělí číslo verze, přepne
-- ji na zveřejněnou, nastaví čas nahrání a zveřejnění, založí shrnutí
-- a pošle každý rámeček všem zemím, které lekci sledují (země, která si
-- výběr ještě neuložila, sleduje všechno). Buď proběhne všechno, nebo nic.
--
-- Práva hlídá funkce sama: admin smí zveřejnit jakýkoli koncept, editor
-- jen vlastní koncept ve své zemi.

create or replace function public.publish_version(p_draft_id uuid, p_summary text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_draft document_versions%rowtype;
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_prev_number integer;
  v_prev_uploaded_at timestamptz;
  v_prev_uploaded_by uuid;
  v_number integer;
  v_now timestamptz := now();
  v_note text;
  v_change_id uuid;
  v_recipients uuid[];
begin
  select role into v_role from users where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'editor') then
    raise exception 'publish_forbidden' using errcode = '42501';
  end if;

  -- Zámek na řádku verze: souběžné ukládání rámečků (save_draft_marks)
  -- i druhé kliknutí na Zveřejnit počkají, až tohle doběhne.
  select * into v_draft from document_versions where id = p_draft_id for update;
  if not found or v_draft.status <> 'draft' then
    raise exception 'publish_not_draft';
  end if;
  if v_role <> 'admin'
     and not (v_draft.uploaded_by = auth.uid() and public.is_my_country(v_draft.country_id)) then
    raise exception 'publish_forbidden' using errcode = '42501';
  end if;

  -- Rámečky bez poznámky se nezveřejňují (appka je ani neukládá).
  delete from annotations where document_version_id = v_draft.id and btrim(note) = '';

  -- Ostatní země dostávají jednotlivé rámečky; verze jen se shrnutím by
  -- se jim nikde neukázala. Proto je potřeba aspoň jeden (viz A5 níž).
  if not exists (select 1 from annotations where document_version_id = v_draft.id) then
    raise exception 'publish_needs_mark';
  end if;

  -- Čísla verzí se přidělují po jednom pro každou lekci, zemi a druh
  -- dokumentu – zámek zajistí, že dvě zveřejnění nedostanou stejné číslo.
  perform pg_advisory_xact_lock(
    hashtextextended(v_draft.module_id::text || ':' || v_draft.country_id::text || ':' || v_draft.kind, 0)
  );

  select version_number, uploaded_at, uploaded_by
    into v_prev_number, v_prev_uploaded_at, v_prev_uploaded_by
  from document_versions
  where module_id = v_draft.module_id
    and country_id = v_draft.country_id
    and kind = v_draft.kind
    and status = 'published'
  order by version_number desc
  limit 1;

  v_number := coalesce(v_prev_number, 0) + 1;

  update document_versions
  set status = 'published',
      version_number = v_number,
      uploaded_at = v_now,
      published_at = v_now
  where id = v_draft.id;

  -- Shrnutí verze: to, co editor napsal, jinak očíslované poznámky
  -- v pořadí čtení (stránka, shora dolů, zleva doprava).
  if v_summary is not null then
    v_note := v_summary;
  else
    select string_agg(poradi || '. ' || note, E'\n' order by poradi)
      into v_note
    from (
      select note, row_number() over (order by page, y, x) as poradi
      from annotations
      where document_version_id = v_draft.id
    ) as serazene;
  end if;

  insert into changes (document_version_id, note, category)
  values (v_draft.id, v_note, null)
  returning id into v_change_id;

  -- Komu změna jde: všem ostatním zemím, které lekci sledují.
  select coalesce(array_agg(c.id), '{}')
    into v_recipients
  from countries c
  where c.id <> v_draft.country_id
    and (
      c.modules_chosen_at is null
      or exists (
        select 1 from country_modules cm
        where cm.country_id = c.id and cm.module_id = v_draft.module_id
      )
    );

  insert into annotation_country_status (annotation_id, country_id)
  select a.id, r.country_id
  from annotations a
  cross join unnest(v_recipients) as r (country_id)
  where a.document_version_id = v_draft.id
  on conflict (annotation_id, country_id) do nothing;

  return jsonb_build_object(
    'version_number', v_number,
    'published_at', v_now,
    'change_id', v_change_id,
    'recipient_country_ids', to_jsonb(v_recipients),
    'previous_version', v_prev_number,
    'previous_uploaded_at', v_prev_uploaded_at,
    'previous_uploaded_by', v_prev_uploaded_by
  );
end;
$$;

revoke all on function public.publish_version(uuid, text) from public;
grant execute on function public.publish_version(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- A5. Shrnutí verze vidí i země, kterým změna přišla
-- ---------------------------------------------------------------------
-- Číst shrnutí směla jen země, která nahrávala, a admin. Příjemci proto
-- měli ve zvonečku prázdnou poznámku a „Neznámý modul“.

drop policy if exists "zmeny vidi i zeme, se kterou je verze sdilena" on changes;
create policy "zmeny vidi i zeme, se kterou je verze sdilena" on changes
  for select to authenticated
  using (public.version_shared_with_me(document_version_id));

-- Úprava shrnutí neměla žádné pravidlo, takže adminova oprava shrnutí
-- tiše nic nezměnila (a do admin_edits se přesto zapsala). Překlady
-- shrnutí zapisuje server přes service role.
drop policy if exists "zmeny upravuje admin" on changes;
create policy "zmeny upravuje admin" on changes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant update on changes to authenticated;

-- ---------------------------------------------------------------------
-- A7. Notifikace s časem vzniku
-- ---------------------------------------------------------------------
-- Zvoneček řadil podle id, což je náhodné UUID – ukazoval tak náhodných
-- dvacet notifikací. Stávající notifikace dostanou čas spuštění migrace.

alter table notifications
  add column if not exists created_at timestamptz not null default now();

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- A9. Uložení sledovaných lekcí najednou
-- ---------------------------------------------------------------------
-- Appka výběr nejdřív celý smazala a pak vložila nový. Když vložení
-- selhalo, země nesledovala nic. Teď je to jedna transakce: buď se uloží
-- celý nový výběr, nebo zůstane starý.
--
-- Smí admin a editor dané země (admin i v náhledu jako jiná země).

create or replace function public.save_followed_modules(p_country_id uuid, p_module_ids uuid[])
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_module_ids, '{}');
begin
  if not public.can_write_for_country(p_country_id) then
    raise exception 'follow_forbidden' using errcode = '42501';
  end if;

  delete from country_modules
  where country_id = p_country_id
    and module_id <> all (v_ids);

  insert into country_modules (country_id, module_id)
  select p_country_id, m from unnest(v_ids) as m
  on conflict (country_id, module_id) do nothing;

  update countries set modules_chosen_at = now() where id = p_country_id;

  return now();
end;
$$;

revoke all on function public.save_followed_modules(uuid, uuid[]) from public;
grant execute on function public.save_followed_modules(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- B1. Zveřejněnou verzi mění a maže jen admin
-- ---------------------------------------------------------------------
-- Editor mohl přes REST přepsat zveřejněnou verzi své země – i její rámečky,
-- a tím smazat změny čekající u ostatních zemí. Smazat ji šlo oklikou:
-- nejdřív přepsat status na 'draft', pak smazat jako koncept.
--
-- Nově: ne-admin smí měnit a mazat jen koncept (status 'draft'), a to svůj
-- ve své zemi. Ze konceptu na zveřejněnou verzi vede jen funkce
-- publish_version (výš). Admin má práva beze změny.

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
      and (
        u.role = 'admin'
        or (dv.status = 'draft' and public.is_my_country(dv.country_id))
      )
  );
$$;

drop policy if exists "verzi zaklada admin nebo editor sve zeme" on document_versions;
create policy "verzi zaklada admin nebo editor sve zeme" on document_versions
  for insert to authenticated
  with check (
    public.can_write_for_country(country_id)
    and (public.is_admin() or (status = 'draft' and uploaded_by = auth.uid()))
  );

drop policy if exists "verzi upravuje admin nebo editor sve zeme" on document_versions;
create policy "verzi upravuje admin nebo editor sve zeme" on document_versions
  for update to authenticated
  using (
    public.is_admin()
    or (status = 'draft' and uploaded_by = auth.uid() and public.can_write_for_country(country_id))
  )
  with check (
    public.is_admin()
    or (status = 'draft' and uploaded_by = auth.uid() and public.can_write_for_country(country_id))
  );
