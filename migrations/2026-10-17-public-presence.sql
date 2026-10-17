-- Public read-only presence; legacy operational details remain private.
begin;
create or replace function public.mindex_monitor_presence()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'last_seen', last_seen,
    'status', jsonb_build_object(
      'name', left(coalesce(status->>'name',''),60),
      'os', left(coalesce(status->>'os',''),30),
      'browser', left(coalesce(status->>'browser',''),30),
      'output', coalesce(status->'output' = 'true'::jsonb,false)
    )) order by last_seen desc, id), '[]'::jsonb)
  from (
    select id,last_seen,status from mindex_monitor_private.sessions
    where kind='reporter' and expires_at>now() and status<>'{}'::jsonb
      and last_seen>=now()-interval '45 seconds' and last_seen<=now()+interval '5 seconds'
    order by last_seen desc,id limit 100
  ) active;
$$;
revoke all on function public.mindex_monitor_presence() from public;
grant execute on function public.mindex_monitor_presence() to anon, authenticated;
notify pgrst,'reload schema';
commit;
