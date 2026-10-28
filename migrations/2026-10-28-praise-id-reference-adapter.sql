-- Candidate only. Pure transformer; no catalogue, worship or state writes.
-- Used by an administrator-reviewed rekey transaction / historical restore adapter.
begin;
create or replace function mindex_single_song.rewrite_id_references(doc jsonb, mapping jsonb, field text default '')
returns jsonb language plpgsql immutable set search_path=pg_catalog as $body$
declare result jsonb; child jsonb; pair record; raw text; updated text; decoded jsonb;
  old_id text; new_id text; expected jsonb;
begin
 if jsonb_typeof(mapping) is distinct from 'object' then raise exception 'INVALID_REKEY_MAP'; end if;
 if exists(select from jsonb_each(mapping) e where e.key !~ '^SONG-(CONT|CHLD)-[0-9]{4}-[0-9]{4}$'
  or jsonb_typeof(e.value)<>'string' or (e.value#>>'{}') !~ '^SONG-(CONT|CHLD)-[0-9]{4}-[0-9]{4}$'
  or mapping ? (e.value#>>'{}'))
  or (select count(*) from jsonb_each(mapping))<>(select count(distinct value) from jsonb_each(mapping)) then
  raise exception 'INVALID_REKEY_MAP';
 end if;
 if field='previousIds' then return doc; end if;
 if jsonb_typeof(doc)='object' then
  result:='{}';
  for pair in select key,value from jsonb_each(doc) loop
   if mapping ? pair.key then raise exception 'REKEY_OBJECT_KEY_REQUIRES_ADAPTER'; end if;
   result:=result||jsonb_build_object(pair.key,mindex_single_song.rewrite_id_references(pair.value,mapping,pair.key));
  end loop;
  return result;
 elsif jsonb_typeof(doc)='array' then
  result:='[]';
  for child in select value from jsonb_array_elements(doc) loop
   result:=result||jsonb_build_array(mindex_single_song.rewrite_id_references(child,mapping,field));
  end loop;
  return result;
 elsif jsonb_typeof(doc)<>'string' then return doc;
 end if;
 raw:=doc#>>'{}'; updated:=raw;
 if not exists(select from jsonb_object_keys(mapping) k where strpos(raw,k)>0) then return doc; end if;
 if mapping ? raw and field=any(array['id','song_id','songId','praise_record_id','version_id','versionId','song_version_id','songVersionId','selectedSongId','selectedVersionId','retiredInto','same_song','related']) then
  return mapping->raw;
 end if;
 if field='sourceText' then
  for pair in select key,value#>>'{}' as target from jsonb_each(mapping) loop
   updated:=regexp_replace(updated,'(^|\n)([ \t]*-[ \t]*곡 ID:[ \t]*)'||pair.key||'([ \t]*\r?)(?=\n|$)',E'\\1\\2'||pair.target||E'\\3','g');
  end loop;
 elsif field='key' and raw ~ '^(praise:SONG-(CONT|CHLD)-[0-9]{4}-[0-9]{4}|mindex\.editor\.draft\.v2:praise:SONG-(CONT|CHLD)-[0-9]{4}-[0-9]{4}:[0-9a-f-]{36})$' then
  for pair in select key,value#>>'{}' as target from jsonb_each(mapping) loop
   updated:=replace(updated,':'||pair.key,':'||pair.target);
  end loop;
 elsif field=any(array['base','value']) then
  begin decoded:=raw::jsonb;
  exception when invalid_text_representation then raise exception 'REKEY_SERIALIZED_VALUE_INVALID'; end;
  if jsonb_typeof(decoded) not in ('object','array') then raise exception 'REKEY_SERIALIZED_VALUE_INVALID'; end if;
  expected:=mindex_single_song.rewrite_id_references(decoded,mapping,'');
  for pair in select key,value#>>'{}' as target from jsonb_each(mapping) loop
   updated:=replace(updated,pair.key,pair.target);
  end loop;
  -- Keep exact original serialization; do not rewrite escaped user text/whitespace.
  if updated::jsonb is distinct from expected then raise exception 'REKEY_SERIALIZATION_MISMATCH'; end if;
 else raise exception 'REKEY_UNKNOWN_REFERENCE_FIELD:%',field;
 end if;
 if exists(select from jsonb_object_keys(mapping) k where strpos(updated,k)>0) then raise exception 'REKEY_UNRESOLVED_REFERENCE:%',field; end if;
 return to_jsonb(updated);
end
$body$;
revoke all on function mindex_single_song.rewrite_id_references(jsonb,jsonb,text) from public;
commit;
