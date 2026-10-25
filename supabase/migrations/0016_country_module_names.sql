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
