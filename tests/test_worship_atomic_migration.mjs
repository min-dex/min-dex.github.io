// Executes the production migration in a disposable PostgreSQL 17 cluster.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { openWorshipTestDb } from './helpers/worship-test-db.mjs';

const db = await openWorshipTestDb({ requirePostgres: true });
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const load = path => fs.readFile(new URL(path, import.meta.url), 'utf8');

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create table public.mindex_worship_service_types(id text primary key);
    create table public.mindex_worship_templates(id uuid primary key);
    create table public.mindex_songs(id uuid primary key);
    create table public.mindex_canonical_songs(id uuid primary key);
    create table public.mindex_song_versions(
      id uuid primary key,
      source_song_id uuid references public.mindex_songs(id),
      canonical_song_id uuid references public.mindex_canonical_songs(id)
    );
    create table public.mindex_version_units(id uuid primary key, version_id uuid references public.mindex_song_versions(id));
    create table public.mindex_scriptures(id uuid primary key);
    create function public.mindex_touch_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at=now(); return new; end $$;
  `);

  const schema = await load('../scripts/worship-schema.sql');
  await db.exec(schema.slice(
    schema.indexOf('create table if not exists public.mindex_worship_services ('),
    schema.indexOf('-- ── Import review pipeline'),
  ));
  await db.exec(`
    do $legacy$
    declare relation_name text;
    begin
      foreach relation_name in array array[
        'mindex_worship_services',
        'mindex_worship_sections',
        'mindex_worship_elements',
        'mindex_worship_slides'
      ] loop
        execute format('alter table public.%I enable row level security', relation_name);
        execute format('grant select, insert, update, delete on public.%I to anon, authenticated', relation_name);
        execute format('create policy legacy_shared_all on public.%I to anon, authenticated using (true) with check (true)', relation_name);
      end loop;
    end
    $legacy$;
  `);
  await db.exec("insert into public.mindex_worship_service_types values ('fixture')");

  await db.exec(await load('../migrations/2026-09-22-worship-atomic-additive.sql'));
  // Optional operator export: exercise the installed function bodies locally,
  // without connecting this disposable test cluster to the production database.
  if (process.env.WORSHIP_PREFLIGHT_JSON) {
    const preflight = JSON.parse(await fs.readFile(process.env.WORSHIP_PREFLIGHT_JSON, 'utf8'));
    const expected = ['create_service', 'delete_service', 'read_service',
      'restore_checkpoint', 'save_existing', 'validate_document'];
    assert.deepEqual(preflight.functions.map(fn => fn.name).sort(), expected);
    for (const fn of preflight.functions) {
      assert.equal(fn.owner, 'postgres');
      assert.equal(fn.security_definer, false);
      assert.ok(fn.definition.startsWith(`CREATE OR REPLACE FUNCTION mindex_atomic.${fn.name}(`));
      await db.exec(fn.definition);
    }
    console.log('PASS loaded reviewed production function definitions into disposable cluster');
  }
  assert.equal(await scalar(`select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_worship_service_v1','save_worship_service_v1',
      'create_worship_service_v1','delete_worship_service_v1')`), 4);

  const serviceId = randomUUID();
  const createRequest = {
    protocolVersion: 1,
    serviceId,
    requestId: randomUUID(),
    serviceTypeId: 'fixture',
    serviceDate: '2026-09-22',
    metadataPatch: { title: 'atomic fixture' },
    sections: [],
    elements: [],
    document: { sourceText: '' },
  };

  await db.exec('set session authorization anon');
  const created = await scalar('select public.create_worship_service_v1($1)', [createRequest]);
  assert.equal(created.committedRevision, '1');
  await db.query('update public.mindex_worship_services set title=$1 where id=$2', ['legacy still works', serviceId]);
  assert.equal(await scalar('select title from public.mindex_worship_services where id=$1', [serviceId]), 'legacy still works');
  console.log('PASS additive install exposes RPCs without breaking the legacy writer');

  await db.exec('reset session authorization');
  await db.exec(await load('../migrations/2026-09-22-worship-atomic-cutover.sql'));
  await db.exec('set session authorization anon');
  await assert.rejects(
    db.query('update public.mindex_worship_services set title=$1 where id=$2', ['must fail', serviceId]),
    /permission denied/,
  );

  const saveRequest = {
    protocolVersion: 1,
    serviceId,
    requestId: randomUUID(),
    expectedRevision: '1',
    metadataPatch: { title: 'atomic only' },
    sectionPatches: [],
    elementPatches: [],
    document: { sourceText: '' },
  };
  const saved = await scalar('select public.save_worship_service_v1($1)', [saveRequest]);
  assert.equal(saved.committedRevision, '2');
  assert.equal(saved.aggregate.service.title, 'atomic only');
  assert.equal((await scalar('select public.save_worship_service_v1($1)', [saveRequest])).replayed, true);
  console.log('PASS cutover blocks direct writes while atomic save and exact retry remain available');

  await db.exec('reset session authorization');
  assert.equal(await scalar("select has_schema_privilege('anon','mindex_atomic','usage')"), false);
  assert.equal(await scalar("select has_schema_privilege('authenticated','mindex_atomic','usage')"), false);
  assert.equal(await scalar("select has_schema_privilege('mindex_atomic_writer','public','create')"), false);
  assert.equal(await scalar("select has_schema_privilege('mindex_atomic_writer','mindex_atomic','create')"), false);
  assert.equal(await scalar(`select exists(
    select 1 from pg_auth_members m
    join pg_roles member on member.oid=m.member
    join pg_roles granted on granted.oid=m.roleid
    where member.rolname='postgres' and granted.rolname='mindex_atomic_writer')`), false);
  console.log('PASS private journal and recovery schema remain unavailable to browser roles');

  await db.exec(await load('../migrations/2026-10-08-worship-revision-history.sql'));
  await db.exec(await load('../migrations/2026-10-08-worship-slot-uniqueness.sql'));
  assert.equal(await scalar('select count(*)::int from mindex_atomic.revision_history where service_id=$1',[serviceId]),2);
  const save = (revision, overrides={}) => ({...saveRequest,requestId:randomUUID(),expectedRevision:String(revision),...overrides});
  let revision=2;
  await db.exec('set session authorization anon');
  for(let i=0;i<5;i++) {
    const response=await scalar('select public.save_worship_service_v1($1)',[save(revision,{metadataPatch:{title:`history ${i}`}})]);
    revision=Number(response.committedRevision);
  }
  await assert.rejects(db.query('select * from mindex_atomic.revision_history'),/permission denied/);
  await db.exec('reset session authorization');
  assert.equal(await scalar('select count(*)::int from mindex_atomic.revision_history where service_id=$1',[serviceId]),7);
  assert.equal(await scalar("select aggregate->'service'->>'title' from mindex_atomic.revision_history where service_id=$1 and revision=2",[serviceId]),'atomic only');
  await db.exec('set session authorization mindex_atomic_writer');
  await assert.rejects(db.exec('delete from mindex_atomic.revision_history'),/permission denied/);
  await db.exec('reset session authorization');
  console.log('PASS multiple revisions retained; browser and writer cannot rewrite private history');

  const section=randomUUID(), first=randomUUID(), second=randomUUID();
  await db.exec('set session authorization anon');
  const structure=save(revision,{newSections:[{id:section,patch:{title:'praise'}}],
    newElements:[first,second].map((id,i)=>({id,sectionId:section,patch:{element_type:'praise',source_ref:{slotKey:`praise.song.${i+1}`}}}))});
  await scalar('select public.save_worship_service_v1($1)',[structure]); revision++;
  const duplicate=save(revision,{elementPatches:[{id:second,patch:{source_ref:{slotKey:'praise.song.1'}}}]});
  await assert.rejects(db.query('select public.save_worship_service_v1($1)',[duplicate]),/DUPLICATE_WORSHIP_SLOT/);
  assert.equal((await scalar('select public.get_worship_service_v1($1)',[serviceId])).revision,String(revision));
  // Check final state, not intermediate row order: swapping slots is valid.
  const swap=save(revision,{elementPatches:[
    {id:first,patch:{source_ref:{slotKey:'praise.song.2'}}},
    {id:second,patch:{source_ref:{slotKey:'praise.song.1'}}}]});
  await scalar('select public.save_worship_service_v1($1)',[swap]); revision++;
  assert.equal((await scalar('select public.save_worship_service_v1($1)',[swap])).replayed,true);
  await assert.rejects(db.query('select public.save_worship_service_v1($1)',[save(revision-1)]),/REVISION_CONFLICT/);
  await db.exec('reset session authorization');
  assert.equal(await scalar('select count(*)::int from mindex_atomic.revision_history where service_id=$1',[serviceId]),revision);
  console.log('PASS duplicate slots roll back; final-state swaps, retries and conflict checks remain valid');

  // History failure must roll back the actual save, receipt, and checkpoint together.
  await db.exec(`create function mindex_atomic.inject_history_failure() returns trigger language plpgsql as $$
    begin raise exception 'INJECTED_HISTORY_FAILURE'; end $$;
    create trigger fail_history before insert on mindex_atomic.revision_history
    for each row execute function mindex_atomic.inject_history_failure();`);
  await db.exec('set session authorization anon');
  await assert.rejects(db.query('select public.save_worship_service_v1($1)',[save(revision)]),/INJECTED_HISTORY_FAILURE/);
  assert.equal((await scalar('select public.get_worship_service_v1($1)',[serviceId])).revision,String(revision));
  await db.exec('reset session authorization');
  await db.exec('drop trigger fail_history on mindex_atomic.revision_history');
  await db.exec('set session authorization anon');
  await scalar('select public.delete_worship_service_v1($1)',[{
    protocolVersion:1,serviceId,requestId:randomUUID(),expectedRevision:String(revision),confirmDelete:true}]);
  await db.exec('reset session authorization');
  assert.equal(await scalar('select count(*)::int from mindex_atomic.revision_history where service_id=$1',[serviceId]),revision);
  console.log('PASS failed history writes roll back saves, and service deletion retains all recovery revisions');
  const restore={protocolVersion:1,serviceId,requestId:randomUUID(),
    expectedRevision:String(revision+1),checkpointRevision:'2',confirmRestore:true};
  const restored=await scalar('select mindex_atomic.restore_revision($1)',[restore]);
  assert.equal(restored.aggregate.service.title,'atomic only');
  assert.equal(restored.committedRevision,String(revision+2));
  assert.equal((await scalar('select mindex_atomic.restore_revision($1)',[restore])).replayed,true);
  const checkpoint=await scalar('select aggregate from mindex_atomic.checkpoints where service_id=$1',[serviceId]);
  await assert.rejects(db.query('select mindex_atomic.restore_revision($1)',[
    {...restore,requestId:randomUUID(),expectedRevision:String(revision+2),checkpointRevision:'1',confirmRestore:false}]),/RESTORE_INTENT_REQUIRED/);
  assert.deepEqual(await scalar('select aggregate from mindex_atomic.checkpoints where service_id=$1',[serviceId]),checkpoint);
  await assert.rejects(db.query('select mindex_atomic.restore_revision($1)',[
    {...restore,requestId:randomUUID(),expectedRevision:String(revision+2),checkpointRevision:'99999'}]),/HISTORY_REVISION_NOT_FOUND/);
  await db.exec('set session authorization anon');
  await assert.rejects(db.query('select mindex_atomic.restore_revision($1)',[restore]),/permission denied/);
  await db.exec('reset session authorization');
  console.log('PASS operator restores an older revision after deletion; replay, confirmation, missing-version and ACL guards hold');
  const catalogResults = await db.exec(await load('../migrations/2026-10-08-worship-integrity-postflight.sql'));
  const catalog = catalogResults.flatMap(result => result.rows).find(row => row.integrity_catalog).integrity_catalog;
  assert.equal(catalog.functions.length, 8);
  assert.equal(catalog.triggers.length, 2);
  assert.ok(catalog.triggers.every(trigger => trigger.enabled === 'O'));
  const restoreCatalog = catalog.functions.find(fn => fn.signature === 'mindex_atomic.restore_revision(jsonb)');
  assert.deepEqual(restoreCatalog.effective_execute, {anon:false, authenticated:false, mindex_atomic_writer:false});
  assert.ok(Object.values(catalog.history.role_privileges).every(privileges => Object.values(privileges).every(value => value === false)));
  console.log('PASS read-only postflight reports installed functions, enabled triggers and effective ACLs');
} finally {
  await db.close();
}
