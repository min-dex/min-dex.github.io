-- Additive recovery journal. No client changes, public grants, or history pruning.
-- Apply only after operator catalog/size preflight and a verified DB backup.
begin;
set local lock_timeout = '5s';

create table mindex_atomic.revision_history (
  service_id uuid not null,
  revision bigint not null check (revision >= 0),
  captured_at timestamptz not null default clock_timestamp(),
  aggregate jsonb not null check (jsonb_typeof(aggregate) = 'object'),
  primary key (service_id, revision)
);
revoke all on mindex_atomic.revision_history from public, anon, authenticated, mindex_atomic_writer;

create function mindex_atomic.remember_revision(snapshot jsonb) returns void
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare sid uuid; rev bigint; existing jsonb;
begin
  if snapshot is null then return; end if;
  sid := (snapshot->'service'->>'id')::uuid;
  rev := (snapshot->>'revision')::bigint;
  if sid is null or rev is null then raise exception 'INVALID_HISTORY_SNAPSHOT'; end if;
  insert into mindex_atomic.revision_history(service_id,revision,aggregate)
    values(sid,rev,snapshot) on conflict do nothing;
  select aggregate into existing from mindex_atomic.revision_history
    where service_id=sid and revision=rev;
  if existing is distinct from snapshot then raise exception 'HISTORY_REVISION_MISMATCH'; end if;
end
$$;
revoke all on function mindex_atomic.remember_revision(jsonb) from public, anon, authenticated, mindex_atomic_writer;

create function mindex_atomic.journal_checkpoint() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if tg_op='UPDATE' then perform mindex_atomic.remember_revision(old.aggregate); end if;
  perform mindex_atomic.remember_revision(new.aggregate);
  return new;
end
$$;
create function mindex_atomic.journal_receipt() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  perform mindex_atomic.remember_revision(mindex_atomic.read_service(new.service_id));
  return new;
end
$$;
revoke all on function mindex_atomic.journal_checkpoint(), mindex_atomic.journal_receipt()
  from public, anon, authenticated, mindex_atomic_writer;

-- Freeze writers while seeding the existing checkpoint and current committed state.
lock table public.mindex_worship_services, public.mindex_worship_sections,
  public.mindex_worship_elements, public.mindex_worship_slides,
  mindex_atomic.checkpoints, mindex_atomic.receipts in share row exclusive mode;
select mindex_atomic.remember_revision(aggregate) from mindex_atomic.checkpoints;
select mindex_atomic.remember_revision(mindex_atomic.read_service(id)) from public.mindex_worship_services;
create trigger preserve_worship_checkpoint before insert or update on mindex_atomic.checkpoints
  for each row execute function mindex_atomic.journal_checkpoint();
create trigger preserve_worship_committed_revision after insert on mindex_atomic.receipts
  for each row execute function mindex_atomic.journal_receipt();

-- Operator-only restore. Reuse the existing guarded restore protocol, never
-- accept replacement rows from a browser or expose private aggregates publicly.
create function mindex_atomic.restore_revision(req jsonb) returns jsonb
language plpgsql set search_path = pg_catalog, pg_temp as $$
declare sid uuid; saved jsonb;
begin
  sid := (req->>'serviceId')::uuid;
  if sid is null then raise exception 'INVALID_ID'; end if;
  perform pg_advisory_xact_lock_shared(1296649816,1);
  perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
  if exists(select from mindex_atomic.receipts where service_id=sid
    and request_id=(req->>'requestId')::uuid) then
    return mindex_atomic.restore_checkpoint(req);
  end if;
  select aggregate into saved from mindex_atomic.revision_history
    where service_id=sid and revision=(req->>'checkpointRevision')::bigint;
  if saved is null then raise exception 'HISTORY_REVISION_NOT_FOUND'; end if;
  insert into mindex_atomic.checkpoints values(sid,saved)
    on conflict(service_id) do update set aggregate=excluded.aggregate;
  -- Validation errors roll back the checkpoint selection in this transaction too.
  return mindex_atomic.restore_checkpoint(req);
end
$$;
revoke all on function mindex_atomic.restore_revision(jsonb) from public, anon, authenticated, mindex_atomic_writer;
commit;
