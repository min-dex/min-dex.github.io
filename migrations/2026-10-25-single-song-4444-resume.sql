-- Operator-run only: resume the confirmed failed 01; no worship references change.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(1296649822,0);
do $guard$ begin
 if to_regclass('mindex_single_recovery.state') is null or to_regclass('mindex_single_song.records') is null
 or to_regprocedure('public.save_single_praise_record_v1(jsonb)') is null
 or to_regclass('mindex_single_song.rollout') is not null or to_regclass('mindex_single_song.issued_ids') is not null
 or exists(select from pg_roles where rolname='mindex_single_writer') then raise exception 'PARTIAL_PREPARE_STATE_CHANGED'; end if;
 if exists(select from mindex_single_song.records) or exists(select from mindex_single_song.receipts)
 or exists(select from public.mindex_worship_elements where praise_record_id is not null) then raise exception 'STORE_NOT_EMPTY'; end if;
end $guard$;
alter table mindex_single_song.records drop constraint records_id_check;
alter table mindex_single_song.records add constraint records_id_check check(id ~ '^SONG-(HYMN-(N[0-9]{3}|T[0-9]{3})|CONT-[0-9]{4}|CHLD-[0-9]{4})-[0-9]{4}$');
alter table mindex_single_song.records add constraint records_id_range check(split_part(id,'-',4)::int between 1 and 9999 and (case when split_part(id,'-',2)='HYMN' then substring(split_part(id,'-',3) from 2)::int between 1 and case when substring(id from 11 for 1)='N' then 645 else 558 end else split_part(id,'-',3)::int between 1 and 9999 end));

-- Reject malformed imported groups before enabling lifecycle operations.
do $$
declare r record; target text; peers jsonb;
begin
 for r in select id,payload from mindex_single_song.records loop
  if jsonb_typeof(r.payload->'relations'->'same_song') is distinct from 'array'
   or jsonb_typeof(r.payload->'relations'->'related') is distinct from 'array' then raise exception 'SINGLE_SONG_GRAPH_INVALID'; end if;
  for target in select jsonb_array_elements_text((r.payload->'relations'->'same_song') || (r.payload->'relations'->'related')) loop
   if target=r.id or not exists(select from mindex_single_song.records where id=target) then raise exception 'SINGLE_SONG_GRAPH_INVALID'; end if;
  end loop;
  for target in select jsonb_array_elements_text(r.payload->'relations'->'same_song') loop
   select payload->'relations'->'same_song' into peers from mindex_single_song.records where id=target;
   if (select array_agg(x order by x) from jsonb_array_elements_text(peers||jsonb_build_array(target)) x)
    is distinct from (select array_agg(x order by x) from jsonb_array_elements_text((r.payload->'relations'->'same_song')||jsonb_build_array(r.id)) x)
    then raise exception 'SINGLE_SONG_GRAPH_INVALID'; end if;
  end loop;
 end loop;
end $$;
create role mindex_single_writer nologin noinherit;
do $membership$ begin execute format('grant mindex_single_writer to %I with set true, inherit true',current_user); end $membership$;
grant create on schema public,mindex_single_song to mindex_single_writer;
create table mindex_single_song.issued_ids(id text primary key check(id ~ '^SONG-(HYMN-(N[0-9]{3}|T[0-9]{3})|CONT-[0-9]{4}|CHLD-[0-9]{4})-[0-9]{4}$'), deleted boolean not null default false);
insert into mindex_single_song.issued_ids(id) select id from mindex_single_song.records;
create table mindex_single_song.counters(prefix text primary key, last_number bigint not null check(last_number>=0));
insert into mindex_single_song.counters values ('SONG-CONT',0),('SONG-CHLD',0);
alter table mindex_single_song.issued_ids enable row level security;
alter table mindex_single_song.counters enable row level security;
grant usage on schema mindex_single_song to mindex_single_writer;
grant select,insert,update,delete on all tables in schema mindex_single_song to mindex_single_writer;
create policy single_writer_records on mindex_single_song.records to mindex_single_writer using(true) with check(true);
create policy single_writer_receipts on mindex_single_song.receipts to mindex_single_writer using(true) with check(true);
create policy single_writer_issued on mindex_single_song.issued_ids to mindex_single_writer using(true) with check(true);
create policy single_writer_counters on mindex_single_song.counters to mindex_single_writer using(true) with check(true);
grant select on public.mindex_worship_elements,public.mindex_worship_services to mindex_single_writer;
create policy single_writer_usage_elements on public.mindex_worship_elements for select to mindex_single_writer using(true);
create policy single_writer_usage_services on public.mindex_worship_services for select to mindex_single_writer using(true);
grant usage on schema mindex_atomic to mindex_single_writer;
grant select on mindex_atomic.checkpoints to mindex_single_writer;

-- Newer production keeps multiple recovery revisions, beyond the current checkpoint.
create function mindex_single_song.history_references(ids text[]) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare used boolean;
begin
 if to_regclass('mindex_atomic.revision_history') is null then return false; end if;
 execute 'select exists(select from mindex_atomic.revision_history h, unnest($1) i where i is not null and h.aggregate::text like ''%''||i||''%'')' into used using ids;
 return used;
end $$;
revoke all on function mindex_single_song.history_references(text[]) from public;
grant execute on function mindex_single_song.history_references(text[]) to mindex_single_writer;
do $$ begin
 if to_regclass('mindex_atomic.revision_history') is not null then
  grant select on mindex_atomic.revision_history to mindex_single_writer;
  create policy single_writer_history_read on mindex_atomic.revision_history for select to mindex_single_writer using(true);
 end if;
end $$;

-- Existing save implementation stays private; the wrapper forbids creation/resurrection
-- and graph/identity changes through ordinary content saves.
alter function public.save_single_praise_record_v1(jsonb) set schema mindex_single_song;
alter function mindex_single_song.save_single_praise_record_v1(jsonb) owner to mindex_single_writer;
create function public.save_single_praise_record_v1(req jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare old jsonb; r jsonb;
begin
 perform pg_advisory_xact_lock(1296649822,0);
 select payload into old from mindex_single_song.records where id=req->'record'->>'id';
 if not found then raise exception 'SINGLE_SONG_MISSING'; end if;
 if exists(select from mindex_single_song.receipts where request_id=(req->>'requestId')::uuid) then return mindex_single_song.save_single_praise_record_v1(req); end if;
 r:=req->'record';
 if r->'relations' is distinct from old->'relations' or r->'legacy' is distinct from old->'legacy'
 or r->'provenance' is distinct from old->'provenance' then raise exception 'SINGLE_SONG_IDENTITY_OR_RELATIONS_CHANGED'; end if;
 return mindex_single_song.save_single_praise_record_v1(req);
end $$;
alter function public.save_single_praise_record_v1(jsonb) owner to mindex_single_writer;
alter function public.get_single_praise_records_v1(text[]) security definer;
alter function public.get_single_praise_records_v1(text[]) owner to mindex_single_writer;

create function public.mutate_single_praise_v1(req jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare rid uuid; op text; sid text; alloc_prefix text; base_id text; n bigint; old jsonb; rec jsonb; result jsonb;
 receipt mindex_single_song.receipts%rowtype; ids text[]; affected text[]; peers text[]; group_ids text[];
 target text; rowid text; expected jsonb; updates jsonb:='[]'; metadata jsonb; content jsonb;
begin
 if jsonb_typeof(req) is distinct from 'object' or req->>'protocolVersion' is distinct from '1' then raise exception 'INVALID_SINGLE_SONG_REQUEST'; end if;
 rid:=(req->>'requestId')::uuid;op:=req->>'operation';
 if rid is null or op is null or op not in ('create','delete','same_song','related') then raise exception 'INVALID_SINGLE_SONG_REQUEST'; end if;
 perform pg_advisory_xact_lock(1296649822,0);
 select * into receipt from mindex_single_song.receipts where request_id=rid;
 if found then
  if receipt.request is distinct from req then raise exception 'SINGLE_SONG_REQUEST_REUSED'; end if;
  -- Replaying a creation after deletion must never resurrect its catalog view.
  if op='create' and not exists(select from mindex_single_song.records where id=receipt.result->>'id') then raise exception 'SINGLE_SONG_CREATED_THEN_REMOVED'; end if;
  return receipt.result;
 end if;
 if op='create' then
  alloc_prefix:=case req->>'prefix' when 'ccm' then 'SONG-CONT' when 'kid' then 'SONG-CHLD' else req->>'prefix' end;base_id:=req->>'baseId';metadata:=req->'metadata';content:=req->'content';
  if (base_id is null and (alloc_prefix is null or alloc_prefix not in ('SONG-CONT','SONG-CHLD'))) or jsonb_typeof(metadata) is distinct from 'object'
   or jsonb_typeof(content) is distinct from 'object' or nullif(btrim(metadata->>'title'),'') is null
   or metadata ?| array['id','versions','related_song_ids','same_song_ids']
   or content ?| array['id','source_song_id','canonical_song_id'] then raise exception 'INVALID_SINGLE_SONG_CREATE'; end if;
  -- Official hymn numbers are imported explicitly; arbitrary new hymn numbers are not issued.
  if base_id is not null then
   select payload into old from mindex_single_song.records where id=base_id;
   if not found then raise exception 'SINGLE_SONG_MISSING'; end if;
   select array_agg(x order by x) into affected from unnest(array[base_id]||array(select jsonb_array_elements_text(old->'relations'->'same_song'))) x;
   expected:=req->'expectedRevisions';
   if jsonb_typeof(expected) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(expected) k) is distinct from affected then raise exception 'SINGLE_SONG_GRAPH_CONFLICT'; end if;
   foreach rowid in array affected loop
    if (select revision::text from mindex_single_song.records where id=rowid) is distinct from expected->>rowid then raise exception 'SINGLE_SONG_CONFLICT'; end if;
   end loop;
   alloc_prefix:=left(base_id,14);
   insert into mindex_single_song.counters(prefix,last_number)
    select alloc_prefix,coalesce(max(substring(id from '[0-9]+$')::bigint),0) from mindex_single_song.issued_ids where id ~ ('^'||alloc_prefix||'-[0-9]{4}$')
    on conflict do nothing;
  end if;
  update mindex_single_song.counters set last_number=last_number+1 where counters.prefix=alloc_prefix returning last_number into n;
  if not found then raise exception 'INVALID_SINGLE_SONG_PREFIX'; end if;
  if n>9999 then raise exception 'SINGLE_SONG_SUFFIX_EXHAUSTED'; end if;
  sid:=alloc_prefix||'-'||lpad(n::text,4,'0')||case when base_id is null then '-0001' else '' end;
  insert into mindex_single_song.issued_ids(id) values(sid);
  rec:=jsonb_build_object('id',sid,'revision',1,'metadata',metadata,'content',content,'relations',jsonb_build_object('same_song','[]'::jsonb,'related','[]'::jsonb));
  insert into mindex_single_song.records values(sid,1,rec);
  updates:=jsonb_build_array(rec);
  if base_id is not null then
   group_ids:=affected||array[sid];updates:='[]';
   for rowid,rec in select id,payload from mindex_single_song.records where id=any(group_ids) order by id loop
    select coalesce(array_agg(x order by x),'{}') into peers from unnest(group_ids) x where x<>rowid;
    rec:=jsonb_set(rec,'{relations,same_song}',to_jsonb(peers));
    if rowid<>sid then rec:=jsonb_set(rec,'{revision}',to_jsonb((rec->>'revision')::bigint+1)); end if;
    update mindex_single_song.records set revision=(rec->>'revision')::bigint,payload=rec where id=rowid;
    updates:=updates||jsonb_build_array(rec);
   end loop;
  end if;
  result:=jsonb_build_object('id',sid,'records',updates,'deleted','[]'::jsonb);
 else
  sid:=req->>'id';expected:=req->'expectedRevisions';
  select payload into old from mindex_single_song.records where id=sid;
  if not found then raise exception 'SINGLE_SONG_MISSING'; end if;
  if jsonb_typeof(expected) is distinct from 'object' then raise exception 'INVALID_SINGLE_SONG_REVISIONS'; end if;
  if op='delete' then
   if sid like 'SONG-HYMN-%' or jsonb_array_length(coalesce(old->'content'->'forms','[]'))>0
    or coalesce(old->'content'->'audio_set','null')<>'null'::jsonb
    or exists(select from jsonb_each((old->'content') - array['name','raw_section_name','is_primary','praise_types','forms','audio_set','source_count','_worshipVersionPersisted']) p where p.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb,'false'::jsonb))
    or exists(select from jsonb_each((old->'metadata') - array['title','praise_types','_relationalVersionsLoaded','_memoHasVersions']) p where p.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb,'false'::jsonb))
    or jsonb_array_length(coalesce(old->'relations'->'related','[]'))>0
    or exists(select from mindex_single_song.records where payload->'relations'->'related' ? sid)
    then raise exception 'SINGLE_SONG_NOT_EMPTY'; end if;
   if exists(select from public.mindex_worship_elements e where e.praise_record_id=sid
     or e.song_version_id::text=old->'legacy'->>'versionId' or e.song_id::text=old->'legacy'->>'songId')
    or exists(select from public.mindex_worship_services s where s.source_ref::text like '%'||sid||'%' or s.source_ref::text like '%'||(old->'legacy'->>'versionId')||'%' or s.source_ref::text like '%'||(old->'legacy'->>'songId')||'%')
    or exists(select from mindex_atomic.checkpoints c where c.aggregate::text like '%'||sid||'%' or c.aggregate::text like '%'||(old->'legacy'->>'versionId')||'%' or c.aggregate::text like '%'||(old->'legacy'->>'songId')||'%')
    or mindex_single_song.history_references(array[sid,old->'legacy'->>'versionId',old->'legacy'->>'songId'])
    then raise exception 'SINGLE_SONG_IN_USE'; end if;
   select array_agg(id order by id) into affected from mindex_single_song.records where id=sid or payload->'relations'->'same_song' ? sid;
  elsif op='related' then
   if jsonb_typeof(req->'members') is distinct from 'array' then raise exception 'INVALID_SINGLE_SONG_MEMBERS'; end if;
   select coalesce(array_agg(distinct x order by x),'{}') into ids from jsonb_array_elements_text(req->'members') x;
   if sid=any(ids) or exists(select from unnest(ids) x where not exists(select from mindex_single_song.records where id=x)) then raise exception 'SINGLE_SONG_MISSING'; end if;
   affected:=array[sid];
  else
   if jsonb_typeof(req->'members') is distinct from 'array' then raise exception 'INVALID_SINGLE_SONG_MEMBERS'; end if;
   select coalesce(array_agg(distinct x order by x),'{}') into ids from jsonb_array_elements_text(req->'members') x;
   if not sid=any(ids) or exists(select from unnest(ids) x where not exists(select from mindex_single_song.records where id=x)) then raise exception 'SINGLE_SONG_MISSING'; end if;
   -- Full connected closure: removing one edge must not leave an indirect connection.
   with recursive reach(id) as (select unnest(ids) union select r.id from mindex_single_song.records r join reach a on r.payload->'relations'->'same_song' ? a.id)
   select array_agg(id order by id) into affected from reach;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(expected) k) is distinct from (select array_agg(x order by x) from unnest(affected) x) then raise exception 'SINGLE_SONG_GRAPH_CONFLICT'; end if;
  foreach rowid in array affected loop
   if (select revision::text from mindex_single_song.records where id=rowid) is distinct from expected->>rowid then raise exception 'SINGLE_SONG_CONFLICT'; end if;
  end loop;
  -- All checks precede all edits. Read original groups before updating any member.
  for rowid,rec in select id,payload from mindex_single_song.records where id=any(affected) order by id loop
   if op='delete' and rowid=sid then continue; end if;
   if op='related' then
    rec:=jsonb_set(rec,'{relations,related}',to_jsonb(ids));
   else
    if op='same_song' and rowid=any(ids) then group_ids:=ids;
    else
     select coalesce(array_agg(distinct x order by x),'{}') into group_ids
     from unnest(array[rowid]||array(select jsonb_array_elements_text(coalesce(rec->'relations'->'same_song','[]')))) x
     where (op<>'delete' or x<>sid) and (op<>'same_song' or not x=any(ids));
    end if;
    select coalesce(array_agg(x order by x),'{}') into peers from unnest(group_ids) x where x<>rowid;
    rec:=jsonb_set(rec,'{relations,same_song}',to_jsonb(peers));
   end if;
   rec:=jsonb_set(rec,'{revision}',to_jsonb((rec->>'revision')::bigint+1));updates:=updates||jsonb_build_array(rec);
  end loop;
  for rec in select value from jsonb_array_elements(updates) loop
   update mindex_single_song.records set revision=(rec->>'revision')::bigint,payload=rec where id=rec->>'id';
  end loop;
  if op='delete' then
   delete from mindex_single_song.records where id=sid;
   update mindex_single_song.issued_ids set deleted=true where id=sid;
  end if;
  result:=jsonb_build_object('records',updates,'deleted',case when op='delete' then jsonb_build_array(sid) else '[]'::jsonb end);
 end if;
 insert into mindex_single_song.receipts values(rid,req,result);
 return result;
end $$;
alter function public.mutate_single_praise_v1(jsonb) owner to mindex_single_writer;
revoke all on function public.mutate_single_praise_v1(jsonb),public.save_single_praise_record_v1(jsonb),public.get_single_praise_records_v1(text[]) from public;

alter table mindex_single_song.issued_ids add constraint issued_id_range check(split_part(id,'-',4)::int between 1 and 9999 and (case when split_part(id,'-',2)='HYMN' then substring(split_part(id,'-',3) from 2)::int between 1 and case when substring(id from 11 for 1)='N' then 645 else 558 end else split_part(id,'-',3)::int between 1 and 9999 end));

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
 select jsonb_build_object('protocol',1,'idFormat','4-4-4-4','phase',phase,'epoch',epoch::text,
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
 '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|SONG-(?:HYMN-[NT][0-9]{3}|CONT-[0-9]{4}|CHLD-[0-9]{4})-[0-9]{4})','g') m
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
  if exists(select from unnest(array['SONG-CONT','SONG-CHLD']) p where coalesce((select last_number from mindex_single_song.counters where prefix=p),-1)<coalesce((select max(split_part(id,'-',3)::bigint) from mindex_single_song.issued_ids where id ~ ('^'||p||'-[0-9]{4}-[0-9]{4}$')),0)) then raise exception 'COUNTERS_NOT_READY'; end if;
  grant execute on function public.get_single_praise_records_v1(text[]),public.save_single_praise_record_v1(jsonb),public.mutate_single_praise_v1(jsonb) to anon,authenticated;
 end if;
 update mindex_single_song.rollout set phase=next_phase,epoch=epoch+1 where singleton;
 return public.get_praise_storage_status_v1();
end $$;
revoke all on function mindex_single_song.set_rollout_phase(text,bigint,bigint,text) from public,anon,authenticated,mindex_single_writer;
do $grant_admin$ begin execute format('grant execute on function public.get_single_praise_records_v1(text[]),public.save_single_praise_record_v1(jsonb),public.mutate_single_praise_v1(jsonb) to %I with grant option',current_user); end $grant_admin$;
revoke create on schema public,mindex_single_song from mindex_single_writer;
do $membership$ begin execute format('revoke mindex_single_writer from %I',current_user); end $membership$;
commit;
select 'PASS: partial preparation repaired; 4-4-4-4 storage ready; legacy remains active' as result;
