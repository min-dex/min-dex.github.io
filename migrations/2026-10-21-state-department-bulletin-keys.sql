-- Preserve rows, permissions, quotas and request identities; amend known guard only.
begin;
do $migration$
declare
 definition text := pg_get_functiondef('public.mindex_state_write_v1(text,text,text,text,text,uuid)'::regprocedure);
 old_guard text := $old$regexp_replace(p_key,
 '^((?:mindex\.atomic\.pending\.v2:\["|mindex\.atomic\.creation\.v1:))https://[a-z0-9]+\.supabase\.co(?=["/:])',
 '\1PROJECT') ~* '(supabase|auth|credential|deviceReporter)'$old$;
 new_guard text := $new$regexp_replace(p_key,
 '^((?:mindex\.atomic\.pending\.v2:\["|mindex\.atomic\.creation\.v1:|mindex\.department\.pending\.v1:\["|mindex\.bulletin\.(?:v1|template):))https://[a-z0-9]+\.supabase\.co(?=["/:])',
 '\1PROJECT') ~* '(supabase|auth|credential|deviceReporter)'$new$;
begin
 if position(old_guard in definition)>0 then
  execute replace(definition,old_guard,new_guard);
 elsif position(new_guard in definition)=0 then
  raise exception 'STATE_GUARD_DEFINITION_CHANGED';
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
