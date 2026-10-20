import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
import {createServerState} from '../mindex.server-state.mjs';
import {createWorshipStore} from '../mindex.worship-store.mjs';
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
 // The real client uses the project URL inside its atomic journal identifier.
 const project='https://fixtureproject.supabase.co',serviceId='33333333-3333-4333-8333-333333333333';
 const journalKey=`mindex.atomic.pending.v2:${JSON.stringify([project,serviceId])}`;
 await assert.rejects(put(token,journalKey,'request','0'),/INVALID_STATE_VALUE/);
 // Exercise the actual server-state and worship-store chain, not only a copied key.
 const stateRpc=async(name,args)=>{
  try{return {data:name==='mindex_state_read_v1'?await read(args.p_token):
   await put(args.p_token,args.p_key,args.p_value,args.p_revision,args.p_request_id,args.p_scope)}}
  catch(error){return {error}}
 };
 const server=createServerState({rpc:stateRpc,token,scope:'device'});await server.load();
 let writes=0;
 const worship=createWorshipStore({namespace:project,journal:server,methods:{save:'fixture_save'},rpc:async()=>{
  writes++;
  assert.ok(JSON.parse(server.getItem(journalKey)).request.requestId);
  return {data:{replayed:false,committedRevision:'2',deleted:false,aggregate:{service:{id:serviceId},revision:'2'}}};
 }});
 worship.acceptRead(serviceId,{service:{id:serviceId},revision:'1'});
 await assert.rejects(worship.save('save',{serviceId,expectedRevision:'1'}),
  error=>error.message==='JOURNAL_NOT_CONFIRMED'&&error.cause.message==='INVALID_STATE_VALUE');
 assert.equal(writes,0);
 assert.deepEqual(server.pendingKeys(),[journalKey]);
 await db.exec('reset role');
 const migration=await fs.readFile(new URL('../migrations/2026-10-21-state-journal-project-key.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration); // safe deployment replay
 await db.exec('set role anon');
 await server.retry(journalKey); // same request, no deletion or new identity
 const pendingId=worship.pending(serviceId).request.requestId;
 await server.load();
 assert.equal(worship.pending(serviceId).request.requestId,pendingId);
 await worship.retry(serviceId);
 assert.equal(writes,1);assert.equal(server.getItem(journalKey),null);
 assert.equal((await read(token)).find(row=>row.key===journalKey).value,null);
 const creationKey=`mindex.atomic.creation.v1:${project}:${JSON.stringify({date:'2026-10-25',type:'youth'})}`;
 assert.equal((await put(token,creationKey,serviceId,'0')).value,serviceId);
 for(const key of ['mindex.supabase.anonKey','mindex.auth.token','mindex.credential','mindex.monitor.deviceReporter',
  journalKey+':auth',journalKey+':supabase.anonKey','mindex.other:https://fixtureproject.supabase.co',
  'mindex.atomic.creation.v1:https://fixtureproject.supabase.co.evil:auth']){
  await assert.rejects(put(token,key,'secret','0'),/INVALID_STATE_VALUE/);
 }
 await assert.rejects(put(token,journalKey,'x','0',id,'shared'),/PRIVATE_STATE_REQUIRED/);
 await assert.rejects(db.query('select * from mindex_state_private.entries'),/permission denied/);
 assert.deepEqual(await read(other),[]);
 assert.equal((await put(null,'mindex.music.fadeStop','true','0',id,'shared')).value,'true');
 console.log('PASS PostgreSQL: original JOURNAL_NOT_CONFIRMED reproduced; same pending request recovered after migration; creation key, cleanup, isolation, CAS and secret-key guards preserved');
}finally{await db.close()}
