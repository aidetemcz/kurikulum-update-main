-- Text pod vyznačenou značkou a jeho překlad pro ostatní země.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Značka je obdélník přes PDF. Text, který pod ní leží, si appka přečte
-- při kreslení značky a při zveřejnění ho nechá přeložit stejně jako
-- poznámku. U naskenovaných PDF a obrázků zůstává prázdný.
alter table annotations
  add column if not exists quote text,
  add column if not exists quote_translations jsonb not null default '{}'::jsonb;
