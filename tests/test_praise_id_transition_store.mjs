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
  await db.exec(await load('../migrations/2026-10-24-single-song-lifecycle-candidate.sql'));
  await db.exec(await load('../migrations/2026-10-24-single-song-rollout-candidate.sql'));
  await db.exec(`create schema mindex_state_private; create table mindex_state_private.entries(
    owner_hash text,scope text,key text,value text,revision bigint,request_id uuid,request_digest text,updated_at timestamptz,
    primary key(owner_hash,scope,key));`);
  await db.exec(await load('../migrations/2026-10-28-praise-id-reference-adapter.sql'));
  await db.exec(await load('../migrations/2026-10-28-praise-id-transition-candidate.sql'));
  await db.exec("update mindex_single_song.rollout set phase='native',epoch=2,native_written=true;update mindex_single_song.counters set last_number=444 where prefix='SONG-CONT'");
  // The initial store fixture predates the published 4-4 native ID contract.
  await db.exec(`alter table mindex_single_song.records drop constraint records_id_check;
    alter table mindex_single_song.records add constraint records_id_check check(id ~ '^SONG-(CONT|CHLD)-[0-9]{4}-[0-9]{4}$');
    alter table mindex_single_song.issued_ids drop constraint issued_ids_id_check;
    alter table mindex_single_song.issued_ids add constraint issued_ids_id_check check(id ~ '^SONG-(CONT|CHLD)-[0-9]{4}-[0-9]{4}$');
    insert into mindex_single_song.counters values('SONG-CONT',444),('SONG-CHLD',1) on conflict(prefix) do update set last_number=excluded.last_number;`);
  const old='SONG-CHLD-0001-0001',next='SONG-CONT-0445-0001',mapping={[old]:next};
  const record={id:old,revision:7,metadata:{title:'fixture'},content:{forms:[{id:'u',lyrics:'가사\n\n두 번째',part_type:'Lyrics'}],audio_set:{starts:[0,4]}}};
  await db.query('insert into mindex_single_song.records values($1,7,$2)',[old,record]);
  await db.query('insert into mindex_single_song.issued_ids values($1,false)',[old]);
  const sid=randomUUID(),section=randomUUID(),element=randomUUID();
  const document={sourceText:'[찬양]\n- 곡 ID: '+old};
  await scalar('select create_worship_service_v1($1)',[{protocolVersion:1,singleSongProtocol:1,serviceId:sid,requestId:randomUUID(),serviceTypeId:'fixture',serviceDate:'2026-10-28',metadataPatch:{title:'fixture'},
   sections:[{id:section,patch:{title:'찬양'}}],elements:[{id:element,sectionId:section,patch:{element_type:'praise',praise_record_id:old,body:'saved body',config:{audioTiming:{starts:[0,4]},formHint:'Lyrics'}}}],document}]);
  const original=await scalar('select mindex_atomic.read_service($1)',[sid]);
  const stateValue=JSON.stringify({song_id:old,lyrics:'원문'});
  await db.query("insert into mindex_state_private.entries values('test-owner','private',$1,$2,4,$3,'original',now())",['mindex.editor.draft.v2:praise:'+old+':'+randomUUID(),stateValue,randomUUID()]);
  const job=randomUUID(),fp=()=>scalar('select mindex_id_transition.fingerprint()');
  const apply=(fingerprint,docs)=>scalar('select mindex_id_transition.apply($1,$2,$3,$4)',[job,fingerprint,mapping,docs]);
  const before=await fp();
  await assert.rejects(apply('stale',{}),/SNAPSHOT_CONFLICT/);
  await assert.rejects(apply(before,{}),/DOCUMENT_PLAN_REQUIRED/);
  assert.equal(await fp(),before,'failed transition must roll back every change');
  const newDoc={sourceText:document.sourceText.replace(old,next)};
  await apply(before,{[sid]:newDoc});
  const after=await scalar('select mindex_atomic.read_service($1)',[sid]);
  assert.equal(after.elements[0].praise_record_id,next);assert.deepEqual(after.elements[0].config,original.elements[0].config);
  assert.equal(after.elements[0].body,'saved body');assert.equal(BigInt(after.revision),BigInt(original.revision)+1n);
  assert.deepEqual((await scalar('select payload from mindex_single_song.records where id=$1',[next])).content,record.content);
  assert.equal(await scalar('select value from mindex_state_private.entries'),stateValue.replace(old,next));
  assert.equal((await apply(before,{[sid]:newDoc})).replayed,true);
  await db.exec("begin;savepoint before_edit");
  await db.query("update public.mindex_worship_services set title='intervening edit' where id=$1",[sid]);
  await assert.rejects(scalar('select mindex_id_transition.rollback($1,$2)',[job,{[sid]:document}]),/ROLLBACK_DRIFT/);
  await db.exec('rollback to before_edit;commit');
  await scalar('select mindex_id_transition.rollback($1,$2)',[job,{[sid]:document}]);
  const recovered=await scalar('select mindex_atomic.read_service($1)',[sid]);
  assert.equal(recovered.elements[0].praise_record_id,old);assert.equal(BigInt(recovered.revision),BigInt(after.revision)+1n);
  assert.equal((await scalar('select payload from mindex_single_song.records where id=$1',[old])).revision,9);
  assert.equal(await scalar('select value from mindex_state_private.entries'),stateValue);
  assert.equal(await scalar("select last_number::text from mindex_single_song.counters where prefix='SONG-CONT'"),'445');
  await db.exec('set role anon');
  await assert.rejects(fp(),/permission denied/);
  await db.exec('reset role');
  console.log('PASS real atomic path: CAS, partial failure rollback, references/content/state, replay, rollback drift, monotonic recovery, private permissions');
}finally{await db.close();}
