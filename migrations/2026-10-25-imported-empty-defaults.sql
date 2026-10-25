-- Operator-run only. Preserve the existing lifecycle and all reference/CAS guards.
-- Only exact technical defaults and matching import provenance may be ignored.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $patch$
declare src text; def text; old_clause text := $old$    or exists(select from jsonb_each((old->'content') - array['name','raw_section_name','is_primary','praise_types','forms','audio_set','source_count','_worshipVersionPersisted']) p where p.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb,'false'::jsonb))
    or exists(select from jsonb_each((old->'metadata') - array['title','praise_types','_relationalVersionsLoaded','_memoHasVersions']) p where p.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb,'false'::jsonb))
$old$;
new_clause text := $new$    or exists(select from jsonb_each((old->'content') - array['name','raw_section_name','is_primary','praise_types','forms','audio_set','source_count','_worshipVersionPersisted']) p where p.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb,'false'::jsonb) and not coalesce((
      (p.key in ('version_label','curated_version_name') and p.value='"기본"'::jsonb and old->'content'->>'name'='기본')
      or (p.key='version_order' and p.value='1'::jsonb)
      or (p.key='lyric_signature' and p.value='"mindex-0"'::jsonb)
      or (p.key='_audioSetSupported' and p.value='true'::jsonb)
    ),false))
    or exists(select from jsonb_each((old->'metadata') - array['title','praise_types','_relationalVersionsLoaded','_memoHasVersions']) p where p.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb,'false'::jsonb) and not coalesce((
      (p.key='created_at' and jsonb_typeof(p.value)='string' and p.value=old->'provenance'->'source'->'created_at' and old->'legacy'->>'songId'=old->'provenance'->'source'->>'id')
      or (p.key='source_count' and p.value='1'::jsonb and p.value=old->'provenance'->'source'->'source_count')
      or (p.key='normalized_title' and p.value=to_jsonb(regexp_replace(old->'metadata'->>'title','[[:space:]]','','g')) and old->'metadata'->>'title'=old->'provenance'->'source'->>'title')
    ),false))
$new$;
begin
 select prosrc,pg_get_functiondef(oid) into src,def from pg_proc where oid='public.mutate_single_praise_v1(jsonb)'::regprocedure;
 if position(new_clause in src)>0 then return; end if;
 if position(old_clause in src)=0 or length(src)-length(replace(src,old_clause,''))<>length(old_clause) then raise exception 'LIFECYCLE_BODY_CHANGED'; end if;
 -- CREATE OR REPLACE preserves owner, ACL, signature and configuration.
 execute replace(def,old_clause,new_clause);
end $patch$;
notify pgrst,'reload schema';
commit;
