// Run only with the isolated PostgreSQL harness. No remote database is accepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const sql = path => fs.readFile(new URL('../migrations/'+path, import.meta.url), 'utf8');
const definition = (source,name) => source.match(new RegExp('create function public\\.'+name+'\\([\\s\\S]*?\\$\\$;'))[0];
const db = await openWorshipTestDb({requirePostgres:true});
try {
  await db.exec(`create role anon;create role authenticated;create role unrelated;
    create schema mindex_single_song;
    create table mindex_single_song.records(id text primary key,revision bigint not null,payload jsonb not null);
    create table mindex_single_song.rollout(singleton boolean primary key,phase text,epoch bigint);
    insert into mindex_single_song.rollout values(true,'native',7);
    alter table mindex_single_song.records enable row level security;
    insert into mindex_single_song.records select 'SONG-CONT-'||lpad(i::text,4,'0')||'-0001',1,
      jsonb_build_object('id','SONG-CONT-'||lpad(i::text,4,'0')||'-0001','fixture',repeat('synthetic text ',600))
    from generate_series(1,450) i;`);
  const rollout = await sql('2026-10-25-single-song-4444-resume.sql');
  await db.exec(definition(rollout,'get_praise_storage_status_v1'));
  await db.exec(definition(rollout,'get_single_praise_catalog_page_v1'));
  await db.exec(definition(await sql('2026-10-24-single-song-store-candidate.sql'),'get_single_praise_records_v1'));
  await db.exec(`alter function public.get_single_praise_records_v1(text[]) security definer;
    revoke all on function public.get_praise_storage_status_v1(),public.get_single_praise_records_v1(text[]),public.get_single_praise_catalog_page_v1(text,integer,text,text) from public;
    grant execute on function public.get_praise_storage_status_v1(),public.get_single_praise_records_v1(text[]),public.get_single_praise_catalog_page_v1(text,integer,text,text) to anon,authenticated;`);
  const snapshot = () => db.query("select md5(jsonb_agg(to_jsonb(r) order by id)::text) hash from mindex_single_song.records r");
  const attributes = () => db.query("select oid,proowner,proacl,proconfig,provolatile,prosecdef from pg_proc where oid='public.get_praise_storage_status_v1()'::regprocedure");
  const status = async () => (await db.query('select public.get_praise_storage_status_v1() as value')).rows[0].value;
  const index = async s => (await db.query('select public.get_praise_catalog_index_v1($1,$2) as value',[s.epoch,s.manifest])).rows[0].value;
  const migration = await sql('2026-11-06-praise-catalog-index-candidate.sql');
  await db.exec(await sql('2026-11-06-praise-catalog-index-preflight.sql'));
  const before = await status(), attrs = (await attributes()).rows, hash = (await snapshot()).rows;
  await db.exec(migration);
  assert.deepEqual((await attributes()).rows,attrs);
  assert.deepEqual((await snapshot()).rows,hash);
  assert.deepEqual(await status(),{...before,catalogIndex:1});
  await db.exec('set role anon');
  const entries = (await index(before)).entries;
  assert.equal(entries.length,before.recordCount);
  const byId = (await db.query('select public.get_single_praise_records_v1($1) as value',[entries.slice(0,200).map(([id])=>id)])).rows[0].value;
  const page = (await db.query('select public.get_single_praise_catalog_page_v1(null,200,$1,$2) as value',[before.epoch,before.manifest])).rows[0].value;
  assert.deepEqual(byId,page.records);
  await assert.rejects(db.query('select * from mindex_single_song.records'),/permission denied/);
  await db.exec('reset role;set role unrelated');
  await assert.rejects(index(before),/permission denied/);
  await db.exec("reset role;update mindex_single_song.records set revision=2 where id='SONG-CONT-0001-0001'");
  assert.equal(await index(before),null);
  const changed = await status();
  assert.deepEqual((await index(changed)).entries[0],['SONG-CONT-0001-0001',2]);
  await db.exec("update mindex_single_song.rollout set phase='maintenance'");
  assert.equal(await index(changed),null);
  await db.exec("update mindex_single_song.rollout set phase='native'");
  await db.exec(await sql('2026-11-06-praise-catalog-index-rollback.sql'));
  assert.equal((await status()).catalogIndex,undefined);
  assert.deepEqual((await attributes()).rows,attrs);
  await assert.rejects(index(changed),/does not exist/);
  console.log(JSON.stringify({result:'PASS',checks:['exact old payload parity','catalog epoch and manifest fence','maintenance fence','no access expansion to unrelated role','status owner, ACL, config and rows preserved','rollback']}));
} finally { await db.close(); }
