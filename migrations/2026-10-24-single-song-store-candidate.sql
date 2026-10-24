-- Unapplied candidate. No old Praise/Worship rows, grants or policies are changed.
-- New storage is closed by default. Production access policy/cutover needs separate review.
begin;
create schema if not exists mindex_single_song;
revoke all on schema mindex_single_song from public;
create table mindex_single_song.records (
 id text primary key check (id ~ '^(knh|kth|ccm|kid)-[0-9]{3,}(-[0-9]{3})?$'),
 revision bigint not null check(revision>=0),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id
   and jsonb_typeof(payload->'metadata')='object' and jsonb_typeof(payload->'content')='object')
);
create table mindex_single_song.receipts (
 request_id uuid primary key, request jsonb not null, result jsonb not null
);
alter table mindex_single_song.records enable row level security;
alter table mindex_single_song.receipts enable row level security;
revoke all on all tables in schema mindex_single_song from public;
create function public.get_single_praise_records_v1(ids text[]) returns jsonb
language sql security invoker set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(payload || jsonb_build_object('revision',revision) order by id),'[]'::jsonb)
 from mindex_single_song.records where id=any(ids);
$$;
create function public.save_single_praise_record_v1(req jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare rid uuid; sid text; expected bigint; stored bigint; receipt mindex_single_song.receipts%rowtype;
 record jsonb; result jsonb;
begin
 if jsonb_typeof(req) is distinct from 'object' then raise exception 'INVALID_SINGLE_SONG_REQUEST'; end if;
 rid:=(req->>'requestId')::uuid;record:=req->'record';sid:=record->>'id';expected:=(req->>'expectedRevision')::bigint;
 if rid is null or sid is null or expected is null or expected<0 or expected>9007199254740990
   or record->>'revision' is distinct from expected::text
   or jsonb_typeof(record->'metadata') is distinct from 'object'
   or jsonb_typeof(record->'content') is distinct from 'object'
   then raise exception 'INVALID_SINGLE_SONG_REQUEST'; end if;
 perform pg_advisory_xact_lock(1296649820,hashtext(rid::text));
 select * into receipt from mindex_single_song.receipts where request_id=rid;
 if found then
   if receipt.request is distinct from req then raise exception 'SINGLE_SONG_REQUEST_REUSED'; end if;
   return receipt.result;
 end if;
 perform pg_advisory_xact_lock(1296649821,hashtext(sid));
 select revision into stored from mindex_single_song.records where id=sid for update;
 if (found and stored<>expected) or (not found and expected<>0) then raise exception 'SINGLE_SONG_CONFLICT'; end if;
 result:=record || jsonb_build_object('revision',expected+1);
 insert into mindex_single_song.records(id,revision,payload) values(sid,expected+1,result)
 on conflict(id) do update set revision=excluded.revision,payload=excluded.payload;
 insert into mindex_single_song.receipts values(rid,req,result);
 return result;
end $$;
revoke all on function public.get_single_praise_records_v1(text[]) from public;
revoke all on function public.save_single_praise_record_v1(jsonb) from public;
commit;
