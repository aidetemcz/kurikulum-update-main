-- Názvy metodik ve slovenštině a maďarštině (angličtina má vlastní name_en).
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Všechny země vidí celý katalog. Aby mu rozuměly, má každá metodika
-- název i v jejich jazyce: {"sk": "...", "hu": "..."}. Import z českého
-- webu tenhle sloupec nepřepisuje.
alter table modules
  add column if not exists name_translations jsonb not null default '{}'::jsonb;
