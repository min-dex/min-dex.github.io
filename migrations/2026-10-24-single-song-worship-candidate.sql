-- UNAPPLIED: requires single-song-store candidate and reviewed atomic schema.
-- Additive schema only; no existing operational row is migrated here.
begin;
alter table public.mindex_worship_elements add column praise_record_id text
 references mindex_single_song.records(id) on delete restrict;
alter table public.mindex_worship_elements add constraint mindex_single_praise_exclusive
 check(praise_record_id is null or (song_id is null and song_version_id is null));
create index mindex_worship_single_praise_idx on public.mindex_worship_elements(praise_record_id)
 where praise_record_id is not null;
create function mindex_atomic.require_single_song_protocol(req jsonb) returns void
language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
 perform pg_advisory_xact_lock(1296649822,0);
 if req->>'singleSongProtocol'='1' then return; end if;
 if exists(select from public.mindex_worship_elements e join public.mindex_worship_sections s on s.id=e.section_id
   where s.service_id=(req->>'serviceId')::uuid and e.praise_record_id is not null)
   or jsonb_path_exists(req,'$.**.praise_record_id ? (@ != null)')
   or (req ? 'checkpointRevision' and exists(select from mindex_atomic.checkpoints c
     where c.service_id=(req->>'serviceId')::uuid
     and jsonb_path_exists(c.aggregate,'$.elements[*].praise_record_id ? (@ != null)')))
 then raise exception 'SINGLE_SONG_CLIENT_REQUIRED'; end if;
end $$;
revoke all on function mindex_atomic.require_single_song_protocol(jsonb) from public;
grant execute on function mindex_atomic.require_single_song_protocol(jsonb) to mindex_atomic_writer;
-- Preserve all installed ownership checks, permissions, CAS and receipt logic.
-- Unknown installed definitions abort the transaction instead of replacing them.
do $$
declare src text; updated text; name text; at integer; validator regprocedure;
begin
 src:=pg_get_functiondef('mindex_atomic.patch_row(text,uuid,jsonb,jsonb)'::regprocedure);
 if strpos(src,'''song_id'',''song_version_id'',''scripture_id''')=0 then raise exception 'ATOMIC_PATCH_CONTRACT_CHANGED'; end if;
 updated:=replace(src,'''song_id'',''song_version_id'',''scripture_id''','''song_id'',''song_version_id'',''praise_record_id'',''scripture_id''');execute updated;
 foreach name in array array['save_existing','create_service','delete_service','restore_checkpoint'] loop
  src:=pg_get_functiondef(('mindex_atomic.'||name||'(jsonb)')::regprocedure);
  if strpos(src,'''protocolVersion'',''serviceId''')=0 then raise exception 'ATOMIC_REQUEST_CONTRACT_CHANGED:%',name; end if;
  src:=replace(src,'''protocolVersion'',''serviceId''','''singleSongProtocol'',''protocolVersion'',''serviceId''');
  at:=strpos(src,E'\nbegin\n');
  if at=0 then raise exception 'ATOMIC_BODY_CONTRACT_CHANGED:%',name; end if;
  src:=overlay(src placing E'\nbegin\n  perform mindex_atomic.require_single_song_protocol(req);\n' from at for length(E'\nbegin\n'));
  execute src;
 end loop;
 validator:='mindex_atomic.validate_document(uuid,jsonb)'::regprocedure;
 src:=pg_get_functiondef(validator);
 if strpos(src,'PERFORM mindex_atomic.validate_document_before_slot_guard(sid,doc);')>0 then
  validator:='mindex_atomic.validate_document_before_slot_guard(uuid,jsonb)'::regprocedure;
  src:=pg_get_functiondef(validator);
 end if;
 if strpos(src,$needle$linked->>'songId' is distinct from actual_song::text$needle$)=0 then raise exception 'ATOMIC_DOCUMENT_CONTRACT_CHANGED'; end if;
 updated:=replace(src,$needle$linked->>'songId' is distinct from actual_song::text$needle$,
  $replacement$linked->>'songId' is distinct from coalesce((select praise_record_id from public.mindex_worship_elements where id=element_id::uuid),actual_song::text)$replacement$);execute updated;
end $$;
commit;
