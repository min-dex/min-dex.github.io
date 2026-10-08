-- Preserve the installed document validator; extend final aggregate validation.
-- Preflight must inspect existing duplicates and installed function ACL/owner.
begin;
set local lock_timeout = '5s';
lock table public.mindex_worship_services, public.mindex_worship_sections,
  public.mindex_worship_elements in share row exclusive mode;

create function mindex_atomic.assert_unique_slots(sid uuid) returns void
language plpgsql set search_path = pg_catalog, pg_temp as $$
declare duplicate_slot text;
begin
  select slot into duplicate_slot from (
    select coalesce(nullif(btrim(e.source_ref->>'slotKey'),''),
      nullif(btrim(e.source_ref->>'slot_key'),''), nullif(btrim(e.config->>'slotKey'),''),
      nullif(btrim(e.config->>'slot_key'),'')) as slot
    from public.mindex_worship_elements e
    join public.mindex_worship_sections s on s.id=e.section_id where s.service_id=sid
  ) slots where slot is not null group by slot having count(*)>1 limit 1;
  if duplicate_slot is not null then
    raise exception 'DUPLICATE_WORSHIP_SLOT' using detail=duplicate_slot;
  end if;
end
$$;
revoke all on function mindex_atomic.assert_unique_slots(uuid) from public, anon, authenticated;
grant execute on function mindex_atomic.assert_unique_slots(uuid) to mindex_atomic_writer;
select mindex_atomic.assert_unique_slots(id) from public.mindex_worship_services;

do $$
declare definition text;
begin
  select pg_get_functiondef('mindex_atomic.validate_document(uuid,jsonb)'::regprocedure) into definition;
  if strpos(definition,'FUNCTION mindex_atomic.validate_document(')=0
    or to_regprocedure('mindex_atomic.validate_document_before_slot_guard(uuid,jsonb)') is not null then
    raise exception 'UNEXPECTED_DOCUMENT_VALIDATOR';
  end if;
  execute replace(definition,'FUNCTION mindex_atomic.validate_document(',
    'FUNCTION mindex_atomic.validate_document_before_slot_guard(');
end
$$;
revoke all on function mindex_atomic.validate_document_before_slot_guard(uuid,jsonb) from public, anon, authenticated;
grant execute on function mindex_atomic.validate_document_before_slot_guard(uuid,jsonb) to mindex_atomic_writer;
create or replace function mindex_atomic.validate_document(sid uuid, doc jsonb) returns void
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  perform mindex_atomic.assert_unique_slots(sid);
  perform mindex_atomic.validate_document_before_slot_guard(sid,doc);
end
$$;
revoke all on function mindex_atomic.validate_document(uuid,jsonb) from public, anon, authenticated;
grant execute on function mindex_atomic.validate_document(uuid,jsonb) to mindex_atomic_writer;
commit;
