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
      and last_seen>=now()-interval '180 seconds' and last_seen<=now()+interval '5 seconds'
    order by last_seen desc,id limit 100
  ) active;
$$;
revoke all on function public.mindex_monitor_presence() from public;
grant execute on function public.mindex_monitor_presence() to anon, authenticated;
create or replace function public.mindex_monitor_ping(p_token text, p_status jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare sid uuid; prior jsonb; seen timestamptz; clean jsonb;
begin
  if p_token is null or length(p_token)<>64 or p_status is null or jsonb_typeof(p_status)<>'object' or octet_length(p_status::text)>2000 then return false; end if;
  select id,status,last_seen into sid,prior,seen from mindex_monitor_private.sessions
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and kind='reporter' and expires_at>now() for update;
  if sid is null then return false; end if;
  clean:=jsonb_build_object('name',left(coalesce(p_status->>'name',''),60),'os',left(coalesce(p_status->>'os',''),30),'browser',left(coalesce(p_status->>'browser',''),30),'output',coalesce(p_status->'output'='true'::jsonb,false));
  if prior=clean and seen>now()-interval '10 seconds' then return true; end if;
  update mindex_monitor_private.sessions set status=clean,last_seen=now() where id=sid;
  return true;
end;
$$;
revoke all on function public.mindex_monitor_ping(text,jsonb) from public;
grant execute on function public.mindex_monitor_ping(text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
