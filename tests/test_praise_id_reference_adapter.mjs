// Synthetic PostgreSQL test only; no production URL/credentials accepted.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb({requirePostgres:true});
const old='SONG-CHLD-0001-0001',next='SONG-CONT-0445-0001';
const map={[old]:next};
const rewrite=async(value,m=map)=>(await db.query('select mindex_single_song.rewrite_id_references($1::jsonb,$2::jsonb) result',[JSON.stringify(value),JSON.stringify(m)])).rows[0].result;
try {
 await db.exec('create schema mindex_single_song');
 await db.exec(await fs.readFile(new URL('../migrations/2026-10-28-praise-id-reference-adapter.sql',import.meta.url),'utf8'));
 const row={id:old,content:{lyrics:'첫 줄\n\n다음',audio:{url:'https://example.test/a',cues:[0,1.25]}},sourceText:'첫 줄\r\n- 곡 ID: '+old+'  \r\n끝',previousIds:['SONG-CHLD-0009-0001']};
 const result=await rewrite(row);assert.equal(result.id,next);assert.deepEqual(result.content,row.content);
 assert.deepEqual(await rewrite(result,{[next]:old}),row);
 assert.equal((await rewrite({sourceText:'- 곡 ID: '+old+'\n- 곡 ID: '+old})).sourceText,'- 곡 ID: '+next+'\n- 곡 ID: '+next);
 await assert.rejects(rewrite({id:old},{'.*':next}),/INVALID_REKEY_MAP/);
 const value=JSON.stringify({base:JSON.stringify({song_id:old,lyrics:'원문'}),key:'praise:'+old});
 const state=await rewrite({key:'mindex.editor.draft.v2:praise:'+old+':00000000-0000-0000-0000-000000000000',value});
 assert.equal(state.value,value.replaceAll(old,next));
 assert.deepEqual(await rewrite(state,{[next]:old}),{key:'mindex.editor.draft.v2:praise:'+old+':00000000-0000-0000-0000-000000000000',value});
 for(const bad of [{lyrics:old},{sourceText:'본문 '+old},{unknown:old},{[old]:42},{value:'not JSON '+old}]) await assert.rejects(rewrite(bad),/REKEY_/);
 await db.exec('begin'); await db.exec('create table fixture(v jsonb)'); await db.query('insert into fixture values($1)',[row]);
 await db.exec('savepoint candidate');await db.query('update fixture set v=mindex_single_song.rewrite_id_references(v,$1)',[map]);
 assert.deepEqual((await db.query('select v from fixture')).rows[0].v,result);
 await db.exec('rollback to candidate');assert.deepEqual((await db.query('select v from fixture')).rows[0].v,row);await db.exec('rollback');
 console.log('PASS PostgreSQL typed references, nested serialization, protected text/audio, unknown rejection and rollback');
} finally {await db.close();}
