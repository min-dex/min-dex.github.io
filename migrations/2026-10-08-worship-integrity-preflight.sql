-- Read-only operator preflight. Review results before either migration.
begin read only;
select pg_size_pretty(pg_database_size(current_database())) as database_size;
select count(*) as checkpoints, pg_size_pretty(coalesce(sum(pg_column_size(aggregate)),0)::bigint) as checkpoint_payload
  from mindex_atomic.checkpoints;
select count(*) as services,
  pg_size_pretty(coalesce(sum(pg_column_size(mindex_atomic.read_service(id))),0)::bigint) as current_payload
  from public.mindex_worship_services;
select p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proacl,
  md5(pg_get_functiondef(p.oid)) as definition_hash,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='mindex_atomic' and p.proname in
  ('read_service','save_existing','create_service','delete_service','restore_checkpoint','validate_document');
with slots as (
  select s.service_id,coalesce(nullif(btrim(e.source_ref->>'slotKey'),''),
    nullif(btrim(e.source_ref->>'slot_key'),''),nullif(btrim(e.config->>'slotKey'),''),
    nullif(btrim(e.config->>'slot_key'),'')) as slot
  from public.mindex_worship_elements e join public.mindex_worship_sections s on s.id=e.section_id
)
select service_id,slot,count(*) as members from slots where slot is not null
group by service_id,slot having count(*)>1;
select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and t.tgrelid in
  ('mindex_atomic.checkpoints'::regclass,'mindex_atomic.receipts'::regclass);
rollback;
