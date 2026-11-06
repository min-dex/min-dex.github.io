-- UNAPPLIED. Review production function definitions and revision invariants first.
-- Add a read-only index for the same roles that already read the entire catalog.
begin;

create function public.get_praise_catalog_index_v1(expected_epoch text, expected_manifest text)
returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  with inventory as (
    select md5(coalesce(string_agg(id||':'||revision::text,',' order by id),'')) as manifest,
           coalesce(jsonb_agg(jsonb_build_array(id,revision) order by id),'[]'::jsonb) as entries
    from mindex_single_song.records where not catalog_deleted
  )
  select jsonb_build_object('epoch',r.epoch::text,'manifest',i.manifest,'entries',i.entries)
  from mindex_single_song.rollout r cross join inventory i
  where r.singleton and r.phase='native'
    and r.epoch::text=expected_epoch and i.manifest=expected_manifest
$$;
revoke all on function public.get_praise_catalog_index_v1(text,text) from public;

create function public.get_praise_catalog_records_v1(ids text[], expected_epoch text)
returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select (
    select coalesce(jsonb_agg(r.payload||jsonb_build_object('revision',r.revision) order by r.id),'[]'::jsonb)
    from mindex_single_song.records r
    where r.id=any(ids) and not r.catalog_deleted
  )
  from mindex_single_song.rollout s
  where s.singleton and s.phase='native' and s.epoch::text=expected_epoch
    and cardinality(ids) between 1 and 200
$$;
revoke all on function public.get_praise_catalog_records_v1(text[],text) from public;

do $$
declare
  status_function pg_proc;
  page_function pg_proc;
  reader name;
  definition text;
begin
  select * into strict status_function from pg_proc
   where oid='public.get_praise_storage_status_v1()'::regprocedure;
  select * into strict page_function from pg_proc
   where oid='public.get_single_praise_catalog_page_v1(text,integer,text,text)'::regprocedure;
  if md5(status_function.prosrc)<>'1909bb255b97dbdda78c90f1867e8493'
     or md5(page_function.prosrc)<>'6a6ee2dd5e845ce07131ace3cb6d86d6'
     or not status_function.prosecdef or not page_function.prosecdef then
    raise exception 'PRAISE_READ_DEFINITION_CHANGED';
  end if;
  foreach reader in array array['anon'::name,'authenticated'::name] loop
    if not has_function_privilege(reader,status_function.oid,'execute')
       or not has_function_privilege(reader,page_function.oid,'execute') then
      raise exception 'PRAISE_READ_ROLE_CHANGED';
    end if;
  end loop;
  definition:=pg_get_functiondef(status_function.oid);
  execute replace(definition,'''recordCount'',','''catalogIndex'',1,''recordCount'',');
end $$;

grant execute on function public.get_praise_catalog_index_v1(text,text),
  public.get_praise_catalog_records_v1(text[],text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
