-- Reuse the private alias cache already maintained in the song transaction.
-- This changes one function body and requires an exact recognized baseline.
begin;
set local lock_timeout = '2s';
do $patch$
declare
  target regprocedure := 'mindex_atomic.require_current_praise_ids(jsonb)'::regprocedure;
  definition text;
  body text;
  original text := $old$begin
 if jsonb_typeof(req) is distinct from 'object' or octet_length(req::text)>4194304 then
  raise exception 'INVALID_REQUEST';
 end if;
 -- Only returns acceptance/rejection; never exposes catalogue payloads or maps.
 if exists(select from mindex_single_song.records r
   cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a
   where strpos(req::text,a)>0) then
  raise exception 'PRAISE_ID_CHANGED_RELOAD_REQUIRED';
 end if;
end$old$;
  replacement text := $new$declare
  request_text text := req::text;
begin
 if jsonb_typeof(req) is distinct from 'object' or octet_length(request_text)>4194304 then
  raise exception 'INVALID_REQUEST';
 end if;
 -- Preserve substring checks anywhere in the request, including nested text.
 if exists(select from mindex_single_song.state_id_alias_cache c
   where strpos(request_text,c.alias)>0) then
  raise exception 'PRAISE_ID_CHANGED_RELOAD_REQUIRED';
 end if;
end$new$;
begin
  select pg_get_functiondef(p.oid), btrim(p.prosrc, E' \t\r\n') into definition, body from pg_proc p
    where p.oid=target and p.prosecdef and pg_get_userbyid(p.proowner)='postgres';
  if definition is null
    or not exists(select from pg_trigger
      where tgrelid='mindex_single_song.records'::regclass
        and tgname='sync_state_id_alias_cache'
        and tgfoid='mindex_single_song.sync_state_id_alias_cache()'::regprocedure
        and tgenabled in ('O','A'))
    or not has_table_privilege('postgres','mindex_single_song.state_id_alias_cache','SELECT')
    or has_function_privilege('anon',target,'EXECUTE')
    or has_function_privilege('authenticated',target,'EXECUTE')
    or not has_function_privilege('mindex_atomic_writer',target,'EXECUTE') then
    raise exception 'WORSHIP_PRAISE_GUARD_CONTRACT_CHANGED';
  end if;
  if body=replacement then return; end if;
  if body is distinct from original then
    raise exception 'WORSHIP_PRAISE_GUARD_BODY_CHANGED';
  end if;
  execute replace(definition,original,replacement);
end
$patch$;
commit;
