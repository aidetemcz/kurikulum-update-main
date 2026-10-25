-- Prezentace k lekcím vedle metodik.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- ---------------------------------------------------------------------
-- 1. Co je verze zač: metodika, nebo prezentace
-- ---------------------------------------------------------------------
-- Prezentace patří ke stejné lekci (modulu) jako metodika, ale verzuje se
-- zvlášť: v3 metodiky a v1 prezentace téže lekce vedle sebe klidně žijí.
-- Dosavadní verze jsou všechno metodiky.
alter table document_versions
  add column if not exists kind text not null default 'methodology';

alter table document_versions drop constraint if exists document_versions_kind_check;
alter table document_versions
  add constraint document_versions_kind_check check (kind in ('methodology', 'presentation'));

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
