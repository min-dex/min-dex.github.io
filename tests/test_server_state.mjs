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
