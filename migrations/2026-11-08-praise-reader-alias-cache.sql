-- Resolve current and previous IDs without detoasting every song payload.
-- No song/worship rows or privileges are changed.
begin;
set local lock_timeout='2s';
do $patch$
declare
 target regprocedure := 'public.get_single_praise_records_v1(text[])'::regprocedure;
 definition text; body text;
 old_filter text := 'where id=any(ids) or coalesce(payload->''previousIds'',''[]''::jsonb) ?| ids';
 new_filter text := 'where id in (select unnest(ids) union select record_id from mindex_single_song.state_id_alias_cache where alias=any(ids))';
begin
 select pg_get_functiondef(oid),prosrc into definition,body from pg_proc
 where oid=target and prosecdef and pg_get_userbyid(proowner)='mindex_single_writer';
 if definition is null or not has_table_privilege('mindex_single_writer','mindex_single_song.state_id_alias_cache','SELECT')
 or not exists(select from pg_trigger where tgrelid='mindex_single_song.records'::regclass and tgname='sync_state_id_alias_cache'
 and tgfoid='mindex_single_song.sync_state_id_alias_cache()'::regprocedure and tgenabled in ('O','A')) then
 raise exception 'PRAISE_READER_CACHE_CONTRACT_CHANGED'; end if;
 if exists(
  (select r.id,a from mindex_single_song.records r cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a
   except select record_id,alias from mindex_single_song.state_id_alias_cache)
  union all
  (select record_id,alias from mindex_single_song.state_id_alias_cache except
   select r.id,a from mindex_single_song.records r cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a)
 ) then raise exception 'PRAISE_READER_ALIAS_CACHE_DRIFT'; end if;
 if strpos(body,new_filter)>0 then return; end if;
 if btrim(body, E' \t\r\n') <> 'select coalesce(jsonb_agg(payload || jsonb_build_object(''revision'',revision) order by id),''[]''::jsonb)'||E'\n from mindex_single_song.records '||old_filter||';' then
 raise exception 'PRAISE_READER_BODY_CHANGED'; end if;
 execute replace(definition,old_filter,new_filter);
end $patch$;
commit;
