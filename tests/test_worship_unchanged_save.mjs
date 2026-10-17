import assert from 'node:assert/strict';
import {createWorshipAtomicClient} from '../mindex.worship-atomic-client.mjs';
const base={revision:'1',service:{id:'s',title:'Service',source_ref:{keep:{a:1,b:2},mindexServiceDocument:{sourceText:'lyrics',updatedAt:'old',contentSignature:'ordered'}}},sections:[{id:'sec',service_id:'s',title:'Praise'}],elements:[{id:'e',section_id:'sec',sort_order:10,song_id:'song',song_version_id:'version',config:{form:['V','C'],medley:['e','f']}}]};
const makeInput=()=>({serviceId:'s',rows:{sections:structuredClone(base.sections),elements:structuredClone(base.elements)},metadata:{title:'Service',source_ref:{keep:{b:2,a:1}}},document:{contentSignature:'ordered',updatedAt:'new',sourceText:'lyrics'}});
let calls=0,fail=false;const memory=new Map();
const client=createWorshipAtomicClient({journal:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},rpc:async(name)=>{
 if(name==='get_worship_service_v1')return {data:structuredClone(base)};
 calls++;if(fail)throw Error('network');return {error:{code:'P0001',message:'REVISION_CONFLICT'}};
}});
await client.read('s');
const saved=await client.commit(makeInput());assert.equal(calls,0);assert.equal(memory.size,0);saved.elements[0].song_id='mutated';assert.equal(client.baseline('s').elements[0].song_id,'song');
const cases=[x=>x.rows.elements[0].song_id='new',x=>x.rows.elements[0].song_version_id=null,x=>x.rows.elements[0].sort_order=20,x=>x.rows.elements[0].config.medley.reverse(),x=>x.rows.elements[0].config.form.push('V'),x=>x.document.sourceText='edited lyrics',x=>x.metadata.title='new title',x=>{x.rows.elements=[];x.deleteElementIds=['e']},x=>delete x.rows.elements[0].config.form];
for(const change of cases){await client.read('s');const x=makeInput();change(x);const before=calls;await assert.rejects(client.commit(x),e=>e.message==='REVISION_CONFLICT');assert.equal(calls,before+1);await assert.rejects(client.commit(makeInput()),/RELOAD_REQUIRED/)}
await client.read('s');fail=true;const x=makeInput();x.document.sourceText='draft';await assert.rejects(client.commit(x),/network/);const before=calls;await assert.rejects(client.commit(makeInput()),/network/);assert.equal(calls,before+1);assert.ok(client.pending('s'));
console.log('PASS unchanged save skips RPC; edited lyrics/links/forms/order/deletions, conflict and pending retry remain guarded');
