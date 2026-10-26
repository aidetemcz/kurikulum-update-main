-- Zrušení role čtenář (viewer)
--
-- Appka zná už jen dvě role: admin a editor. Editor smí zapisovat jen za
-- země, které má přiřazené – nově registrovaný účet je proto editor bez
-- země a nesmí nic, dokud mu admin zemi nepřiřadí (hlídají to pravidla
-- přes is_my_country / can_write_for_country).
--
-- Hodnota 'viewer' zůstává v typu user_role (z výčtu ji Postgres smazat
-- neumí), ale do sloupce se už zapsat nedá.
--
-- Migraci lze spustit opakovaně.

-- 1. Stávající čtenáři se stávají editory (se svými zeměmi).
update public.users set role = 'editor' where role = 'viewer';

-- 2. Výchozí role nových účtů.
alter table public.users alter column role set default 'editor';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'editor')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Jen admin a editor.
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('admin', 'editor'));
