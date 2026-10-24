import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb({requirePostgres:true});
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const call=req=>scalar('select public.mutate_single_praise_v1($1)',[req]);
const request=(operation,rest={})=>({protocolVersion:1,requestId:randomUUID(),operation,...rest});
const create=(title='fixture',rest={})=>request('create',{prefix:'ccm',metadata:{title,praise_types:['ccm']},content:{name:'기본',forms:[]},...rest});
const read=ids=>scalar('select public.get_single_praise_records_v1($1)',[ids]);
const expected=rows=>Object.fromEntries(rows.map(r=>[r.id,r.revision]));
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

 await db.exec(await fs.readFile(new URL('../migrations/2026-10-24-single-song-store-candidate.sql',import.meta.url),'utf8'));
 await db.exec(await load('../migrations/2026-10-24-single-song-worship-candidate.sql'));
 await db.exec(await fs.readFile(new URL('../migrations/2026-10-24-single-song-lifecycle-candidate.sql',import.meta.url),'utf8'));

 const seeded=await call(create('seed'));
 await db.exec(await load('../migrations/2026-10-24-single-song-rollout-candidate.sql'));
 await db.exec('grant select,insert,update,delete on public.mindex_songs to anon');
 await db.exec("create function public.fixture_old_write(id uuid) returns void language sql security definer as $$insert into public.mindex_songs values(id)$$;grant execute on function public.fixture_old_write(uuid) to anon");
 const legacyId=randomUUID();
 assert.deepEqual((await scalar('select mindex_single_song.document_reference_ids($1)',[{source:'- 곡 ID: '+seeded.id,nested:{versionId:legacyId},lyrics:'keep'}])).sort(),[seeded.id,legacyId].sort());
 const status=()=>scalar('select public.get_praise_storage_status_v1()');
 const phase=async mode=>{const s=await status();return scalar('select mindex_single_song.set_rollout_phase($1,$2,$3,$4)',[mode,s.epoch,s.recordCount,s.manifest]);};
 await db.exec('set role anon');
 await db.query('select public.fixture_old_write($1)',[randomUUID()]);
 await assert.rejects(db.query("select mindex_single_song.set_rollout_phase('maintenance',0,1,'x')"),/permission denied/);
 await db.exec('reset role');await phase('maintenance');
 await db.exec('set role anon');
 await assert.rejects(db.query('insert into public.mindex_songs values($1)',[randomUUID()]),/WRITE_FENCED/);
 await assert.rejects(db.query('select public.fixture_old_write($1)',[randomUUID()]),/WRITE_FENCED/);
 await db.exec('reset role');await phase('legacy');await phase('maintenance');await phase('native');
 await db.exec('set role anon');
 await assert.rejects(db.query('select public.fixture_old_write($1)',[randomUUID()]),/WRITE_FENCED/);
 await assert.rejects(db.query('select * from mindex_single_song.records'),/permission denied/);
 let s=await status();let page=await scalar('select public.get_single_praise_catalog_page_v1(null,200,$1,$2)',[s.epoch,s.manifest]);
 assert.equal(page.records[0].id,seeded.id);
 await assert.rejects(scalar('select public.get_single_praise_catalog_page_v1(null,200,$1,$2)',[s.epoch,'stale']),/STORAGE_CHANGED/);
 await db.exec('reset role;set role mindex_atomic_writer');
 await assert.rejects(db.query('select mindex_atomic.require_single_song_protocol($1)',[{serviceId:randomUUID()}]),/CLIENT_REQUIRED/);
 await db.query('select mindex_atomic.require_single_song_protocol($1)',[{singleSongProtocol:1,serviceId:randomUUID()}]);
 await db.exec('reset role;set role anon');
 const made=await call(create('native'));assert.notEqual(made.id,seeded.id);
 await db.exec('reset role');await phase('maintenance');
 await assert.rejects(phase('legacy'),/FORWARD_RECOVERY/);
 await db.exec('set role anon');await assert.rejects(call(create('blocked')),/WRITE_FENCED/);
 await db.exec('reset role');await phase('native');
 console.log('PASS rollout legacy/maintenance/native, direct and definer-RPC fencing, native create, old worship protocol, manifest pages, private access and post-write rollback refusal');
} finally {await db.close();}
