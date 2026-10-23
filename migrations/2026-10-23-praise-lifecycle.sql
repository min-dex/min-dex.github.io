-- Atomic empty-song creation/removal. Existing lyrics and worship are never rewritten.
begin;
create table if not exists public.mindex_praise_operations (
 request_id uuid primary key, request_hash text not null,
 operation text not null check(operation in ('create','delete')),
 song_id uuid not null, created_at timestamptz not null default now()
);
alter table public.mindex_praise_operations enable row level security;
revoke all on public.mindex_praise_operations from public,anon,authenticated;
grant select,insert on public.mindex_praise_operations to anon,authenticated;
drop policy if exists praise_operations_read on public.mindex_praise_operations;
create policy praise_operations_read on public.mindex_praise_operations for select to anon,authenticated using(true);
drop policy if exists praise_operations_insert on public.mindex_praise_operations;
create policy praise_operations_insert on public.mindex_praise_operations for insert to anon,authenticated with check(true);
create or replace function public.create_praise_v1(req jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare sid uuid:=(req->>'songId')::uuid; vid uuid:=(req->>'versionId')::uuid;
 rid uuid:=(req->>'requestId')::uuid; h text:=md5(req::text); receipt public.mindex_praise_operations;
 title_value text:=btrim(req->>'title'); cid uuid; n integer:=1; types text[];
begin
 if sid is null or vid is null or rid is null or coalesce(title_value,'')='' or req->>'protocolVersion' is distinct from '1' then raise exception 'PRAISE_INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(1296649816,1);
 select * into receipt from public.mindex_praise_operations where request_id=rid;
 if found then
  if receipt.operation<>'create' or receipt.request_hash<>h then raise exception 'PRAISE_REQUEST_REUSED'; end if;
  if not exists(select 1 from public.mindex_songs where id=receipt.song_id) then raise exception 'PRAISE_CREATED_THEN_REMOVED'; end if;
  return jsonb_build_object('snapshot',public.get_praise_snapshot_v1(receipt.song_id),'replayed',true);
 end if;
 select coalesce(array_agg(value),'{}') into types from jsonb_array_elements_text(req->'praiseTypes');
 if cardinality(types)=0 or not types <@ array['hymn','ccm','children'] then raise exception 'PRAISE_INVALID_TYPES'; end if;
 if coalesce((req->>'reuseExisting')::boolean,false) then
  select s.id into cid from public.mindex_songs s where lower(btrim(s.title))=lower(title_value)
   and s.praise_types && types order by s.id limit 1;
  if cid is not null then
   insert into public.mindex_praise_operations values(rid,h,'create',cid,now());
   return jsonb_build_object('snapshot',public.get_praise_snapshot_v1(cid),'reused',true);
  end if;
 end if;
 if coalesce((req->>'autoTitle')::boolean,false) then
  while exists(select 1 from public.mindex_songs where title=title_value) loop
   n:=n+1; title_value:='새 찬양 '||n;
  end loop;
 end if;
 -- New empty drafts get their own canonical identity: no merge or mutation of
 -- an existing edition just because a display title happens to match.
 insert into public.mindex_songs(id,title,praise_types,memo) values(sid,title_value,types,'{}');
 insert into public.mindex_canonical_songs(id,title,normalized_title) values(sid,title_value,'draft:'||sid::text);
 insert into public.mindex_song_versions(id,canonical_song_id,source_song_id,version_order,version_label,curated_version_name,raw_section_name,praise_types,lyric_signature,is_primary)
 values(vid,sid,sid,1,'기본','기본','기본',types,'empty:'||vid::text,true);
 insert into public.mindex_praise_operations values(rid,h,'create',sid,now());
 return jsonb_build_object('snapshot',public.get_praise_snapshot_v1(sid),'replayed',false);
end $$;
create or replace function public.delete_empty_praise_v1(req jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare sid uuid:=(req->>'songId')::uuid; rid uuid:=(req->>'requestId')::uuid;
 h text:=md5(req::text); receipt public.mindex_praise_operations; s jsonb; m jsonb;
 f record; used boolean;
begin
 if sid is null or rid is null or req->>'protocolVersion' is distinct from '1' or not req ? 'expected' then raise exception 'PRAISE_INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(1296649816,1);
 select * into receipt from public.mindex_praise_operations where request_id=rid;
 if found then
  if receipt.operation<>'delete' or receipt.request_hash<>h then raise exception 'PRAISE_REQUEST_REUSED'; end if;
  return jsonb_build_object('deleted',true,'replayed',true);
 end if;
 s:=public.get_praise_snapshot_v1(sid);
 if s is distinct from req->'expected' then raise exception 'PRAISE_CONFLICT'; end if;
 if s->'song'='null'::jsonb then raise exception 'PRAISE_NOT_FOUND'; end if;
 -- Be conservative about unknown metadata: absence of visible lyrics is not
 -- proof that a row or media package is disposable.
 if exists(select 1 from jsonb_each((s->'song')-array['id','title','praise_types','memo']) e where e.value not in ('null','""','[]','{}')) then raise exception 'PRAISE_NOT_EMPTY'; end if;
 m:=coalesce(nullif(s->'song'->>'memo',''),'{}')::jsonb;
 m:=m-array['_praiseCommit'];
 if exists(select 1 from jsonb_each(m) e where e.value not in ('null','""','[]','{}')) then raise exception 'PRAISE_NOT_EMPTY'; end if;
 if exists(select 1 from public.mindex_song_versions v where source_song_id=sid and (
  coalesce(to_jsonb(v)->'audio_set','null') not in ('null','{}') or coalesce(subtitle,'')<>'' or coalesce(original_title,'')<>'' or coalesce(hymn_no,'')<>'' or coalesce(deck_key,'')<>'' or source_count>1)) then raise exception 'PRAISE_NOT_EMPTY'; end if;
 if exists(select 1 from public.mindex_version_units u join public.mindex_song_versions v on v.id=u.version_id where v.source_song_id=sid) then raise exception 'PRAISE_NOT_EMPTY'; end if;
 -- Includes legacy/current foreign keys and ON DELETE SET NULL: never sever a
 -- worship or relation link just because that FK would allow the DELETE.
 for f in select c.conrelid::regclass as tbl,a.attname,c.confrelid
  from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid in ('public.mindex_songs'::regclass,'public.mindex_song_versions'::regclass)
  and c.conrelid not in ('public.mindex_song_versions'::regclass,'public.mindex_version_units'::regclass) loop
  if f.confrelid='public.mindex_songs'::regclass then
   execute format('select exists(select 1 from %s where %I=$1)',f.tbl,f.attname) into used using sid;
  else
   execute format('select exists(select 1 from %s where %I in(select id from public.mindex_song_versions where source_song_id=$1))',f.tbl,f.attname) into used using sid;
  end if;
  if used then raise exception 'PRAISE_IN_USE'; end if;
 end loop;
 -- Canonical/source evidence is retained; only the explicitly empty song and
 -- its owned empty versions are removed by their existing FK cascade.
 delete from public.mindex_songs where id=sid;
 insert into public.mindex_praise_operations values(rid,h,'delete',sid,now());
 return jsonb_build_object('deleted',true,'replayed',false);
end $$;
revoke all on function public.create_praise_v1(jsonb),public.delete_empty_praise_v1(jsonb) from public;
grant execute on function public.create_praise_v1(jsonb),public.delete_empty_praise_v1(jsonb) to anon,authenticated;
commit;
