-- Ephemeral remote pairing only. Does not read/write worship or media records.
-- Apply as project administrator; no private schema/table is exposed to clients.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists mindex_remote_private;
revoke all on schema mindex_remote_private from public, anon, authenticated;

create table if not exists mindex_remote_private.secret (
  singleton boolean primary key default true check(singleton),
  pepper bytea not null
);
insert into mindex_remote_private.secret(singleton,pepper)
values(true,extensions.gen_random_bytes(32)) on conflict do nothing;
create table if not exists mindex_remote_private.codes (
  code_hash bytea primary key,
  owner_hash bytea not null unique,
  relay_secret text not null check(length(relay_secret)=64),
  expires_at timestamptz not null
);
create table if not exists mindex_remote_private.buckets (
  action text primary key check(action in ('create','claim')),
  started_at timestamptz not null,
  used integer not null check(used>=0)
);
insert into mindex_remote_private.buckets values
 ('create',clock_timestamp(),0),('claim',clock_timestamp(),0) on conflict do nothing;
alter table mindex_remote_private.secret enable row level security;
alter table mindex_remote_private.codes enable row level security;
alter table mindex_remote_private.buckets enable row level security;
revoke all on all tables in schema mindex_remote_private from public,anon,authenticated;

-- A project-wide budget cannot be bypassed by spoofing headers, rotating browser
-- storage, or manufacturing anonymous identities. It deliberately favors safety
-- over availability: unrelated users share this small church's pairing budget.
create or replace function mindex_remote_private.take_budget(p_action text,p_limit integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare b mindex_remote_private.buckets%rowtype; t timestamptz:=clock_timestamp();
begin
  select * into strict b from mindex_remote_private.buckets where action=p_action for update;
  if t>=b.started_at+interval '1 minute' then
    update mindex_remote_private.buckets set started_at=t,used=1 where action=p_action;
    return true;
  end if;
  if b.used>=p_limit then return false; end if;
  update mindex_remote_private.buckets set used=used+1 where action=p_action;
  return true;
end;
$$;
revoke all on function mindex_remote_private.take_budget(text,integer) from public,anon,authenticated;

create or replace function public.mindex_remote_create_code()
returns jsonb language plpgsql security definer set search_path='' as $$
declare pin text; raw bytea; n integer; owner_token text; relay text; hashed bytea; deadline timestamptz;
begin
  if not mindex_remote_private.take_budget('create',5) then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
  delete from mindex_remote_private.codes where expires_at<=clock_timestamp();
  if (select count(*) from mindex_remote_private.codes)>=3 then return jsonb_build_object('ok',false,'error','busy'); end if;
  owner_token:=encode(extensions.gen_random_bytes(32),'hex');
  relay:=encode(extensions.gen_random_bytes(32),'hex');
  deadline:=clock_timestamp()+interval '2 minutes';
  loop
    raw:=extensions.gen_random_bytes(3);
    n:=get_byte(raw,0)*65536+get_byte(raw,1)*256+get_byte(raw,2);
    -- Rejection sampling gives exactly uniform six-digit codes, including zeros.
    if n>=16000000 then continue; end if;
    pin:=lpad((n%1000000)::text,6,'0');
    select extensions.hmac(convert_to(pin,'UTF8'),pepper,'sha256') into hashed from mindex_remote_private.secret where singleton;
    insert into mindex_remote_private.codes values(hashed,extensions.digest(owner_token,'sha256'),relay,deadline) on conflict(code_hash) do nothing;
    exit when found;
  end loop;
  return jsonb_build_object('ok',true,'code',pin,'secret',relay,'owner_token',owner_token,'expires_at',deadline);
end;
$$;

create or replace function public.mindex_remote_claim_code(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hashed bytea; relay text;
begin
  -- Return errors instead of raising: failed attempts MUST commit their budget.
  -- Charge every call before validating or looking up a code (also successful calls).
  if not mindex_remote_private.take_budget('claim',5) then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
  select extensions.hmac(convert_to(p_code,'UTF8'),pepper,'sha256') into hashed from mindex_remote_private.secret where singleton;
  -- DELETE RETURNING is the atomic one-use claim. Concurrent callers cannot win twice.
  delete from mindex_remote_private.codes where code_hash=hashed and expires_at>clock_timestamp() returning relay_secret into relay;
  if relay is null then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
  return jsonb_build_object('ok',true,'secret',relay);
end;
$$;

create or replace function public.mindex_remote_revoke_code(p_owner_token text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_owner_token is null or p_owner_token !~ '^[0-9a-f]{64}$' then return false; end if;
  delete from mindex_remote_private.codes where owner_hash=extensions.digest(p_owner_token,'sha256');
  return true;
end;
$$;
revoke all on function public.mindex_remote_create_code() from public;
revoke all on function public.mindex_remote_claim_code(text) from public;
revoke all on function public.mindex_remote_revoke_code(text) from public;
grant execute on function public.mindex_remote_create_code() to anon,authenticated;
grant execute on function public.mindex_remote_claim_code(text) to anon,authenticated;
grant execute on function public.mindex_remote_revoke_code(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
