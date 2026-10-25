-- Read-only state RPC: avoid PostgREST materializing its large scalar response.
-- No stored rows, function body, signature, owner, ACL or timeout are changed.
-- Apply only after the read-only catalog preflight and isolated PostgreSQL test.
begin;
do $$
declare fn pg_proc;
begin
 select * into strict fn from pg_proc where oid='public.mindex_state_read_v1(text,text)'::regprocedure;
 if md5(fn.prosrc)<>'7b09e3a55d0ef3829a679b02a8faad21' or not fn.prosecdef
    or fn.provolatile not in ('v','s') then
  raise exception 'STATE_READ_DEFINITION_CHANGED';
 end if;
end $$;
alter function public.mindex_state_read_v1(text,text) stable;
notify pgrst,'reload schema';
commit;
