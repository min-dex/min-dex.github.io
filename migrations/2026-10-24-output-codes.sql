-- Four-digit per-output codes. No operational worship/Praise rows are modified.
-- Apply after 2026-10-24-remote-admin.sql. Existing administrator PIN is preserved.
begin;
alter table mindex_remote_private.outputs add column if not exists code text unique;
create table if not exists mindex_remote_private.output_codes (
 code text primary key check(code ~ '^[0-9]{4}$'), reserved_until timestamptz not null
);
create table if not exists mindex_remote_private.guest_links (
 output_id uuid primary key references mindex_remote_private.outputs on delete cascade,
 owner_hash bytea not null unique, request_id uuid not null, secret text not null,
 ready boolean not null default false, expires_at timestamptz not null
);
alter table mindex_remote_private.output_codes enable row level security;
alter table mindex_remote_private.guest_links enable row level security;
revoke all on mindex_remote_private.output_codes,mindex_remote_private.guest_links from public,anon,authenticated;
create or replace function mindex_remote_private.output_code(p_output uuid)
returns text language plpgsql security definer set search_path='' as $$
declare code_value text; raw bytea; n integer; tries integer:=0;
begin
 perform pg_advisory_xact_lock(1296649816,25);
 select code into code_value from mindex_remote_private.outputs where id=p_output;
 if code_value is null then
  delete from mindex_remote_private.output_codes where reserved_until<clock_timestamp();
  loop
   tries:=tries+1;if tries>50000 then raise exception 'code capacity exhausted'; end if;
   raw:=extensions.gen_random_bytes(2);n:=get_byte(raw,0)*256+get_byte(raw,1);
   if n>=60000 then continue; end if;
   code_value:=lpad((n%10000)::text,4,'0');
   insert into mindex_remote_private.output_codes values(code_value,clock_timestamp()+interval '24 hours') on conflict do nothing;
   exit when found;
  end loop;
  update mindex_remote_private.outputs set code=code_value where id=p_output;
 else
  update mindex_remote_private.output_codes set reserved_until=clock_timestamp()+interval '24 hours' where code=code_value;
 end if;
 return code_value;
end $$;
revoke all on function mindex_remote_private.output_code(uuid) from public,anon,authenticated;
create or replace function public.mindex_remote_output(p_action text,p_id uuid default null,p_token text default null,p_info jsonb default '{}',p_ready uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; oid uuid; link mindex_remote_private.admin_links;
begin
 if p_action='register' then
  perform pg_advisory_xact_lock(1296649816,24);
  delete from mindex_remote_private.outputs where seen_at<clock_timestamp()-interval '24 hours';
  if (select count(*) from mindex_remote_private.outputs)>=200 or (select count(*) from mindex_remote_private.outputs where seen_at>clock_timestamp()-interval '30 seconds')>=20 then return jsonb_build_object('ok',false,'error','busy'); end if;
  oid:=gen_random_uuid();token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into mindex_remote_private.outputs(id,owner_hash) values(oid,extensions.digest(token,'sha256'));
  return jsonb_build_object('ok',true,'id',oid,'token',token,'code',mindex_remote_private.output_code(oid));
 end if;
 -- Lock one host row before mutating its invitation. Requests for other PCs are independent.
 perform 1 from mindex_remote_private.outputs where id=p_id and owner_hash=extensions.digest(p_token,'sha256') and seen_at>clock_timestamp()-interval '24 hours' for update;
 if not found then return jsonb_build_object('ok',false,'error','expired'); end if;
 if p_action='remove' then
  delete from mindex_remote_private.outputs where id=p_id;return jsonb_build_object('ok',true);
 end if;
 if p_action='unlink_guest' then
  delete from mindex_remote_private.guest_links where output_id=p_id and request_id=p_ready;return jsonb_build_object('ok',true);
 end if;
 if p_action='unlink' then
  delete from mindex_remote_private.admin_links where output_id=p_id and request_id=p_ready;return jsonb_build_object('ok',true);
 end if;
 if p_action<>'tick' then return jsonb_build_object('ok',false,'error','invalid'); end if;
 update mindex_remote_private.outputs set seen_at=clock_timestamp(),info=jsonb_build_object(
  'title',left(coalesce(p_info->>'title','예배'),120),'device',left(coalesce(p_info->>'device','송출 PC'),80),
  'position',left(coalesce(p_info->>'position',''),40)) where id=p_id;
 delete from mindex_remote_private.admin_links l where l.output_id=p_id and (l.expires_at<=clock_timestamp() or not exists(select 1 from mindex_remote_private.admin_sessions s where s.token_hash=l.admin_hash and s.expires_at>clock_timestamp()));
 update mindex_remote_private.admin_links set ready=true where output_id=p_id and request_id=p_ready;
 delete from mindex_remote_private.guest_links where output_id=p_id and expires_at<=clock_timestamp();
 update mindex_remote_private.guest_links set ready=true,expires_at=clock_timestamp()+interval '8 hours' where output_id=p_id and request_id=(p_info->>'guestReady')::uuid and not ready;
 select * into link from mindex_remote_private.admin_links where output_id=p_id;
 return jsonb_build_object('ok',true,'code',mindex_remote_private.output_code(p_id),'guest',(select jsonb_build_object('id',g.request_id,'secret',g.secret) from mindex_remote_private.guest_links g where g.output_id=p_id),'link',case when link.output_id is null then null else jsonb_build_object('id',link.request_id,'secret',link.secret) end);
end $$;


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
  select id into oid from mindex_remote_private.outputs where code=p_code and seen_at>clock_timestamp()-interval '10 seconds';
 end if;
 if oid is null then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
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
create or replace function public.mindex_remote_admin(p_action text,p_token text,p_output uuid default null,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ah bytea:=extensions.digest(p_token,'sha256'); expiry timestamptz; link mindex_remote_private.admin_links; items jsonb;
begin
 select expires_at into expiry from mindex_remote_private.admin_sessions where token_hash=ah and expires_at>clock_timestamp() for update;
 if not found then return jsonb_build_object('ok',false,'error','expired'); end if;
 if p_action='logout' then
  delete from mindex_remote_private.admin_sessions where token_hash=ah;return jsonb_build_object('ok',true);
 elsif p_action='list' then
  select coalesce(jsonb_agg(info||jsonb_build_object('id',id,'code',code) order by seen_at desc),'[]') into items
   from mindex_remote_private.outputs where seen_at>clock_timestamp()-interval '10 seconds';
  return jsonb_build_object('ok',true,'outputs',items);
 elsif p_action='disconnect' then
  delete from mindex_remote_private.admin_links where output_id=p_output and admin_hash=ah and request_id=p_request;
  return jsonb_build_object('ok',true);
 elsif p_action='connect' and p_request is not null then
  perform 1 from mindex_remote_private.outputs where id=p_output and seen_at>clock_timestamp()-interval '10 seconds' for update;
  if not found then return jsonb_build_object('ok',false,'error','offline'); end if;
  delete from mindex_remote_private.admin_links where output_id=p_output and expires_at<=clock_timestamp();
  select * into link from mindex_remote_private.admin_links where output_id=p_output;
  if found and (link.admin_hash<>ah or link.request_id<>p_request) then return jsonb_build_object('ok',false,'error','busy'); end if;
  if not found then
   insert into mindex_remote_private.admin_links(output_id,admin_hash,request_id,secret,expires_at)
    values(p_output,ah,p_request,encode(extensions.gen_random_bytes(32),'hex'),least(expiry,clock_timestamp()+interval '30 seconds'));
   return jsonb_build_object('ok',true,'ready',false);
  end if;
  if link.ready then
   update mindex_remote_private.admin_links set expires_at=expiry where output_id=p_output;
   return jsonb_build_object('ok',true,'ready',true,'secret',link.secret);
  end if;
  return jsonb_build_object('ok',true,'ready',false);
 end if;
 return jsonb_build_object('ok',false,'error','invalid');
end $$;
notify pgrst,'reload schema';
commit;

select to_regprocedure('public.mindex_remote_guest(text,text,text,uuid)') is not null
  and exists(select 1 from information_schema.columns where table_schema='mindex_remote_private' and table_name='outputs' and column_name='code') as output_code_ready;
