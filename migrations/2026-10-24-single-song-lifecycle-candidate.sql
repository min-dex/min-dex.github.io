-- UNAPPLIED. Run only after the single store and worship candidates in an isolated rehearsal.
-- Public/client access remains revoked. No operational rows or legacy grants are changed.
begin;
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
create table mindex_single_song.issued_ids(id text primary key check(id ~ '^(knh|kth|ccm|kid)-[0-9]{3,}(-[0-9]{3})?$'), deleted boolean not null default false);
insert into mindex_single_song.issued_ids(id) select id from mindex_single_song.records;
create table mindex_single_song.counters(prefix text primary key, last_number bigint not null check(last_number>=0));
insert into mindex_single_song.counters
 select p,coalesce(max(substring(id from '[0-9]+$')::bigint),0) from unnest(array['ccm','kid']) p
 left join mindex_single_song.issued_ids on id ~ ('^'||p||'-[0-9]+$') group by p;
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
  alloc_prefix:=req->>'prefix';base_id:=req->>'baseId';metadata:=req->'metadata';content:=req->'content';
  if (base_id is null and (alloc_prefix is null or alloc_prefix not in ('ccm','kid'))) or jsonb_typeof(metadata) is distinct from 'object'
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
   alloc_prefix:=substring(base_id from '^(?:knh|kth|ccm|kid)-[0-9]+');
   insert into mindex_single_song.counters(prefix,last_number)
    select alloc_prefix,coalesce(max(substring(id from '[0-9]+$')::bigint),0) from mindex_single_song.issued_ids where id ~ ('^'||alloc_prefix||'-[0-9]{3}$')
    on conflict do nothing;
  end if;
  update mindex_single_song.counters set last_number=last_number+1 where counters.prefix=alloc_prefix returning last_number into n;
  if not found then raise exception 'INVALID_SINGLE_SONG_PREFIX'; end if;
  if base_id is not null and n>999 then raise exception 'SINGLE_SONG_SUFFIX_EXHAUSTED'; end if;
  sid:=alloc_prefix||'-'||lpad(n::text,greatest(3,length(n::text)), '0');
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
   if sid ~ '^(knh|kth)-' or jsonb_array_length(coalesce(old->'content'->'forms','[]'))>0
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
commit;
