import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
try {
 await db.exec(await fs.readFile(new URL('../migrations/2026-10-24-single-song-store-candidate.sql',import.meta.url),'utf8'));
 const record={id:'knh-361',revision:0,metadata:{title:'fixture',scripture:['시편 1:1']},content:{forms:[{id:'unit',lyrics:'가사\n둘째 줄',part_type:'Verse'}],audio_set:{starts:[0,4],audioUrl:'https://example.test/audio'}},relations:{same_song:['kth-480']}};
 const req={requestId:randomUUID(),expectedRevision:0,record};
 const save=r=>scalar('select save_single_praise_record_v1($1)',[r]);
 const read=()=>scalar('select get_single_praise_records_v1($1)',[['knh-361']]);
 const first=await save(req);assert.equal(first.revision,1);assert.deepEqual(first.content,record.content);
 assert.deepEqual(await save(req),first,'exact replay');
 await assert.rejects(save({...req,record:{...record,metadata:{title:'reused'}}}),/REQUEST_REUSED/);
 await assert.rejects(save({...req,requestId:randomUUID()}),/CONFLICT/);
 assert.deepEqual((await read())[0],first);
 const second={requestId:randomUUID(),expectedRevision:1,record:{...first,metadata:{...first.metadata,title:'changed'}}};
 await db.exec('begin');await save(second);await db.exec('rollback');assert.deepEqual((await read())[0],first,'rollback all data and receipts');
 const done=await save(second);assert.equal(done.revision,2);assert.deepEqual(done.content,record.content);
 if(db.connect){
   const a=await db.connect(),b=await db.connect();
   const requests=['A','B'].map(title=>({requestId:randomUUID(),expectedRevision:2,record:{...done,metadata:{...done.metadata,title}}}));
   const raced=await Promise.allSettled([a.query('select save_single_praise_record_v1($1)',[requests[0]]),b.query('select save_single_praise_record_v1($1)',[requests[1]])]);
   assert.equal(raced.filter(x=>x.status==='fulfilled').length,1);
   assert.equal(raced.filter(x=>x.status==='rejected'&&/CONFLICT/.test(x.reason.message)).length,1);
   assert.equal((await read())[0].revision,3);assert.deepEqual((await read())[0].content,record.content);
 }
 await db.exec('create role single_song_no_access; set role single_song_no_access;');
 await assert.rejects(read(),/permission denied/);await assert.rejects(save(second),/permission denied/);await db.exec('reset role');
 assert.equal(await scalar("select count(*)::int from information_schema.tables where table_name like 'mindex_worship_%'"),0);
 console.log('PASS single-record SQL: create/update CAS, replay/reused ID, rollback, lyrics/timing preservation, access closed, no worship tables');
}finally{await db.close();}
