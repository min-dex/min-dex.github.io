-- Multiple administrators per output; the single guest slot remains unchanged.
-- Apply after 2026-10-24-output-codes.sql. No PIN or worship data is changed.
begin;
alter table mindex_remote_private.admin_links drop constraint if exists admin_links_pkey;
alter table mindex_remote_private.admin_links add primary key(output_id,request_id);
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
  'position',left(coalesce(p_info->>'position',''),40),'multiAdmin',p_info->'multiAdmin'='true'::jsonb) where id=p_id;
 delete from mindex_remote_private.admin_links l where l.output_id=p_id and (l.expires_at<=clock_timestamp() or not exists(select 1 from mindex_remote_private.admin_sessions s where s.token_hash=l.admin_hash and s.expires_at>clock_timestamp()));
 update mindex_remote_private.admin_links set ready=true where output_id=p_id and  (request_id=p_ready or (p_info->'adminReady') ? request_id::text);
 delete from mindex_remote_private.guest_links where output_id=p_id and expires_at<=clock_timestamp();
 update mindex_remote_private.guest_links set ready=true,expires_at=clock_timestamp()+interval '8 hours' where output_id=p_id and request_id=(p_info->>'guestReady')::uuid and not ready;
 select * into link from mindex_remote_private.admin_links where output_id=p_id order by request_id limit 1;
 return jsonb_build_object('ok',true,'code',mindex_remote_private.output_code(p_id),'links',(select coalesce(jsonb_agg(jsonb_build_object('id',l.request_id,'secret',l.secret) order by l.request_id),'[]'::jsonb) from mindex_remote_private.admin_links l where l.output_id=p_id),'guest',(select jsonb_build_object('id',g.request_id,'secret',g.secret) from mindex_remote_private.guest_links g where g.output_id=p_id),'link',case when link.output_id is null then null else jsonb_build_object('id',link.request_id,'secret',link.secret) end);
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
  select * into link from mindex_remote_private.admin_links where output_id=p_output and request_id=p_request;
  if found and (link.admin_hash<>ah or link.request_id<>p_request) then return jsonb_build_object('ok',false,'error','busy'); end if;
  if not found then
   -- Older host pages can serve only one admin; do not strand a second request.
   if exists(select 1 from mindex_remote_private.admin_links where output_id=p_output)
      and not exists(select 1 from mindex_remote_private.outputs where id=p_output and info->'multiAdmin'='true'::jsonb) then
    return jsonb_build_object('ok',false,'error','host_upgrade');
   end if;
   insert into mindex_remote_private.admin_links(output_id,admin_hash,request_id,secret,expires_at)
    values(p_output,ah,p_request,encode(extensions.gen_random_bytes(32),'hex'),least(expiry,clock_timestamp()+interval '30 seconds'));
   return jsonb_build_object('ok',true,'ready',false);
  end if;
  if link.ready then
   update mindex_remote_private.admin_links set expires_at=expiry where output_id=p_output and request_id=p_request and admin_hash=ah;
   return jsonb_build_object('ok',true,'ready',true,'secret',link.secret);
  end if;
  return jsonb_build_object('ok',true,'ready',false);
 end if;
 return jsonb_build_object('ok',false,'error','invalid');
end $$;
notify pgrst,'reload schema';
commit;
select exists(select 1 from pg_constraint c
 join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 where n.nspname='mindex_remote_private' and t.relname='admin_links'
 and c.contype='p' and cardinality(c.conkey)=2) as multi_admin_ready;
