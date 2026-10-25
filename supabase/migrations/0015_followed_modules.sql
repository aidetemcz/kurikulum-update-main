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
