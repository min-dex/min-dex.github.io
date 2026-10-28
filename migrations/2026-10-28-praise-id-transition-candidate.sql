-- Administrator-only candidate. Install does not rename records.
-- Requires verified compatibility helpers and an exact preflight fingerprint.
begin;
create schema if not exists mindex_id_transition;
revoke all on schema mindex_id_transition from public;
create table if not exists mindex_id_transition.jobs(
 id uuid primary key, mapping jsonb not null, request jsonb not null, before_state jsonb not null,
 after_state jsonb, rolled_back_state jsonb, created_at timestamptz not null default now()
);
revoke all on mindex_id_transition.jobs from public;

create or replace function mindex_id_transition.snapshot() returns jsonb
language sql stable set search_path=pg_catalog as $fn$
 select jsonb_build_object(
 'records',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from mindex_single_song.records r),
 'issued',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from mindex_single_song.issued_ids r),
 'counters',(select coalesce(jsonb_agg(to_jsonb(r) order by prefix),'[]') from mindex_single_song.counters r),
 'rollout',(select to_jsonb(r) from mindex_single_song.rollout r where singleton),
 'services',(select coalesce(jsonb_agg(mindex_atomic.read_service(id) order by id),'[]') from public.mindex_worship_services),
 'contracts',(select jsonb_object_agg(p.oid::regprocedure::text,pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('mindex_atomic','mindex_id_transition','mindex_single_song') or (n.nspname='public' and p.proname in ('mindex_state_write_v1','save_single_praise_record_v1','mutate_single_praise_v1','get_single_praise_records_v1','mindex_worship_services_preserve_source_documents'))),
 'state',(select coalesce(jsonb_agg(to_jsonb(r) order by owner_hash,scope,key),'[]') from mindex_state_private.entries r)
 )
$fn$;
create or replace function mindex_id_transition.fingerprint() returns text
language sql stable set search_path=pg_catalog as $fn$
 select encode(sha256(convert_to(mindex_id_transition.snapshot()::text,'UTF8')),'hex')
$fn$;

-- Internal shared path: reverse mappings use new revisions, never old revision values.
create or replace function mindex_id_transition.rewrite(mapping jsonb, documents jsonb) returns void
language plpgsql set search_path=pg_catalog set lock_timeout='5s' set statement_timeout='60s' as $fn$
declare r record; rewritten jsonb; next_payload jsonb; aggregate jsonb; patches jsonb;
 doc jsonb; expected_doc jsonb; result jsonb; readback jsonb; expected jsonb; old_id text; new_id text;
begin
 -- Validation also rejects ambiguous/cyclic mappings.
 perform mindex_single_song.rewrite_id_references('{}',mapping);
 if exists(select from jsonb_each_text(mapping) m where not exists(select from mindex_single_song.records where id=m.key)
    or exists(select from mindex_single_song.records where id=m.value)) then raise exception 'REKEY_ID_DRIFT'; end if;
 -- No destructive schema change: constraint is deferred only inside this transaction.
 alter table public.mindex_worship_elements alter constraint mindex_worship_elements_praise_record_id_fkey deferrable initially deferred;
 set constraints public.mindex_worship_elements_praise_record_id_fkey deferred;
 for r in select * from mindex_single_song.records order by id loop
  next_payload:=mindex_single_song.rewrite_id_references(r.payload,mapping);
  if mapping ? r.id then
   new_id:=mapping->>r.id;
   next_payload:=jsonb_set(next_payload,'{previousIds}',(select coalesce(jsonb_agg(x order by x),'[]') from (
      select distinct x from jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]')||jsonb_build_array(r.id)) x where x<>new_id) a));
  else new_id:=r.id; end if;
  if next_payload is distinct from r.payload then
   next_payload:=jsonb_set(next_payload,'{revision}',to_jsonb(r.revision+1));
   if next_payload->'content' is distinct from r.payload->'content' then raise exception 'REKEY_PROTECTED_CONTENT_CHANGED'; end if;
   update mindex_single_song.records set id=new_id,revision=r.revision+1,payload=next_payload where id=r.id and revision=r.revision;
   if not found then raise exception 'REKEY_RECORD_CONFLICT'; end if;
  end if;
 end loop;
 -- Service changes go through the existing atomic CAS save, including history/checkpoints.
 for r in select id from public.mindex_worship_services order by id loop
  aggregate:=mindex_atomic.read_service(r.id);
  rewritten:=mindex_single_song.rewrite_id_references(aggregate,mapping);
  if rewritten is not distinct from aggregate then continue; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e->>'id','patch',jsonb_build_object('praise_record_id',e->'praise_record_id'))),'[]') into patches
   from jsonb_array_elements(rewritten->'elements') e
   where exists(select from jsonb_array_elements(aggregate->'elements') b where b->>'id'=e->>'id' and b->'praise_record_id' is distinct from e->'praise_record_id');
  expected_doc:=rewritten#>'{service,source_ref,mindexServiceDocument}';
  doc:=documents->r.id::text;
  if expected_doc is not null then
   if doc is null or (doc-array['sourceSignature','contentSignature','slideSignature','updatedAt']) is distinct from
       (expected_doc-array['sourceSignature','contentSignature','slideSignature','updatedAt']) then raise exception 'REKEY_DOCUMENT_PLAN_REQUIRED'; end if;
  elsif doc is not null then raise exception 'REKEY_UNEXPECTED_DOCUMENT';
  else doc:='{"idTransitionPreserveAbsentDocument":true}'::jsonb; end if;
  result:=mindex_atomic.save_existing(jsonb_strip_nulls(jsonb_build_object('protocolVersion',1,'singleSongProtocol',1,
   'serviceId',r.id,'requestId',gen_random_uuid(),'expectedRevision',aggregate->>'revision','elementPatches',patches,'document',doc)));
  if result is null then raise exception 'REKEY_ATOMIC_SAVE_FAILED'; end if;
  readback:=mindex_atomic.read_service(r.id);
  expected:=rewritten;
  if expected_doc is not null then expected:=jsonb_set(expected,'{service,source_ref,mindexServiceDocument}',doc); end if;
  if (readback->>'revision')::bigint<>(aggregate->>'revision')::bigint+1
    or ((readback->'service')-'updated_at') is distinct from ((expected->'service')-'updated_at')
    or readback->'sections' is distinct from expected->'sections'
    or readback->'slides' is distinct from expected->'slides'
    or (select jsonb_agg(e-'updated_at' order by e->>'id') from jsonb_array_elements(readback->'elements') e)
       is distinct from (select jsonb_agg(e-'updated_at' order by e->>'id') from jsonb_array_elements(expected->'elements') e)
    then raise exception 'REKEY_ATOMIC_READBACK_MISMATCH'; end if;
 end loop;
 set constraints public.mindex_worship_elements_praise_record_id_fkey immediate;
 alter table public.mindex_worship_elements alter constraint mindex_worship_elements_praise_record_id_fkey not deferrable;
 -- Pending requests have immutable digests: never rewrite them.
 if exists(select from mindex_state_private.entries e cross join jsonb_object_keys(mapping) k
   where e.key like '%pending%' and (strpos(e.key,k)>0 or strpos(coalesce(e.value,''),k)>0)) then raise exception 'REKEY_PENDING_WRITE'; end if;
 for r in select * from mindex_state_private.entries order by owner_hash,scope,key loop
  rewritten:=mindex_single_song.rewrite_id_references(jsonb_build_object('key',r.key,'value',r.value),mapping);
  if rewritten is not distinct from jsonb_build_object('key',r.key,'value',r.value) then continue; end if;
  if rewritten->>'key'<>r.key and exists(select from mindex_state_private.entries e where e.owner_hash=r.owner_hash and e.scope=r.scope and e.key=rewritten->>'key') then raise exception 'REKEY_STATE_KEY_COLLISION'; end if;
  update mindex_state_private.entries set key=rewritten->>'key',value=rewritten->>'value',revision=r.revision+1,
   request_id=gen_random_uuid(),request_digest=encode(sha256(convert_to(r.revision::text||':'||coalesce(rewritten->>'value','')||case when rewritten->>'value' is null then ':deleted' else ':value' end,'UTF8')),'hex'),updated_at=now()
   where owner_hash=r.owner_hash and scope=r.scope and key=r.key and revision=r.revision;
  if not found then raise exception 'REKEY_STATE_CONFLICT'; end if;
 end loop;
 for old_id,new_id in select * from jsonb_each_text(mapping) loop
  update mindex_single_song.issued_ids set deleted=true where id=old_id;
  insert into mindex_single_song.issued_ids values(new_id,false) on conflict(id) do update set deleted=false;
 end loop;
 update mindex_single_song.rollout set epoch=epoch+1 where singleton;
end $fn$;

create or replace function mindex_id_transition.apply(job_id uuid, expected_fingerprint text, mapping jsonb, documents jsonb) returns jsonb
language plpgsql set search_path=pg_catalog set lock_timeout='5s' set statement_timeout='60s' as $fn$
declare before_state jsonb; after_snapshot jsonb; n bigint; old_id text; new_id text; prior mindex_id_transition.jobs;
begin
 if job_id is null then raise exception 'REKEY_JOB_REQUIRED'; end if;
 perform pg_advisory_xact_lock(1296649822,0);
 perform pg_advisory_xact_lock(1296649816,1);
 lock table mindex_state_private.entries in share row exclusive mode;
 lock table mindex_single_song.records,mindex_single_song.issued_ids,mindex_single_song.counters in share row exclusive mode;
 lock table public.mindex_worship_services,public.mindex_worship_sections,public.mindex_worship_elements,public.mindex_worship_slides in share row exclusive mode;
 select * into prior from mindex_id_transition.jobs where id=job_id;
 if found then
  if prior.request is distinct from jsonb_build_object('fingerprint',expected_fingerprint,'mapping',mapping,'documents',documents) then raise exception 'REKEY_JOB_REUSED'; end if;
  return jsonb_build_object('jobId',job_id,'status',case when prior.rolled_back_state is null then 'applied' else 'rolled_back' end,'replayed',true);
 end if;
 if mindex_id_transition.fingerprint() is distinct from expected_fingerprint then raise exception 'REKEY_SNAPSHOT_CONFLICT'; end if;
 before_state:=mindex_id_transition.snapshot();
 if before_state#>>'{rollout,phase}' is distinct from 'native' then raise exception 'REKEY_NATIVE_REQUIRED'; end if;
 if jsonb_typeof(mapping) is distinct from 'object' or mapping='{}'::jsonb then raise exception 'REKEY_MAP_REQUIRED'; end if;
 if (select array_agg(key order by key) from jsonb_object_keys(mapping) key) is distinct from
    (select array_agg(id order by id) from mindex_single_song.records where id like 'SONG-CHLD-%') then raise exception 'REKEY_SCOPE_MISMATCH'; end if;
 select last_number into n from mindex_single_song.counters where prefix='SONG-CONT' for update;
 if n is null then raise exception 'REKEY_ALLOCATOR_MISSING'; end if;
 if exists(select from mindex_single_song.issued_ids where id like 'SONG-CONT-%' and substring(id,11,4)::bigint>n) then raise exception 'REKEY_ALLOCATOR_BEHIND'; end if;
 for old_id,new_id in select key,value from jsonb_each_text(mapping) order by key loop
  if old_id !~ '^SONG-CHLD-[0-9]{4}-[0-9]{4}$' or new_id !~ '^SONG-CONT-[0-9]{4}-[0-9]{4}$'
   or right(old_id,4)<>right(new_id,4) or substring(new_id,11,4)::bigint<=n
   or exists(select from mindex_single_song.issued_ids where left(id,14)=left(new_id,14)) then raise exception 'REKEY_ALLOCATION_CONFLICT'; end if;
 end loop;
 if exists(select from jsonb_each_text(mapping) group by left(key,14) having count(distinct left(value,14))<>1)
   or exists(select from jsonb_each_text(mapping) group by left(value,14) having count(distinct left(key,14))<>1) then raise exception 'REKEY_GROUP_CHANGED'; end if;
 insert into mindex_id_transition.jobs(id,mapping,request,before_state) values(job_id,mapping,jsonb_build_object('fingerprint',expected_fingerprint,'mapping',mapping,'documents',documents),before_state);
 perform mindex_id_transition.rewrite(mapping,documents);
 update mindex_single_song.counters set last_number=(select max(substring(value,11,4)::bigint) from jsonb_each_text(mapping)) where prefix='SONG-CONT';
 insert into mindex_single_song.counters(prefix,last_number)
  select left(m.value,14),greatest(max(right(m.value,4)::bigint),coalesce(max(c.last_number),0)) from jsonb_each_text(mapping) m left join mindex_single_song.counters c on c.prefix=left(m.key,14) group by left(m.value,14)
  on conflict(prefix) do update set last_number=greatest(mindex_single_song.counters.last_number,excluded.last_number);
 after_snapshot:=mindex_id_transition.snapshot();
 update mindex_id_transition.jobs set after_state=after_snapshot where id=job_id;
 return jsonb_build_object('jobId',job_id,'status','applied','records',(select count(*) from jsonb_object_keys(mapping)),'fingerprint',mindex_id_transition.fingerprint());
end $fn$;

create or replace function mindex_id_transition.rollback(job_id uuid, documents jsonb) returns jsonb
language plpgsql set search_path=pg_catalog set lock_timeout='5s' set statement_timeout='60s' as $fn$
declare job mindex_id_transition.jobs; inverse jsonb;
begin
 perform pg_advisory_xact_lock(1296649822,0);
 perform pg_advisory_xact_lock(1296649816,1);
 lock table mindex_state_private.entries in share row exclusive mode;
 lock table mindex_single_song.records,mindex_single_song.issued_ids,mindex_single_song.counters in share row exclusive mode;
 lock table public.mindex_worship_services,public.mindex_worship_sections,public.mindex_worship_elements,public.mindex_worship_slides in share row exclusive mode;
 select * into job from mindex_id_transition.jobs where id=job_id for update;
 if not found then raise exception 'REKEY_JOB_MISSING'; end if;
 if job.rolled_back_state is not null then return jsonb_build_object('status','rolled_back','replayed',true); end if;
 if job.after_state is distinct from mindex_id_transition.snapshot() then raise exception 'REKEY_ROLLBACK_DRIFT'; end if;
 select jsonb_object_agg(value,key) into inverse from jsonb_each_text(job.mapping);
 perform mindex_id_transition.rewrite(inverse,documents);
 update mindex_id_transition.jobs set rolled_back_state=mindex_id_transition.snapshot() where id=job_id;
 return jsonb_build_object('status','rolled_back','fingerprint',mindex_id_transition.fingerprint());
end $fn$;
revoke all on all functions in schema mindex_id_transition from public;
commit;
