-- Apply after remote-entry/multi-admin. No worship rows or configured PIN are changed.
begin;
do $$ begin
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.mindex_remote_guest(text,text,text,uuid)') and md5(prosrc) in ('de3f0162491746504dad4e56ad8db99f','97b39dad4789d7c91e329d3562a734d8')) then
  raise exception 'Remote guest definition changed; review before applying';
 end if;
end $$;
-- Explicit projection: no code, relay secret, owner token or slide content is public.
create or replace function public.mindex_remote_outputs()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ok',true,'outputs',coalesce(jsonb_agg(jsonb_build_object(
  'id',o.id,'title',left(coalesce(nullif(o.info->>'title',''),'예배'),120),
  'device',left(coalesce(o.info->>'device',''),80)) order by o.seen_at desc,o.id),'[]'::jsonb))
 from (select id,info,seen_at from mindex_remote_private.outputs
       where seen_at>now()-interval '10 seconds' and info ? 'title'
       order by seen_at desc,id limit 200) o;
$$;
revoke all on function public.mindex_remote_outputs() from public;
grant execute on function public.mindex_remote_outputs() to anon,authenticated;

create or replace function public.mindex_remote_guest(p_action text,p_token text,p_code text default null,p_output uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hashed bytea:=extensions.digest(p_token,'sha256'); oid uuid; link mindex_remote_private.guest_links;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 if p_action='disconnect' then
  delete from mindex_remote_private.guest_links where owner_hash=hashed and (p_output is null or output_id=p_output);
  return jsonb_build_object('ok',true);
 end if;
 if p_action<>'connect' then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 -- Retrying the same high-entropy request does not consume another code attempt.
 select output_id into oid from mindex_remote_private.guest_links where owner_hash=hashed and expires_at>clock_timestamp();
 if oid is null then
  if not mindex_remote_private.take_budget('claim',5) then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
  if p_code is null or p_code !~ '^[0-9]{4}$' then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
  select id into oid from mindex_remote_private.outputs where code=p_code and (p_output is null or id=p_output) and seen_at>clock_timestamp()-interval '10 seconds';
 end if;
 if oid is null or (p_output is not null and oid<>p_output) then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 perform 1 from mindex_remote_private.outputs where id=oid and seen_at>clock_timestamp()-interval '10 seconds' for update;
 if not found then return jsonb_build_object('ok',false,'error','offline'); end if;
 delete from mindex_remote_private.guest_links where output_id=oid and expires_at<=clock_timestamp();
 select * into link from mindex_remote_private.guest_links where output_id=oid;
 if found and link.owner_hash<>hashed then return jsonb_build_object('ok',false,'error','busy'); end if;
 if not found then
  insert into mindex_remote_private.guest_links values(oid,hashed,gen_random_uuid(),encode(extensions.gen_random_bytes(32),'hex'),false,clock_timestamp()+interval '30 seconds') returning * into link;
 end if;
 if link.ready then
  return jsonb_build_object('ok',true,'output',oid,'ready',true,'secret',link.secret);
 end if;
 return jsonb_build_object('ok',true,'output',oid,'ready',false);
end $$;
revoke all on function public.mindex_remote_guest(text,text,text,uuid) from public;
grant execute on function public.mindex_remote_guest(text,text,text,uuid) to anon,authenticated;

notify pgrst,'reload schema';
commit;
select to_regprocedure('public.mindex_remote_outputs()') is not null as remote_directory_ready;
