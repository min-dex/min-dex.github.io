import assert from 'node:assert/strict';
import {createServerState} from '../mindex.server-state.mjs';
let calls=0,fail=false,lose=false,invalid=false;const db=new Map();
const rpc=async(name,args)=>{
 calls++;
 if(name==='mindex_state_read_v1')return {data:invalid?null:[...db.values()]};
 if(fail)return {error:Error('Offline')};
 const old=db.get(args.p_key);
 if(old?.requestId===args.p_request_id)return {data:old};
 if((old?.revision||'0')!==args.p_revision)return {error:Error('STATE_REVISION_CONFLICT')};
 const row={key:args.p_key,value:args.p_value,revision:String(BigInt(args.p_revision)+1n),requestId:args.p_request_id};db.set(row.key,row);
 if(lose){lose=false;throw Error('Response lost')};return {data:row};
};
const create=()=>createServerState({rpc,token:'fixture',scope:'device'});
const a=create();assert.throws(()=>a.getItem('mindex.draft'),/NOT_READY/);
await a.load();fail=true;await assert.rejects(a.setItem('mindex.draft','draft'),/Offline/);
assert.equal(a.getItem('mindex.draft'),null);assert.equal(a.pending,true);
await assert.rejects(a.setItem('mindex.draft','new'),/RETRY_REQUIRED/);
fail=false;await a.retry('mindex.draft');assert.equal(a.getItem('mindex.draft'),'draft');
lose=true;await assert.rejects(a.setItem('mindex.draft','second'),/Response lost/);
assert.equal(a.getItem('mindex.draft'),'draft');await a.retry('mindex.draft');assert.equal(a.getItem('mindex.draft'),'second');assert.equal(db.get('mindex.draft').revision,'2');
const b=create();await b.load();await a.setItem('mindex.draft','third');await assert.rejects(b.setItem('mindex.draft','stale'),/CONFLICT/);assert.equal(db.get('mindex.draft').value,'third');
await a.removeItem('mindex.draft');assert.equal(a.getItem('mindex.draft'),null);assert.equal(db.get('mindex.draft').revision,'4');
const n=calls;await a.removeItem('mindex.draft');assert.equal(calls,n);
invalid=true;await assert.rejects(a.load(),/INVALID_STATE_RESPONSE/);assert.equal(a.getItem('mindex.draft'),null);
console.log('PASS confirmed writes only, failure retention, durable replay identity, stale writer conflict, tombstone revision, no-op and malformed reads');

invalid=false;const confirmed=db.get('mindex.draft');
db.set('mindex.draft',{...confirmed,revision:'1'});
await assert.rejects(a.load(),/STALE_STATE_RESPONSE/);assert.equal(a.getItem('mindex.draft'),null);
db.set('mindex.draft',confirmed);await a.load();
console.log('PASS older server reads cannot roll back a confirmed mirror');

// A write started during refresh must use the new confirmed revision.
let finishRead;let waiting=false;
const delayed=createServerState({token:'fixture',scope:'device',rpc:async(name,args)=>{
 if(name==='mindex_state_read_v1'&&waiting)await new Promise(resolve=>finishRead=resolve);
 return rpc(name,args);
}});
await delayed.load();await a.setItem('mindex.draft','external');waiting=true;
const reading=delayed.load(),writing=delayed.setItem('mindex.draft','after refresh');
await new Promise(setImmediate);finishRead();await Promise.all([reading,writing]);
assert.equal(db.get('mindex.draft').value,'after refresh');
console.log('PASS refresh/write overlap uses the newly confirmed revision');

// Stale tombstone revisions are not conflicting content. Rebase only after
// the server explicitly rejects the CAS and confirms the original value.
const j1=create(),j2=create();await j1.load();await j2.load();
await j1.setItem('journal','old');await j1.removeItem('journal');
await j2.setItem('journal','new');assert.equal(db.get('journal').value,'new');
const j3=create();await j3.load();await j2.removeItem('journal');
await j3.removeItem('journal');assert.equal(j3.getItem('journal'),null);assert.equal(j3.pending,false);
const j4=create();await j4.load();await j3.setItem('journal','other request');
await assert.rejects(j4.setItem('journal','my request'),/CONFLICT/);
assert.equal(j4.pending,true);assert.equal(db.get('journal').value,'other request');
await assert.rejects(j4.retry('journal'),/CONFLICT/);
assert.equal(db.get('journal').value,'other request');
console.log('PASS stale tombstone recovery, identical cleanup, real journal conflict retention');

// Explicit conflicts expose only application values, never capability tokens.
const review=await j4.reviewConflict('journal');
assert.equal(review.local,'my request');assert.equal(review.current,'other request');assert.equal(review.p_token,undefined);
await j4.resolveConflict(review,'local');assert.equal(db.get('journal').value,'my request');assert.equal(j4.pending,false);
const c1=create(),c2=create();await c1.load();await c2.load();
await c1.setItem('mindex.atomic.pending.v2:x','other');
await assert.rejects(c2.setItem('mindex.atomic.pending.v2:x','mine'),/CONFLICT/);
const atomicReview=await c2.reviewConflict('mindex.atomic.pending.v2:x');
await assert.rejects(c2.resolveConflict(atomicReview,'local'),/ATOMIC_REQUEST/);
await c1.setItem('mindex.atomic.pending.v2:x','newer');
await assert.rejects(c2.resolveConflict(atomicReview,'current'),/CONFLICT_CHANGED/);
await c2.resolveConflict(await c2.reviewConflict('mindex.atomic.pending.v2:x'),'current');
assert.equal(c2.getItem('mindex.atomic.pending.v2:x'),'newer');assert.equal(c2.pending,false);
lose=true;await assert.rejects(c2.setItem('network','unknown'),/Response lost/);
await assert.rejects(c2.reviewConflict('network'),/NOT_CONFIRMED/);await c2.retry('network');
console.log('PASS explicit conflict choices, stale review guard, atomic request protection and unknown network identity');
