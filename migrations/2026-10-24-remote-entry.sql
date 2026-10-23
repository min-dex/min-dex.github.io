-- Common Remote entry: server distinguishes administrator PIN from output code.
-- Apply after 2026-10-24-multi-admin.sql. Contains no configured PIN value.
begin;
create table if not exists mindex_remote_private.entry_budget(
 singleton boolean primary key default true check(singleton),
 started_at timestamptz not null default clock_timestamp(),used integer not null default 0
);
insert into mindex_remote_private.entry_budget(singleton) values(true) on conflict do nothing;
alter table mindex_remote_private.entry_budget enable row level security;
revoke all on mindex_remote_private.entry_budget from public,anon,authenticated;
create or replace function public.mindex_remote_entry(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b mindex_remote_private.entry_budget; p mindex_remote_private.admin_pin; result jsonb;
begin
 select * into b from mindex_remote_private.entry_budget where singleton for update;
 if b.started_at<=clock_timestamp()-interval '1 minute' then
  update mindex_remote_private.entry_budget set started_at=clock_timestamp(),used=1 where singleton;
 elsif b.used>=5 then
  return jsonb_build_object('ok',false,'error','rate_limited');
 else
  update mindex_remote_private.entry_budget set used=used+1 where singleton;
 end if;
 if p_code is null or p_code !~ '^[0-9]{4}$' then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 select * into p from mindex_remote_private.admin_pin where singleton;
 if found and extensions.crypt(p_code,p.hash)=p.hash then
  result:=public.mindex_remote_admin_login(p_code);
  return result||jsonb_build_object('kind','admin');
 end if;
 return jsonb_build_object('ok',true,'kind','guest');
end $$;
revoke all on function public.mindex_remote_entry(text) from public;
grant execute on function public.mindex_remote_entry(text) to anon,authenticated;
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
   if exists(select 1 from mindex_remote_private.admin_pin where singleton and extensions.crypt(code_value,hash)=hash) then continue; end if;
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

-- Retire a pre-existing output code only if it equals the configured administrator PIN.
do $$ declare r record; begin
 for r in select o.id from mindex_remote_private.outputs o join mindex_remote_private.admin_pin p on p.singleton
 where o.code is not null and extensions.crypt(o.code,p.hash)=p.hash loop
  update mindex_remote_private.outputs set code=null where id=r.id;
  perform mindex_remote_private.output_code(r.id);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.mindex_remote_entry(text)') is not null as remote_entry_ready;
