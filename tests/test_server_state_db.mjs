import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb({requirePostgres:true});
try{
 await db.exec('create role anon;create role authenticated;create schema extensions;create extension pgcrypto with schema extensions;');
 await db.exec(await fs.readFile(new URL('../migrations/2026-10-19-server-client-state.sql',import.meta.url),'utf8'));
 await db.exec('set role anon');
 const token='a'.repeat(64),other='b'.repeat(64),id='11111111-1111-4111-8111-111111111111';
 const read=async t=>(await db.query('select public.mindex_state_read_v1($1,$2) data',[t,'device'])).rows[0].data;
 const put=async(t,key,value,revision,req=id,scope='device')=>(await db.query('select public.mindex_state_write_v1($1,$2,$3,$4,$5,$6) data',[t,scope,key,value,revision,req])).rows[0].data;
 assert.equal((await put(token,'mindex.draft','private','0')).revision,'1');
 assert.deepEqual(await read(other),[]);assert.equal((await read(token))[0].value,'private');
 assert.equal((await put(token,'mindex.draft','private','0')).revision,'1');
 await assert.rejects(put(token,'mindex.draft','different','0'),/REUSED/);
 await assert.rejects(put(token,'mindex.draft','private','1'),/REUSED/);
 await assert.rejects(put(token,'mindex.draft','stale','0','22222222-2222-4222-8222-222222222222'),/CONFLICT/);
 await assert.rejects(put(token,'mindex.draft','public','0',id,'shared'),/PRIVATE_STATE_REQUIRED/);
 await assert.rejects(db.query('select * from mindex_state_private.entries'),/permission denied/);
 await assert.rejects(put('short','mindex.draft','x','0'),/INVALID_STATE_SCOPE/);
 await assert.rejects(put(token,'mindex.auth.token','secret','0'),/INVALID_STATE_VALUE/);
 assert.equal((await put(null,'mindex.music.fadeStop','true','0',id,'shared')).value,'true');
 console.log('PASS PostgreSQL private namespace isolation, table access denied, idempotent replay, revision conflict, private/shared boundary and credential rejection');
}finally{await db.close()}
