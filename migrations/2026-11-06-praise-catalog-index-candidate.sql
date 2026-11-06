-- UNAPPLIED. Review production function definitions and revision invariants first.
-- Add a read-only index for the same roles that already read the entire catalog.
begin;

create function public.get_praise_catalog_index_v1(expected_epoch text, expected_manifest text)
returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  with inventory as (
    select md5(coalesce(string_agg(id||':'||revision::text,',' order by id),'')) as manifest,
           coalesce(jsonb_agg(jsonb_build_array(id,revision) order by id),'[]'::jsonb) as entries
    from mindex_single_song.records
  )
  select jsonb_build_object('epoch',r.epoch::text,'manifest',i.manifest,'entries',i.entries)
  from mindex_single_song.rollout r cross join inventory i
  where r.singleton and r.phase='native'
    and r.epoch::text=expected_epoch and i.manifest=expected_manifest
$$;
revoke all on function public.get_praise_catalog_index_v1(text,text) from public;

do $$
declare
  status_function pg_proc;
  records_function pg_proc;
  reader name;
  definition text;
begin
  select * into strict status_function from pg_proc
   where oid='public.get_praise_storage_status_v1()'::regprocedure;
  select * into strict records_function from pg_proc
   where oid='public.get_single_praise_records_v1(text[])'::regprocedure;
  if md5(status_function.prosrc)<>'5a8f735d753c66a5d9ee8330f7d7b4be'
     or md5(records_function.prosrc)<>'049d2dcfe89990d571128ecd99afdd65'
     or not status_function.prosecdef or not records_function.prosecdef then
    raise exception 'PRAISE_READ_DEFINITION_CHANGED';
  end if;
  foreach reader in array array['anon'::name,'authenticated'::name] loop
    if not has_function_privilege(reader,status_function.oid,'execute')
       or not has_function_privilege(reader,records_function.oid,'execute')
       or not has_function_privilege(reader,'public.get_single_praise_catalog_page_v1(text,integer,text,text)','execute') then
      raise exception 'PRAISE_READ_ROLE_CHANGED';
    end if;
  end loop;
  definition:=pg_get_functiondef(status_function.oid);
  execute replace(definition,'''recordCount'',','''catalogIndex'',1,''recordCount'',');
end $$;

grant execute on function public.get_praise_catalog_index_v1(text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
