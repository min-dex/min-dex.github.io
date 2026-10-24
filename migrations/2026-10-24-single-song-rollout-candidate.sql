-- UNAPPLIED: install only after store/worship/lifecycle candidates.
-- Installation leaves mode=legacy; no IDs, worship rows or legacy grants change.
begin;
create table mindex_single_song.rollout (
 singleton boolean primary key default true check(singleton),
 phase text not null check(phase in ('legacy','maintenance','native')),
 epoch bigint not null default 0,
 native_written boolean not null default false
);
insert into mindex_single_song.rollout(singleton,phase) values(true,'legacy');
alter table mindex_single_song.rollout enable row level security;
revoke all on mindex_single_song.rollout from public,anon,authenticated,mindex_single_writer;
create function public.get_praise_storage_status_v1() returns jsonb
language sql security definer set search_path=pg_catalog as $$
 select jsonb_build_object('protocol',1,'phase',phase,'epoch',epoch::text,
  'recordCount',(select count(*) from mindex_single_song.records),
  'manifest',(select md5(coalesce(string_agg(id||':'||revision::text,',' order by id),'')) from mindex_single_song.records))
 from mindex_single_song.rollout where singleton
$$;
revoke all on function public.get_praise_storage_status_v1() from public;
grant execute on function public.get_praise_storage_status_v1() to anon,authenticated;

create function mindex_single_song.rollout_write_gate() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare mode text;
begin
 perform pg_advisory_xact_lock_shared(1296649816,1);
 -- Explicit database-administrator maintenance only; SET ROLE anon is not exempt.
 if session_user in ('postgres','supabase_admin') and coalesce(current_setting('role',true),'none') in ('none','postgres','supabase_admin') then return null; end if;
 select phase into mode from mindex_single_song.rollout where singleton;
 if mode='maintenance' or (tg_argv[0]='legacy' and mode<>'legacy')
  or (tg_argv[0]='native' and mode<>'native') then
  raise exception 'PRAISE_STORAGE_WRITE_FENCED:%',mode;
 end if;
 if mode='native' then update mindex_single_song.rollout set native_written=true where singleton and not native_written; end if;
 return null;
end $$;
revoke all on function mindex_single_song.rollout_write_gate() from public;
do $$ declare t text; begin
 foreach t in array array['mindex_songs','mindex_song_versions','mindex_version_units','mindex_canonical_songs','mindex_song_relations','mindex_song_units','mindex_praise_operations'] loop
  if to_regclass('public.'||t) is not null then
   execute format('create trigger aaa_single_storage_gate before insert or update or delete or truncate on public.%I for each statement execute function mindex_single_song.rollout_write_gate(''legacy'')',t);
  end if;
 end loop;
 foreach t in array array['records','receipts','issued_ids','counters'] loop
  execute format('create trigger aaa_single_storage_gate before insert or update or delete or truncate on mindex_single_song.%I for each statement execute function mindex_single_song.rollout_write_gate(''native'')',t);
 end loop;
 foreach t in array array['mindex_worship_services','mindex_worship_sections','mindex_worship_elements','mindex_worship_slides'] loop
  execute format('create trigger aaa_single_storage_gate before insert or update or delete or truncate on public.%I for each statement execute function mindex_single_song.rollout_write_gate(''worship'')',t);
 end loop;
end $$;

create function public.get_single_praise_catalog_page_v1(after_id text, page_size integer, expected_epoch text, expected_manifest text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare status jsonb; rows jsonb; last_id text;
begin
 status:=public.get_praise_storage_status_v1();
 if status->>'phase'<>'native' or status->>'epoch' is distinct from expected_epoch
  or status->>'manifest' is distinct from expected_manifest then raise exception 'PRAISE_STORAGE_CHANGED'; end if;
 if page_size is null or page_size<1 or page_size>200 then raise exception 'INVALID_CATALOG_PAGE'; end if;
 select coalesce(jsonb_agg(payload||jsonb_build_object('revision',revision) order by id),'[]'),max(id) into rows,last_id
 from (select * from mindex_single_song.records where after_id is null or id>after_id order by id limit page_size) r;
 return jsonb_build_object('records',rows,'after',last_id,'epoch',expected_epoch,'manifest',expected_manifest);
end $$;
revoke all on function public.get_single_praise_catalog_page_v1(text,integer,text,text) from public;
grant execute on function public.get_single_praise_catalog_page_v1(text,integer,text,text) to anon,authenticated;

-- UUID and readable IDs both use indexed recovery-reference lookup.
create function mindex_single_song.document_reference_ids(document jsonb) returns text[]
language sql immutable strict parallel safe set search_path=pg_catalog as $$
 select coalesce(array_agg(distinct m[1]),array[]::text[]) from regexp_matches(document::text,
 '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?:knh|kth|ccm|kid)-[0-9]{3,}(?:-[0-9]{3})?)','g') m
$$;
revoke all on function mindex_single_song.document_reference_ids(jsonb) from public;
grant execute on function mindex_single_song.document_reference_ids(jsonb) to mindex_single_writer,mindex_atomic_writer;
create index single_checkpoint_reference_ids on mindex_atomic.checkpoints using gin(mindex_single_song.document_reference_ids(aggregate));
do $$ begin
 if to_regclass('mindex_atomic.revision_history') is not null then
  create index single_revision_reference_ids on mindex_atomic.revision_history using gin(mindex_single_song.document_reference_ids(aggregate));
 end if;
end $$;
create or replace function mindex_single_song.history_references(ids text[]) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare used boolean;
begin
 if exists(select from mindex_atomic.checkpoints where mindex_single_song.document_reference_ids(aggregate) && array_remove(ids,null)) then return true; end if;
 if to_regclass('mindex_atomic.revision_history') is null then return false; end if;
 execute 'select exists(select from mindex_atomic.revision_history where mindex_single_song.document_reference_ids(aggregate) && array_remove($1,null))' into used using ids;
 return used;
end $$;
do $$ declare src text; needle text; begin
 src:=pg_get_functiondef('public.mutate_single_praise_v1(jsonb)'::regprocedure);
 needle:=$needle$    or exists(select from mindex_atomic.checkpoints c where c.aggregate::text like '%'||sid||'%' or c.aggregate::text like '%'||(old->'legacy'->>'versionId')||'%' or c.aggregate::text like '%'||(old->'legacy'->>'songId')||'%')$needle$;
 if strpos(src,needle)=0 then raise exception 'SINGLE_DELETE_CONTRACT_CHANGED'; end if;
 execute replace(src,needle,'');
end $$;

-- Even an empty/new worship must reject the old protocol after activation.
alter function mindex_atomic.require_single_song_protocol(jsonb) rename to require_single_song_protocol_before_rollout;
grant execute on function public.get_praise_storage_status_v1() to mindex_atomic_writer;
create function mindex_atomic.require_single_song_protocol(req jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare mode text;
begin
 perform pg_advisory_xact_lock(1296649822,0);
 mode:=public.get_praise_storage_status_v1()->>'phase';
 if mode='maintenance' then raise exception 'PRAISE_STORAGE_WRITE_FENCED:maintenance'; end if;
 if mode='native' and req->>'singleSongProtocol' is distinct from '1' then raise exception 'SINGLE_SONG_CLIENT_REQUIRED'; end if;
 perform mindex_atomic.require_single_song_protocol_before_rollout(req);
end $$;
revoke all on function mindex_atomic.require_single_song_protocol(jsonb) from public;
grant execute on function mindex_atomic.require_single_song_protocol(jsonb) to mindex_atomic_writer;

-- Admin-only transition; imported references/payload must be rehearsed separately.
create function mindex_single_song.set_rollout_phase(next_phase text, expected_epoch bigint, expected_count bigint, expected_manifest text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare old mindex_single_song.rollout%rowtype; status jsonb;
begin
 perform pg_advisory_xact_lock(1296649822,0);
 perform pg_advisory_xact_lock(1296649816,1);
 select * into old from mindex_single_song.rollout where singleton for update;
 if old.epoch<>expected_epoch or next_phase not in ('legacy','maintenance','native') then raise exception 'ROLLOUT_CONFLICT'; end if;
 if next_phase<>'maintenance' and old.phase<>'maintenance' then raise exception 'MAINTENANCE_REQUIRED'; end if;
 if next_phase='legacy' and old.native_written then raise exception 'NATIVE_WRITES_REQUIRE_FORWARD_RECOVERY'; end if;
 if next_phase='native' then
  status:=public.get_praise_storage_status_v1();
  if expected_count<=0 or expected_count is null or (status->>'recordCount')::bigint is distinct from expected_count
   or status->>'manifest' is distinct from expected_manifest then raise exception 'CATALOG_NOT_VERIFIED'; end if;
  if exists(select from public.mindex_worship_elements where song_id is not null or song_version_id is not null) then raise exception 'LEGACY_REFERENCES_REMAIN'; end if;
  if exists(select from mindex_single_song.records r where not exists(select from mindex_single_song.issued_ids i where i.id=r.id and not i.deleted)) then raise exception 'ISSUED_IDS_INCOMPLETE'; end if;
  if exists(select from unnest(array['ccm','kid']) p where coalesce((select last_number from mindex_single_song.counters where prefix=p),-1)<coalesce((select max(substring(id from '[0-9]+$')::bigint) from mindex_single_song.issued_ids where id ~ ('^'||p||'-[0-9]+$')),0)) then raise exception 'COUNTERS_NOT_READY'; end if;
  grant execute on function public.get_single_praise_records_v1(text[]),public.save_single_praise_record_v1(jsonb),public.mutate_single_praise_v1(jsonb) to anon,authenticated;
 end if;
 update mindex_single_song.rollout set phase=next_phase,epoch=epoch+1 where singleton;
 return public.get_praise_storage_status_v1();
end $$;
revoke all on function mindex_single_song.set_rollout_phase(text,bigint,bigint,text) from public,anon,authenticated,mindex_single_writer;
commit;
