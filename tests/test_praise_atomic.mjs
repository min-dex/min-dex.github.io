import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID as uuid} from 'node:crypto';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
try {
 await db.exec('create role anon; create role authenticated;');
 const schema=await fs.readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8');
 await db.exec(schema.slice(schema.indexOf('create table if not exists public.mindex_songs'),schema.indexOf('-- Promote song-level')));
 await db.exec(await fs.readFile(new URL('../migrations/2026-10-23-praise-atomic-save.sql',import.meta.url),'utf8'));
 const sid=uuid(),v=uuid(),u=uuid(),other=uuid();
 await db.query("insert into mindex_songs(id,title,memo) values($1,'original',$3),($2,'other','{}')",[sid,other,JSON.stringify({unrecognizedSource:"keep"})]);
 await db.query("insert into mindex_canonical_songs(id,title,normalized_title) values($1,'original','original')",[sid]);
 await db.query("insert into mindex_song_versions(id,canonical_song_id,source_song_id,version_order,version_label,lyric_signature) values($1,$2,$2,1,'base','sig')",[v,sid]);
 await db.query("insert into mindex_version_units(id,version_id,canonical_song_id,unit_order,unit_label,unit_kind,trigger,text) values($1,$2,$3,1,'v','verse','','original lyrics')",[u,v,sid]);
 const read=()=>scalar('select get_praise_snapshot_v1($1)',[sid]);
 const save=req=>scalar('select save_praise_v1($1)',[req]);
 // Metadata-only song-form changes must leave lyrics, versions and relations intact.
 const beforeMetadata=await read();
 const metadataMemo={...JSON.parse(beforeMetadata.song.memo),metadata:{presenter_form:{forms:['T','V1','C'],hint:'T-V1-C',titleSequence:true}}};
 const metadataRequest={protocolVersion:1,requestId:uuid(),songId:sid,expected:beforeMetadata,songPatch:{...beforeMetadata.song,memo:JSON.stringify(metadataMemo)}};
 const metadataReceipt=await save(metadataRequest),afterMetadata=await read();
 assert.deepEqual(afterMetadata,metadataReceipt.snapshot);
 for(const key of ['units','versions','canonical','relations'])assert.deepEqual(afterMetadata[key],beforeMetadata[key]);
 assert.deepEqual({...afterMetadata.song,memo:beforeMetadata.song.memo},beforeMetadata.song);
 const persistedMemo=JSON.parse(afterMetadata.song.memo);delete persistedMemo._praiseCommit;
 assert.deepEqual(persistedMemo,metadataMemo);
 assert.equal((await save(metadataRequest)).replayed,true);
 await assert.rejects(save({...metadataRequest,requestId:uuid()}),/PRAISE_CONFLICT/);
 const base=await read();
 const request=(snapshot,text)=>({protocolVersion:1,requestId:uuid(),songId:sid,expected:snapshot,
  songPatch:{title:text,memo:'{}'},versions:snapshot.versions.map(x=>({...x,version_order:1})),
  units:snapshot.units.map(x=>({...x,text,unit_order:1})),relatedIds:[other],deleteVersionIds:[],deleteUnitIds:[]});
 const first=request(base,'editor A');
 const receipt=await save(first);assert.equal(receipt.snapshot.units[0].text,'editor A');assert.equal(JSON.parse(receipt.snapshot.song.memo).unrecognizedSource,'keep');
 // Two editors loaded the same baseline. The second cannot overwrite A.
 const afterA=await read();await assert.rejects(save(request(base,'editor B')),/PRAISE_CONFLICT/);assert.deepEqual(await read(),afterA);
 // A committed save whose response was lost is retried with the same request.
 assert.equal((await save(first)).replayed,true);assert.deepEqual(await read(),afterA);
 await assert.rejects(save({...first,songPatch:{title:'changed request',memo:'{}'}}),/PRAISE_REQUEST_REUSED/);
 // Failure after version and unit writes must roll every row and order back.
 const broken=request(afterA,'must rollback');broken.songPatch.memo='invalid JSON';
 await assert.rejects(save(broken));assert.deepEqual(await read(),afterA);
 // Failure at the final relation insert must also roll the entire transaction back.
 const missing=request(afterA,'relation rollback');missing.relatedIds=[uuid()];
 await assert.rejects(save(missing));assert.deepEqual(await read(),afterA);
 // Unknown audio metadata must survive a partial-field version update.
 await db.exec('alter table mindex_song_versions add column audio_set jsonb');
 await db.query('update mindex_song_versions set audio_set=$1 where id=$2',[{timing:[1,2],media:'keep'},v]);
 const withAudio=await read(),r=request(withAudio,'with audio');r.versions=r.versions.map(({audio_set,...row})=>row);
 assert.deepEqual((await save(r)).snapshot.versions[0].audio_set,{timing:[1,2],media:'keep'});
 // A partial replacement cannot silently strand or drop existing blocks.
 const complete=await read(),partial=request(complete,'partial');partial.units=[];
 await assert.rejects(save(partial),/PRAISE_INCOMPLETE_PLAN/);assert.deepEqual(await read(),complete);
 const peerVersion=uuid(),peerUnit=uuid();
 await db.query("insert into mindex_song_versions(id,canonical_song_id,source_song_id,version_order,version_label,lyric_signature) values($1,$2,$3,20,'peer','peer')",[peerVersion,sid,other]);
 await db.query("insert into mindex_version_units(id,version_id,canonical_song_id,unit_order,unit_label,unit_kind,trigger,text) values($1,$2,$3,1,'v','verse','','peer lyrics')",[peerUnit,peerVersion,sid]);
 const scoped=await read(),foreign=request(scoped,'foreign overwrite');foreign.units[0].id=peerUnit;foreign.deleteUnitIds=[u];
 await assert.rejects(save(foreign),/PRAISE_FOREIGN_UNIT/);assert.deepEqual(await read(),scoped);
 assert.equal(await scalar('select text from mindex_version_units where id=$1',[peerUnit]),'peer lyrics');
 if(db.connect){
  const a=await db.connect(),b=await db.connect();
  const simultaneous=await read();
  const outcomes=await Promise.allSettled([a.query('select save_praise_v1($1)',[request(simultaneous,'A concurrent')]),b.query('select save_praise_v1($1)',[request(simultaneous,'B concurrent')])]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/PRAISE_CONFLICT/);
  // Cancel after unit writes, while the song update is sleeping inside the RPC.
  await db.exec("create function pause_praise_test() returns trigger language plpgsql as $$ begin if new.title='cancel mid-save' then perform pg_sleep(8); end if; return new; end $$; create trigger pause_test before update on mindex_songs for each row execute function pause_praise_test()");
  const beforeCancel=await read(),pid=(await a.query('select pg_backend_pid() pid')).rows[0].pid;
  const interrupted=a.query('select save_praise_v1($1)',[request(beforeCancel,'cancel mid-save')]).then(()=>({ok:true}),error=>({error}));
  let sleeping=false;
  for(let n=0;n<100;n++){
   if((await b.query('select wait_event from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event==='PgSleep'){sleeping=true;break;}
   await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(sleeping,true,'save did not reach injected mid-transaction pause');
  await b.query('select pg_cancel_backend($1)',[pid]);assert.equal((await interrupted).error.code,'57014');
  assert.deepEqual(await read(),beforeCancel);
  await db.exec('drop trigger pause_test on mindex_songs; drop function pause_praise_test()');
  // RLS rejection must roll back prior version/unit changes, with no definer bypass.
  await db.exec("grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; alter table mindex_songs enable row level security; create policy praise_read_test on mindex_songs for select to authenticated using(true)");
  const beforeDenied=await read();await a.query('set role authenticated');
  await assert.rejects(a.query('select save_praise_v1($1)',[request(beforeDenied,'denied')]),/row-level security/);
  await a.query('reset role');assert.deepEqual(await read(),beforeDenied);
  console.log('PASS real concurrent connections, cancellation during save, RLS denial rollback');
 }
 console.log('PASS stale editor rejection, lost-response replay, request identity, mid-save and final-step rollback, audio metadata preservation');
}finally{await db.close();}
