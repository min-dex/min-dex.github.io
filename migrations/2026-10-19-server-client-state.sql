-- Application state only. Never store authentication/configuration secrets here.
-- Private draft namespaces are capability-scoped; tables have no browser grants.
begin;
create schema if not exists mindex_state_private;
revoke all on schema mindex_state_private from public, anon, authenticated;
create table if not exists mindex_state_private.entries (
 owner_hash text not null, scope text not null, key text not null,
 value text, revision bigint not null default 1 check(revision>0),
 request_id uuid not null, request_digest text not null,
 updated_at timestamptz not null default now(),
 primary key(owner_hash,scope,key),
 check(octet_length(value)<=4194304), check(length(key)<=512)
);
alter table mindex_state_private.entries enable row level security;
revoke all on mindex_state_private.entries from public,anon,authenticated;
create or replace function mindex_state_private.owner(token text, scope text)
returns text language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
 if scope='shared' then return 'shared'; end if;
 if token is null or token !~ '^[a-f0-9]{64}$' or scope !~ '^(device|session:[a-f0-9-]{36})$'
 then raise exception 'INVALID_STATE_SCOPE'; end if;
 return encode(extensions.digest(token,'sha256'),'hex');
end $$;
create or replace function public.mindex_state_read_v1(p_token text,p_scope text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare owner_id text;
begin
 owner_id:=mindex_state_private.owner(p_token,p_scope);
 return coalesce((select jsonb_agg(jsonb_build_object('key',e.key,'value',e.value,
 'revision',e.revision::text,'requestId',e.request_id) order by e.key)
 from mindex_state_private.entries e where e.owner_hash=owner_id and e.scope=p_scope),'[]');
end $$;
create or replace function public.mindex_state_write_v1(p_token text,p_scope text,p_key text,
 p_value text,p_revision text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare owner_id text; current_row mindex_state_private.entries; digest text; expected bigint;
begin
 owner_id:=mindex_state_private.owner(p_token,p_scope);
 if p_key is null or p_key !~ '^mindex[.:]' or length(p_key)>512
 or p_key ~* '(supabase|auth|credential|deviceReporter)' or p_key in ('mindex.url','mindex.key')
 or p_request_id is null or p_revision is null or p_revision !~ '^(0|[1-9][0-9]*)$'
 or octet_length(p_value)>4194304 then raise exception 'INVALID_STATE_VALUE'; end if;
 if p_scope='shared' and p_key not in ('mindex.worshipBackgroundRegistry','mindex.theme',
 'mindex.ui.presenterThumbScale','mindex.music.fadeStop') then raise exception 'PRIVATE_STATE_REQUIRED'; end if;
 expected:=p_revision::bigint;
 digest:=encode(extensions.digest(p_revision||':'||coalesce(p_value,'')||case when p_value is null then ':deleted' else ':value' end,'sha256'),'hex');
 -- One owner lock also makes the namespace quota check race-free.
 perform pg_advisory_xact_lock(hashtextextended(owner_id,71));
 select * into current_row from mindex_state_private.entries e
 where e.owner_hash=owner_id and e.scope=p_scope and e.key=p_key for update;
 if found then
  if current_row.request_id=p_request_id then
   if current_row.request_digest<>digest then raise exception 'STATE_REQUEST_REUSED'; end if;
   return jsonb_build_object('key',p_key,'value',current_row.value,'revision',current_row.revision::text,'requestId',p_request_id);
  end if;
  if current_row.revision<>expected then raise exception 'STATE_REVISION_CONFLICT'; end if;
 elsif expected<>0 then raise exception 'STATE_REVISION_CONFLICT'; end if;
 if (select coalesce(sum(octet_length(value)),0) from mindex_state_private.entries where owner_hash=owner_id)
 -coalesce(octet_length(current_row.value),0)+coalesce(octet_length(p_value),0)>33554432
 then raise exception 'STATE_NAMESPACE_FULL'; end if;
 insert into mindex_state_private.entries(owner_hash,scope,key,value,revision,request_id,request_digest)
 values(owner_id,p_scope,p_key,p_value,expected+1,p_request_id,digest)
 on conflict(owner_hash,scope,key) do update set value=excluded.value,revision=excluded.revision,
 request_id=excluded.request_id,request_digest=excluded.request_digest,updated_at=now();
 return jsonb_build_object('key',p_key,'value',p_value,'revision',(expected+1)::text,'requestId',p_request_id);
end $$;
revoke all on function mindex_state_private.owner(text,text) from public,anon,authenticated;
revoke all on function public.mindex_state_read_v1(text,text) from public;
revoke all on function public.mindex_state_write_v1(text,text,text,text,text,uuid) from public;
grant execute on function public.mindex_state_read_v1(text,text) to anon,authenticated;
grant execute on function public.mindex_state_write_v1(text,text,text,text,text,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
