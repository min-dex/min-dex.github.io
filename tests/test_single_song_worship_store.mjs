// Native single reference candidate in a disposable PostgreSQL cluster only.
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

  await db.exec(await load('../migrations/2026-10-24-single-song-store-candidate.sql'));
  await db.exec(await load('../migrations/2026-10-24-single-song-worship-candidate.sql'));
  const record={id:'knh-361',revision:0,metadata:{title:'fixture'},content:{forms:[{id:'u',lyrics:'가사',part_type:'Verse'}],audio_set:{starts:[0,4]}}};
  await scalar('select save_single_praise_record_v1($1)',[{requestId:randomUUID(),expectedRevision:0,record}]);
  const sid=randomUUID(),section=randomUUID(),element=randomUUID();
  const create={protocolVersion:1,singleSongProtocol:1,serviceId:sid,requestId:randomUUID(),serviceTypeId:'fixture',serviceDate:'2026-10-24',metadataPatch:{title:'native fixture'},
   sections:[{id:section,patch:{title:'찬양'}}],elements:[{id:element,sectionId:section,patch:{element_type:'praise',praise_record_id:'knh-361',body:'saved body',config:{audioTiming:{starts:[0,4]},formHint:'V1-Coda'}}}],
   document:{sourceText:'[찬양]\n- 곡 ID: knh-361',sourceRecords:[{elementId:element,linkedSource:{songId:'knh-361'}}]}};
  const oldCreate={...create};delete oldCreate.singleSongProtocol;
  await assert.rejects(scalar('select create_worship_service_v1($1)',[oldCreate]),/SINGLE_SONG_CLIENT_REQUIRED/);
  const receipt=await scalar('select create_worship_service_v1($1)',[create]);
  const read=()=>scalar('select get_worship_service_v1($1)',[sid]);
  const before=await read();assert.equal(before.elements[0].praise_record_id,'knh-361');assert.equal(before.elements[0].song_id,null);assert.equal(before.elements[0].song_version_id,null);
  const req={protocolVersion:1,singleSongProtocol:1,serviceId:sid,requestId:randomUUID(),expectedRevision:before.revision,metadataPatch:{title:'saved'},elementPatches:[{id:element,patch:{sort_order:2}}],document:create.document};
  const old={...req};delete old.singleSongProtocol;
  await assert.rejects(scalar('select save_worship_service_v1($1)',[old]),/SINGLE_SONG_CLIENT_REQUIRED/);
  await scalar('select save_worship_service_v1($1)',[req]);const after=await read();
  assert.deepEqual(after.elements[0].config,before.elements[0].config);assert.equal(after.elements[0].body,'saved body');assert.equal(after.elements[0].sort_order,2);
  await assert.rejects(db.query('delete from mindex_single_song.records where id=$1',['knh-361']),/foreign key/);
  const bad={...req,requestId:randomUUID(),expectedRevision:after.revision,metadataPatch:{title:'must rollback'},elementPatches:[{id:element,patch:{praise_record_id:'knh-999'}}]};
  await assert.rejects(scalar('select save_worship_service_v1($1)',[bad]),/foreign key/);assert.deepEqual(await read(),after);
  const oldDelete={protocolVersion:1,serviceId:sid,requestId:randomUUID(),expectedRevision:after.revision,confirmDelete:true};
  await assert.rejects(scalar('select delete_worship_service_v1($1)',[oldDelete]),/SINGLE_SONG_CLIENT_REQUIRED/);
  const restore={protocolVersion:1,serviceId:sid,requestId:randomUUID(),expectedRevision:after.revision,checkpointRevision:before.revision,confirmRestore:true};
  await assert.rejects(scalar('select mindex_atomic.restore_checkpoint($1)',[restore]),/SINGLE_SONG_CLIENT_REQUIRED/);
  await scalar('select delete_worship_service_v1($1)',[{...oldDelete,singleSongProtocol:1}]);
  await assert.rejects(scalar('select mindex_atomic.restore_checkpoint($1)',[restore]),/SINGLE_SONG_CLIENT_REQUIRED/);
  const checkpoint=await scalar('select aggregate from mindex_atomic.checkpoints where service_id=$1',[sid]);
  const tombstone=await scalar('select revision::text from mindex_atomic.tombstones where service_id=$1',[sid]);
  await scalar('select mindex_atomic.restore_checkpoint($1)',[{...restore,singleSongProtocol:1,expectedRevision:tombstone,checkpointRevision:checkpoint.revision}]);
  const withoutTimestamp=rows=>rows.map(({updated_at,...row})=>row);
  assert.deepEqual(withoutTimestamp((await read()).elements),withoutTimestamp(after.elements));
  console.log('PASS native single FK create/save/read, legacy-client guard, body/form/timing preservation, referenced-record delete guard, transaction rollback');
}finally{await db.close();}
