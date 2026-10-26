-- Označení verzí podle měsíce a roku zveřejnění, např. „10/26“.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run
-- Dá se spustit i opakovaně, nic se tím nerozbije.
--
-- První verze lekce v měsíci se jmenuje „10/26“, další verze téže lekce,
-- země a druhu dokumentu ve stejném měsíci „10/26 – 2“, „10/26 – 3“…
-- Měsíc se počítá v pražském čase. Pořadové číslo (version_number) zůstává
-- – podle něj se verze dál řadí, jen se už neukazuje.

alter table document_versions
  add column if not exists version_label text;

-- Měsíc a rok verze ve tvaru MM/YY.
create or replace function public.version_month(ts timestamptz)
returns text
language sql immutable
as $$
  select to_char(ts at time zone 'Europe/Prague', 'MM/YY');
$$;

-- Dosavadní zveřejněné verze dostanou označení podle data zveřejnění.
with poradi as (
  select
    id,
    public.version_month(coalesce(published_at, uploaded_at)) as mesic,
    row_number() over (
      partition by module_id, country_id, kind,
                   public.version_month(coalesce(published_at, uploaded_at))
      order by version_number
    ) as n
  from document_versions
  where status = 'published'
)
update document_versions d
set version_label = poradi.mesic || case when poradi.n > 1 then ' – ' || poradi.n else '' end
from poradi
where poradi.id = d.id
  and d.version_label is null;

-- Nové verze dostanou označení samy ve chvíli zveřejnění (funkce
-- publish_version přepíná status na 'published').
create or replace function public.set_version_label()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_mesic text;
  v_poradi integer;
begin
  if new.status <> 'published' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and new.version_label is not null then
    return new;
  end if;

  v_mesic := public.version_month(coalesce(new.published_at, new.uploaded_at, now()));

  select count(*) + 1
    into v_poradi
  from document_versions d
  where d.module_id = new.module_id
    and d.country_id = new.country_id
    and d.kind = new.kind
    and d.status = 'published'
    and d.id <> new.id
    and d.version_number < new.version_number
    and public.version_month(coalesce(d.published_at, d.uploaded_at)) = v_mesic;

  new.version_label := v_mesic || case when v_poradi > 1 then ' – ' || v_poradi else '' end;
  return new;
end;
$$;

drop trigger if exists document_versions_set_label on document_versions;
create trigger document_versions_set_label
  before insert or update of status, published_at, version_number on document_versions
  for each row execute function public.set_version_label();
