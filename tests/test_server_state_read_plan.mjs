import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb({requirePostgres:true});
try {
 await db.exec('create role anon;create role authenticated;create schema extensions;create extension pgcrypto with schema extensions;');
 await db.exec(await fs.readFile(new URL('../migrations/2026-10-19-server-client-state.sql',import.meta.url),'utf8'));
 await db.exec("set work_mem='4MB'");
 const token='a'.repeat(64), other='b'.repeat(64);
 await db.query(`insert into mindex_state_private.entries(owner_hash,scope,key,value,revision,request_id,request_digest)
 select mindex_state_private.owner($1,'device'),'device','mindex.plan.'||lpad(i::text,4,'0'),
 case when i=0 then null else repeat('synthetic recovery ',58000) end,1,
 '11111111-1111-4111-8111-111111111111','fixture' from generate_series(0,10) i`,[token]);
 const snapshot=()=>db.query(`select md5(jsonb_agg(to_jsonb(e) order by owner_hash,scope,key)::text) as hash from mindex_state_private.entries e`);
 const attributes=()=>db.query(`select proowner,proacl,prosrc,proconfig,prosecdef,provolatile from pg_proc where oid='public.mindex_state_read_v1(text,text)'::regprocedure`);
 const initialRows=await snapshot(),initialAttrs=(await attributes()).rows[0];
 // Scalar RPC wrapper used by PostgREST. VOLATILE forces this CTE to disk;
 // a truly read-only STABLE function permits inlining without changing results.
 const rpc=`with pgrst_source as (
 select pgrst_call.pgrst_scalar from(select $1::json as json_data) payload,
 lateral(select p_token,p_scope from json_to_record(payload.json_data) as _(p_token text,p_scope text) limit 1) body,
 lateral(select public.mindex_state_read_v1(body.p_token,body.p_scope) as pgrst_scalar) pgrst_call)
 select coalesce(json_agg(t.pgrst_scalar)->0,'null') as body from(select * from pgrst_source limit 1 offset 0) t`;
 const args=[JSON.stringify({p_token:token,p_scope:'device'})];
 const plan=async()=> (await db.query('explain(analyze,buffers,format json) '+rpc,args)).rows[0]['QUERY PLAN'][0];
 const read=async()=> (await db.query(rpc,args)).rows[0].body;
 await db.exec('set role anon');
 const beforePlan=await plan(),before=await read();
 assert.ok(beforePlan.Plan['Temp Written Blocks']>1000,'large VOLATILE scalar must reproduce disk spill');
 await db.exec('reset role');
 const migration=await fs.readFile(new URL('../migrations/2026-10-25-state-read-stable.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 const afterAttrs=(await attributes()).rows[0];
 assert.deepEqual({...afterAttrs,provolatile:initialAttrs.provolatile},initialAttrs);
 assert.equal(afterAttrs.provolatile,'s');assert.deepEqual(await snapshot(),initialRows);
 await db.exec('set role anon');
 const afterPlan=await plan(),after=await read();
 assert.deepEqual(after,before);assert.equal(afterPlan.Plan['Temp Written Blocks'],0);
 assert.equal(after.length,11);assert.equal(after[0].value,null);
 assert.deepEqual((await db.query('select public.mindex_state_read_v1($1,$2) as data',[other,'device'])).rows[0].data,[]);
 await assert.rejects(db.query('select * from mindex_state_private.entries'),/permission denied/);
 await assert.rejects(db.query("select public.mindex_state_read_v1('bad','device')"),/INVALID_STATE_SCOPE/);
 // Writes and replay/CAS keep their existing behavior after the read-only change.
 const key=after[1].key,req='22222222-2222-4222-8222-222222222222';
 const put=()=>db.query('select public.mindex_state_write_v1($1,$2,$3,$4,$5,$6) as data',[token,'device',key,'updated','1',req]);
 assert.equal((await put()).rows[0].data.revision,'2');assert.equal((await put()).rows[0].data.revision,'2');
 assert.equal((await read()).find(x=>x.key===key).value,'updated');
 await db.exec('reset role');
 const current=await read();
 await db.exec('alter function public.mindex_state_read_v1(text,text) volatile');
 assert.deepEqual(await read(),current); // exact rollback needs no data restore
 await db.exec(migration);assert.deepEqual(await read(),current);
 console.log(JSON.stringify({result:'PASS',oldTempBlocks:beforePlan.Plan['Temp Written Blocks'],newTempBlocks:afterPlan.Plan['Temp Written Blocks'],oldMs:beforePlan['Execution Time'],newMs:afterPlan['Execution Time'],unchanged:['ordered output','tombstones','owner isolation','ACL','body','rows','CAS','replay'],rollback:'PASS'}));
} finally {await db.close()}
