-- Jak země změnu od jiné země vyřídila.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Vyřízená změna má status 'dismissed' jako dřív. Nově se k ní pamatuje
-- i proč: 'done' = země ji má hotovou, 'not_relevant' = netýká se jí.
-- Starší vyřízené změny zůstanou bez důvodu (appka je ukáže jako „Netýká se nás“).
alter table annotation_country_status
  add column if not exists resolution text
    check (resolution in ('done', 'not_relevant'));
