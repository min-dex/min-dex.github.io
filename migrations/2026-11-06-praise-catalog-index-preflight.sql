-- Read-only operator check. Reports metadata and fingerprints only.
begin read only;
select p.oid::regprocedure::text as signature,
       pg_get_userbyid(p.proowner) as owner,
       md5(p.prosrc) as body_md5,
       p.provolatile as volatility,
       p.prosecdef as security_definer,
       p.proconfig as settings,
       p.proacl as execute_acl
from pg_proc p
where p.oid in ('public.get_praise_storage_status_v1()'::regprocedure,
                'public.get_single_praise_records_v1(text[])'::regprocedure,
                'public.get_single_praise_catalog_page_v1(text,integer,text,text)'::regprocedure)
order by signature;

select t.tgname as trigger_name, t.tgenabled as enabled,
       t.tgfoid::regprocedure::text as handler, md5(f.prosrc) as handler_body_md5
from pg_trigger t join pg_proc f on f.oid=t.tgfoid
where t.tgrelid='mindex_single_song.records'::regclass and not t.tgisinternal
order by t.tgname;

select n.nspname as statistics_schema, e.extversion as statistics_version
from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where e.extname='pg_stat_statements';
commit;
