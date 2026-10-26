-- Doposlání změn zemím, kterým nepřišly (třeba protože země přibyla až
-- po zveřejnění verze). Spustit v Supabase: SQL Editor -> New query -> Run.
-- Dá se spustit i opakovaně: co země už má (i skryté změny), se nezdvojí.

-- Každou vyznačenou změnu ze zveřejněné verze dostane každá země kromě té,
-- která verzi nahrála – pokud metodiku sleduje, nebo si zatím nevybírala.
insert into annotation_country_status (annotation_id, country_id)
select a.id, c.id
from annotations a
join document_versions v on v.id = a.document_version_id and v.status = 'published'
cross join countries c
where c.id <> v.country_id
  and (
    c.modules_chosen_at is null
    or exists (
      select 1 from country_modules cm
      where cm.country_id = c.id and cm.module_id = v.module_id
    )
  )
on conflict (annotation_id, country_id) do nothing;

-- Přehled po doplnění: kolik má která země nevyřízených změn.
select
  c.name as zeme,
  c.locale as jazyk,
  c.modules_chosen_at is not null as vybrala_si_metodiky,
  (select count(*) from country_modules cm where cm.country_id = c.id) as sledovanych_metodik,
  (select count(*) from annotation_country_status s
    where s.country_id = c.id and s.status = 'pending') as nevyrizenych_zmen,
  (select count(*) from user_countries uc where uc.country_id = c.id) as lidi
from countries c
order by c.name;
