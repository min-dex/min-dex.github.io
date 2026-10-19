import assert from 'node:assert/strict';
import { createWorshipStore } from '../mindex.worship-store.mjs';
const memory = new Map();
const journal = {getItem:key=>memory.get(key) || null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
const methods={create:'create',save:'save',delete:'delete'};
const aggregate = revision => ({revision,service:{id:'service'},sections:[],elements:[],slides:[]});
let rpcCalls=0, captured, respond;
const store=createWorshipStore({journal,methods,makeId:()=>`request-${rpcCalls}`,
  rpc:async(name,{req})=>{ rpcCalls++; captured=req; return new Promise(resolve=>{respond=resolve;}); }});
store.acceptRead('service',aggregate('1'));
const draft={serviceId:'service',expectedRevision:'1',document:{sourceText:'before'}};
const first=store.save('save',draft);
draft.document.sourceText='newer unsaved edit';
await new Promise(setImmediate);
assert.equal(captured.document.sourceText,'before');
await assert.rejects(store.retry('service'),/SAVE_IN_PROGRESS/);
respond({error:new Error('network outcome unknown')});
await assert.rejects(first,/network outcome unknown/);
const pending=store.pending('service');
assert.equal(pending.request.document.sourceText,'before');
await assert.rejects(store.save('save',draft),/PENDING_REQUEST/);
assert.equal(rpcCalls,1);
const retried=store.retry('service');
assert.deepEqual(captured,pending.request);
respond({data:{replayed:true,committedRevision:'2',aggregate:aggregate('2')}});
await retried;
assert.equal(store.pending('service'),null);
assert.equal(draft.document.sourceText,'newer unsaved edit');
store.acceptRead('service',aggregate('5'));
store.acceptRead('service',aggregate('3'));
assert.equal(store.baseline('service').revision,'5');
console.log('PASS frozen retry, no replacement while uncertain, unchanged draft and monotonic baseline');

const second=store.save('save',{...draft,expectedRevision:'5'});
await new Promise(setImmediate);
const older=store.pending('service');
const newer={...older,request:{...older.request,requestId:'other-tab'}};
journal.setItem('mindex.atomic.pending.v1:service',JSON.stringify(newer));
respond({data:{replayed:false,committedRevision:'6',aggregate:aggregate('6')}});
await second;
assert.equal(store.pending('service').request.requestId,'other-tab');
await assert.rejects(store.resolvePending('service','wrong'),/REQUEST_ID_MISMATCH/);
await store.resolvePending('service','other-tab');
console.log('PASS late response cannot clear another tab request');

let contacted=false;
const quota=createWorshipStore({journal:{...journal,setItem:()=>{throw new Error('quota');}},methods,
  rpc:async()=>{contacted=true;}});
quota.acceptRead('service',aggregate('1'));
await assert.rejects(quota.save('save',{serviceId:'service',expectedRevision:'1'}),error=>error.message==='JOURNAL_NOT_CONFIRMED' && error.cause.message==='quota');
assert.equal(contacted,false);
console.log('PASS journal quota failure prevents network write');

let sent;
const reload=createWorshipStore({journal,methods,rpc:async(name,{req})=>{
  sent=req; return {data:{replayed:true,committedRevision:'7',aggregate:aggregate('8')}};
}});
journal.setItem('mindex.atomic.pending.v1:service',JSON.stringify(older));
await reload.retry('service');
assert.deepEqual(sent,older.request);
assert.equal(reload.baseline('service').revision,'8');
console.log('PASS journal survives client recreation and accepts latest-state replay');
const deletedStore=createWorshipStore({journal,methods,rpc:async()=>({data:{
  replayed:true,committedRevision:'2',currentRevision:'10',aggregate:null,deleted:true,
}})});
deletedStore.acceptRead('service',aggregate('9'));
journal.setItem('mindex.atomic.pending.v1:service',JSON.stringify(older));
await deletedStore.retry('service');
assert.equal(deletedStore.baseline('service').deleted,true);
assert.equal(deletedStore.baseline('service').revision,'10');
deletedStore.acceptRead('service',aggregate('9'));
assert.equal(deletedStore.baseline('service').deleted,true);
console.log('PASS pre-deletion receipt observes the latest tombstone revision');

// A server journal must finish before the worship write is dispatched.
let releaseJournal, journalAttempts=0, serverCalls=0;
const asyncMemory=new Map();
const asyncJournal={getItem:k=>asyncMemory.get(k)||null,
 setItem:(k,v)=>new Promise(resolve=>{journalAttempts++;releaseJournal=()=>{asyncMemory.set(k,v);resolve()}}),
 removeItem:async()=>{throw {code:'P0001',message:'state revision conflict'}}};
const asyncStore=createWorshipStore({journal:asyncJournal,methods,rpc:async()=>{
 serverCalls++;return {data:{replayed:false,committedRevision:'2',aggregate:aggregate('2')}};
}});
asyncStore.acceptRead('service',aggregate('1'));
const delayed=asyncStore.save('save',{serviceId:'service',expectedRevision:'1'});
assert.equal(serverCalls,0);
await assert.rejects(asyncStore.save('save',{serviceId:'service',expectedRevision:'1'}),/PENDING_REQUEST/);
await assert.rejects(asyncStore.retry('service'),/SAVE_IN_PROGRESS/);
assert.equal(journalAttempts,1);releaseJournal();
await assert.rejects(delayed,e=>e.message==='JOURNAL_NOT_CONFIRMED'&&!e.code&&e.cause.code==='P0001');
assert.equal(serverCalls,1);assert.ok(asyncStore.pending('service'));
assert.equal(asyncStore.baseline('service').revision,'2');
console.log('PASS confirmed async journal before RPC, concurrent save exclusion, cleanup failure retains replay without masquerading as worship rollback');
