-- Roll back only the reviewed additive catalog index and capability flag.
begin;
do $$
declare status_function pg_proc;
begin
  select * into strict status_function from pg_proc
   where oid='public.get_praise_storage_status_v1()'::regprocedure;
  if md5(status_function.prosrc)<>'6101e5d8f660b0a90c7fc62681c675fa' then
    raise exception 'PRAISE_READ_DEFINITION_CHANGED';
  end if;
  execute replace(pg_get_functiondef(status_function.oid),'''catalogIndex'',1,''recordCount'',','''recordCount'',');
end $$;
drop function public.get_praise_catalog_index_v1(text,text);
notify pgrst,'reload schema';
commit;
