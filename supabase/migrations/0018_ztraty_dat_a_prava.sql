-- Opravy z revize: ztráty dat při nahrávání a zveřejnění, práva k zápisu.
-- Spustit v Supabase: SQL Editor -> New query -> vlož celý soubor -> Run
-- Dá se spustit i opakovaně, nic se tím nerozbije.
--
-- (Číslo 0018, protože 0017 už je obsazená migrací 0017_change_resolution.sql.)

-- ---------------------------------------------------------------------
-- A1. Ukládání rozpracované verze (konceptu) jen do konceptu
-- ---------------------------------------------------------------------
-- Průběžné ukládání rámečků smazalo staré a vložilo nové – a nekontrolovalo,
-- jestli je verze pořád koncept. Když doběhlo až po zveřejnění, smazalo
-- rámečky zveřejněné verze a s nimi i změny čekající u ostatních zemí.
--
-- Nově jde všechno najednou v jedné transakci a se zámkem na řádku verze.
-- Zveřejnění (publish_version níž) bere stejný zámek, takže se ukládání
-- a zveřejnění nikdy nepotkají v půlce.

create or replace function public.save_draft_marks(p_draft_id uuid, p_marks jsonb)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_draft document_versions%rowtype;
begin
  select role into v_role from users where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'editor') then
    raise exception 'draft_forbidden' using errcode = '42501';
  end if;

  select * into v_draft from document_versions where id = p_draft_id for update;
  if not found or v_draft.status <> 'draft' then
    raise exception 'draft_not_editable';
  end if;
  -- Editor jen do vlastního konceptu ve své zemi, admin do jakéhokoli.
  if v_role <> 'admin'
     and not (v_draft.uploaded_by = auth.uid() and public.is_my_country(v_draft.country_id)) then
    raise exception 'draft_forbidden' using errcode = '42501';
  end if;

  delete from annotations where document_version_id = v_draft.id;

  -- Rámečky bez poznámky se neukládají, stejně jako dřív.
  insert into annotations (document_version_id, page, x, y, w, h, note, category, quote)
  select
    v_draft.id,
    (m ->> 'page')::int,
    (m ->> 'x')::real,
    (m ->> 'y')::real,
    (m ->> 'w')::real,
    (m ->> 'h')::real,
    m ->> 'note',
    nullif(m ->> 'category', ''),
    m ->> 'quote'
  from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) as m
  where btrim(coalesce(m ->> 'note', '')) <> '';

  return now();
end;
$$;

revoke all on function public.save_draft_marks(uuid, jsonb) from public;
grant execute on function public.save_draft_marks(uuid, jsonb) to authenticated;
