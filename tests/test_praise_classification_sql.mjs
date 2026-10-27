import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb();
try {
 await db.exec('create schema mindex_single_song; create table mindex_single_song.records(id text primary key,payload jsonb not null);');
 const row={id:'SONG-CONT-0001-0001',revision:1,metadata:{title:'보존'},content:{praise_types:['ccm'],forms:[{lyrics:'원문'}],audio_set:{starts:[1,3]}}};
 await db.query('insert into mindex_single_song.records values($1,$2)',[row.id,row]);
 const sql=await fs.readFile(new URL('../migrations/2026-10-28-praise-classification-single-owner.sql',import.meta.url),'utf8');
 await db.exec(sql);
 for(const payload of [{...row,metadata:{...row.metadata,praise_types:['ccm']}},{...row,content:{...row.content,praise_types:['children']}},{...row,content:{...row.content,praise_types:[]}},{...row,content:{forms:row.content.forms}},{...row,content:{...row.content,praise_types:null}}]) {
  await assert.rejects(db.query('update mindex_single_song.records set payload=$1 where id=$2',[payload,row.id]),/praise_classification_single_owner/);
 }
 assert.deepEqual((await db.query('select payload from mindex_single_song.records')).rows[0].payload,row);
 await db.exec('begin');await db.query('update mindex_single_song.records set payload=$1',[{...row,metadata:{title:'temporary'}}]);await db.exec('rollback');
 assert.deepEqual((await db.query('select payload from mindex_single_song.records')).rows[0].payload,row);
 console.log('PASS SQL rejects duplicate/missing/null/empty/children classification; content and rollback preserved');
}finally{await db.close();}
