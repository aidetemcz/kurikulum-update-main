-- Nové metodiky
--
-- Metodiky označené jako nové stojí na stránce Metodiky nahoře ve
-- zvýrazněném bloku (a v seznamu mají štítek „Nová“). Admin označení
-- zapíná a vypíná v administraci.
--
-- Stávající metodiky nové nejsou. Každá další – ručně přidaná i
-- z importu katalogu – se jako nová označí sama.
--
-- Migraci lze spustit opakovaně.

alter table public.modules add column if not exists is_new boolean not null default false;
alter table public.modules alter column is_new set default true;
