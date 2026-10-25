-- Zprávy adminům přímo z appky („Napsat adminovi“).
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run

-- Každý uživatel má s adminy jedno vlákno. user_id je, čí vlákno to je;
-- author_id, kdo zprávu napsal (on sám, nebo některý z adminů).
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  author_id uuid references users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  -- Kdy zprávu uživatele viděl admin / kdy odpověď admina viděl uživatel.
  -- Zapisuje je server (service role), proto pro ně není pravidlo update.
  read_by_admin_at timestamptz,
  read_by_user_at timestamptz
);

create index if not exists support_messages_thread_idx
  on support_messages (user_id, created_at);

alter table support_messages enable row level security;

drop policy if exists "vlakno vidi jeho majitel nebo admin" on support_messages;
create policy "vlakno vidi jeho majitel nebo admin" on support_messages
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Do svého vlákna píše uživatel sám za sebe, admin do kteréhokoli.
drop policy if exists "do vlakna pise majitel nebo admin" on support_messages;
create policy "do vlakna pise majitel nebo admin" on support_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (user_id = auth.uid() or public.is_admin())
  );

grant select, insert on support_messages to authenticated;
