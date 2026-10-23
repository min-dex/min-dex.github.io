-- PIN material is provisioned separately. Never embed it in this migration.
begin;
create schema if not exists mindex_remote_private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists mindex_remote_private.admin_pin (
 singleton boolean primary key default true check(singleton), hash text not null,
 failures integer not null default 0, locked_until timestamptz
);
create table if not exists mindex_remote_private.admin_sessions (
 token_hash bytea primary key, expires_at timestamptz not null
);
create table if not exists mindex_remote_private.outputs (
 id uuid primary key, owner_hash bytea not null, info jsonb not null default '{}',
 seen_at timestamptz not null default clock_timestamp()
);
create table if not exists mindex_remote_private.admin_links (
 output_id uuid primary key references mindex_remote_private.outputs on delete cascade,
 admin_hash bytea not null references mindex_remote_private.admin_sessions on delete cascade,
 request_id uuid not null, secret text not null, ready boolean not null default false,
 expires_at timestamptz not null
);
revoke all on schema mindex_remote_private from public, anon, authenticated;
revoke all on all tables in schema mindex_remote_private from public, anon, authenticated;
alter table mindex_remote_private.admin_pin enable row level security;
alter table mindex_remote_private.admin_sessions enable row level security;
alter table mindex_remote_private.outputs enable row level security;
alter table mindex_remote_private.admin_links enable row level security;

create or replace function public.mindex_remote_admin_login(p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p mindex_remote_private.admin_pin; token text;
begin
 select * into p from mindex_remote_private.admin_pin where singleton for update;
 if not found then return jsonb_build_object('ok',false,'error','unavailable'); end if;
 if p.locked_until>clock_timestamp() then return jsonb_build_object('ok',false,'error','locked'); end if;
 if p.locked_until is not null then p.failures:=0; end if;
 if p_pin is null or length(p_pin)>32 or extensions.crypt(p_pin,p.hash)<>p.hash then
  update mindex_remote_private.admin_pin set failures=p.failures+1,
   locked_until=case when p.failures+1>=5 then clock_timestamp()+interval '15 minutes' else null end where singleton;
  return jsonb_build_object('ok',false,'error','invalid_pin');
 end if;
 update mindex_remote_private.admin_pin set failures=0,locked_until=null where singleton;
 delete from mindex_remote_private.admin_sessions where expires_at<=clock_timestamp();
 if (select count(*) from mindex_remote_private.admin_sessions)>=20 then return jsonb_build_object('ok',false,'error','busy'); end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into mindex_remote_private.admin_sessions values(extensions.digest(token,'sha256'),clock_timestamp()+interval '8 hours');
 return jsonb_build_object('ok',true,'token',token);
end $$;

create or replace function public.mindex_remote_output(p_action text,p_id uuid default null,p_token text default null,p_info jsonb default '{}',p_ready uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; oid uuid; link mindex_remote_private.admin_links;
begin
 if p_action='register' then
  perform pg_advisory_xact_lock(1296649816,24);
  delete from mindex_remote_private.outputs where seen_at<clock_timestamp()-interval '30 seconds';
  if (select count(*) from mindex_remote_private.outputs)>=20 then return jsonb_build_object('ok',false,'error','busy'); end if;
  oid:=gen_random_uuid();token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into mindex_remote_private.outputs(id,owner_hash) values(oid,extensions.digest(token,'sha256'));
  return jsonb_build_object('ok',true,'id',oid,'token',token);
 end if;
 -- Lock one host row before mutating its invitation. Requests for other PCs are independent.
 perform 1 from mindex_remote_private.outputs where id=p_id and owner_hash=extensions.digest(p_token,'sha256') and seen_at>clock_timestamp()-interval '30 seconds' for update;
 if not found then return jsonb_build_object('ok',false,'error','expired'); end if;
 if p_action='remove' then
  delete from mindex_remote_private.outputs where id=p_id;return jsonb_build_object('ok',true);
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
 select * into link from mindex_remote_private.admin_links where output_id=p_id;
 return jsonb_build_object('ok',true,'link',case when link.output_id is null then null else jsonb_build_object('id',link.request_id,'secret',link.secret) end);
end $$;

create or replace function public.mindex_remote_admin(p_action text,p_token text,p_output uuid default null,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ah bytea:=extensions.digest(p_token,'sha256'); expiry timestamptz; link mindex_remote_private.admin_links; items jsonb;
begin
 select expires_at into expiry from mindex_remote_private.admin_sessions where token_hash=ah and expires_at>clock_timestamp() for update;
 if not found then return jsonb_build_object('ok',false,'error','expired'); end if;
 if p_action='logout' then
  delete from mindex_remote_private.admin_sessions where token_hash=ah;return jsonb_build_object('ok',true);
 elsif p_action='list' then
  select coalesce(jsonb_agg(info||jsonb_build_object('id',id) order by seen_at desc),'[]') into items
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
revoke all on function public.mindex_remote_admin_login(text), public.mindex_remote_output(text,uuid,text,jsonb,uuid), public.mindex_remote_admin(text,text,uuid,uuid) from public;
grant execute on function public.mindex_remote_admin_login(text), public.mindex_remote_output(text,uuid,text,jsonb,uuid), public.mindex_remote_admin(text,text,uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
