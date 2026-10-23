-- Additive candidate. Apply only through the reviewed production migration path.
-- SECURITY INVOKER retains existing table grants/RLS. No service credentials.
begin;
create or replace function public.get_praise_snapshot_v1(sid uuid) returns jsonb
language sql volatile security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object(
  'canonical',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.mindex_canonical_songs c where c.id=sid or c.id in(select canonical_song_id from public.mindex_song_versions where source_song_id=sid)),'[]'),
  'song',(select to_jsonb(s) from public.mindex_songs s where id=sid),
  'versions',coalesce((select jsonb_agg(to_jsonb(v) order by id) from public.mindex_song_versions v where source_song_id=sid),'[]'),
  'units',coalesce((select jsonb_agg(to_jsonb(u) order by u.id) from public.mindex_version_units u join public.mindex_song_versions v on v.id=u.version_id where v.source_song_id=sid),'[]'),
  'relations',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.mindex_song_relations r where (source_song_id=sid or related_song_id=sid) and relation_type='related'),'[]'));
$$;
-- Share the canonical/worship lock order; old direct writers participate too.
create or replace function public.mindex_praise_write_gate() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform pg_advisory_xact_lock(1296649816,1); return null; end $$;
do $$ declare t text; begin
 foreach t in array array['mindex_songs','mindex_song_versions','mindex_version_units','mindex_canonical_songs','mindex_song_relations'] loop
  execute format('drop trigger if exists mindex_praise_write_gate on public.%I',t);
  execute format('create trigger mindex_praise_write_gate before insert or update or delete on public.%I for each statement execute function public.mindex_praise_write_gate()',t);
 end loop;
end $$;
create or replace function public.save_praise_v1(req jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare sid uuid:=(req->>'songId')::uuid; current jsonb; row jsonb; op jsonb;
 table_name text; cols text; vals text; sets text; vid uuid; uid uuid;
 request_hash text:=md5(req::text); marker jsonb; memo_json jsonb; previous_memo jsonb; affected int;
begin
 if sid is null or req->>'requestId' is null or req->>'protocolVersion' is distinct from '1' then raise exception 'PRAISE_INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(1296649816,1);
 current:=public.get_praise_snapshot_v1(sid);
 if current->'song'='null'::jsonb then raise exception 'PRAISE_NOT_FOUND'; end if;
 begin marker:=(current->'song'->>'memo')::jsonb->'_praiseCommit'; exception when others then marker:=null; end;
 if marker->>'id'=req->>'requestId' then
  if marker->>'hash'<>request_hash then raise exception 'PRAISE_REQUEST_REUSED'; end if;
  return jsonb_build_object('snapshot',current,'replayed',true);
 end if;
 if current is distinct from req->'expected' then raise exception 'PRAISE_CONFLICT'; end if;
 -- Only explicit approved removals; never infer a delete from a partial upload.
 for vid in select value::uuid from jsonb_array_elements_text(coalesce(req->'deleteVersionIds','[]')) loop
  if not exists(select 1 from public.mindex_song_versions where id=vid and source_song_id=sid) then raise exception 'PRAISE_FOREIGN_VERSION'; end if;
  if to_regclass('public.mindex_worship_elements') is not null then
   execute 'select count(*) from public.mindex_worship_elements where song_version_id=$1' into affected using vid;
   if affected>0 then raise exception 'PRAISE_VERSION_IN_USE'; end if;
  end if;
 end loop;
 if req ? 'versions' then
  if jsonb_array_length(req->'versions')=0 or not req ? 'units' then raise exception 'PRAISE_INCOMPLETE_PLAN'; end if;
  if exists(select 1 from public.mindex_song_versions v where source_song_id=sid
   and not exists(select 1 from jsonb_array_elements(req->'versions') n where n->>'id'=v.id::text)
   and not exists(select 1 from jsonb_array_elements_text(coalesce(req->'deleteVersionIds','[]')) n where n=v.id::text)) then raise exception 'PRAISE_INCOMPLETE_PLAN'; end if;
  if exists(select 1 from public.mindex_version_units u join public.mindex_song_versions v on v.id=u.version_id where v.source_song_id=sid
   and not exists(select 1 from jsonb_array_elements(req->'units') n where n->>'id'=u.id::text)
   and not exists(select 1 from jsonb_array_elements_text(coalesce(req->'deleteUnitIds','[]')) n where n=u.id::text)
   and not exists(select 1 from jsonb_array_elements_text(coalesce(req->'deleteVersionIds','[]')) n where n=v.id::text)) then raise exception 'PRAISE_INCOMPLETE_PLAN'; end if;
 elsif req ? 'units' then raise exception 'PRAISE_INCOMPLETE_PLAN';
 end if;
 -- Reserve order only inside this transaction; failures roll it back.
 if req ? 'versions' then
  update public.mindex_song_versions set version_order=version_order+1000000 where source_song_id=sid;
 end if;
 if req ? 'units' then
  update public.mindex_version_units u set unit_order=u.unit_order+1000000,curated_order=u.curated_order+1000000
   from public.mindex_song_versions v where v.id=u.version_id and v.source_song_id=sid;
 end if;
 for op in select * from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('table','mindex_canonical_songs','rows',coalesce(req->'canonicalRows','[]')),
  jsonb_build_object('table','mindex_song_versions','rows',coalesce(req->'versions','[]')),
  jsonb_build_object('table','mindex_version_units','rows',coalesce(req->'units','[]')),
  jsonb_build_object('table','mindex_songs','rows',jsonb_build_array((req->'songPatch')||jsonb_build_object('id',sid))))) loop
  table_name:=op->>'table';
  for row in select * from jsonb_array_elements(op->'rows') loop
   if table_name='mindex_canonical_songs' then
    if (row->>'id')::uuid is distinct from sid then raise exception 'PRAISE_CANONICAL_CONFLICT'; end if;
   elsif table_name='mindex_song_versions' then
    if (row->>'source_song_id')::uuid is distinct from sid or exists(select 1 from public.mindex_song_versions where id=(row->>'id')::uuid and source_song_id is distinct from sid) then raise exception 'PRAISE_FOREIGN_VERSION'; end if;
   elsif table_name='mindex_version_units' then
    if not exists(select 1 from public.mindex_song_versions where id=(row->>'version_id')::uuid and source_song_id=sid)
     or exists(select 1 from public.mindex_version_units u join public.mindex_song_versions v on v.id=u.version_id where u.id=(row->>'id')::uuid and v.source_song_id is distinct from sid) then raise exception 'PRAISE_FOREIGN_UNIT'; end if;
   else
    memo_json:=coalesce(nullif(row->>'memo',''),'{}')::jsonb;
    if jsonb_typeof(memo_json)<>'object' then raise exception 'PRAISE_INVALID_MEMO'; end if;
    previous_memo:=coalesce(nullif(current->'song'->>'memo',''),'{}')::jsonb;
    if jsonb_typeof(previous_memo)<>'object' then raise exception 'PRAISE_INVALID_EXISTING_MEMO'; end if;
    memo_json:=(previous_memo-array['versionOutputTitles','scripture','related_song_ids','metadata','versions','_praiseCommit'])||memo_json;
    row:=jsonb_set(row,'{memo}',to_jsonb((memo_json||jsonb_build_object('_praiseCommit',jsonb_build_object('id',req->>'requestId','hash',request_hash)))::text));
   end if;
   select string_agg(format('%I',key),',' order by key),string_agg(format('r.%I',key),',' order by key),
    string_agg(format('%I=excluded.%I',key,key),',' order by key) filter(where key<>'id') into cols,vals,sets from jsonb_object_keys(row) key;
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r on conflict(id) do update set %s',table_name,cols,vals,table_name,sets) using row;
  end loop;
 end loop;
 for uid in select value::uuid from jsonb_array_elements_text(coalesce(req->'deleteUnitIds','[]')) loop
  if not exists(select 1 from public.mindex_version_units u join public.mindex_song_versions v on v.id=u.version_id where u.id=uid and v.source_song_id=sid) then raise exception 'PRAISE_FOREIGN_UNIT'; end if;
  delete from public.mindex_version_units where id=uid;
 end loop;
 for vid in select value::uuid from jsonb_array_elements_text(coalesce(req->'deleteVersionIds','[]')) loop delete from public.mindex_song_versions where id=vid and source_song_id=sid; end loop;
 if req ? 'relatedIds' then
  delete from public.mindex_song_relations where source_song_id=sid and relation_type='related'
   and not (related_song_id::text in(select value from jsonb_array_elements_text(req->'relatedIds')));
  insert into public.mindex_song_relations(source_song_id,related_song_id,relation_type,note)
   select sid,value::uuid,'related','' from jsonb_array_elements_text(req->'relatedIds') where value::uuid<>sid
   on conflict(source_song_id,related_song_id,relation_type) do nothing;
 end if;
 return jsonb_build_object('snapshot',public.get_praise_snapshot_v1(sid),'replayed',false);
end $$;
revoke all on function public.get_praise_snapshot_v1(uuid),public.save_praise_v1(jsonb),public.mindex_praise_write_gate() from public;
grant execute on function public.get_praise_snapshot_v1(uuid),public.save_praise_v1(jsonb),public.mindex_praise_write_gate() to authenticated,anon;
commit;
