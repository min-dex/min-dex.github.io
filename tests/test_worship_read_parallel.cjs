const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const start=source.indexOf('async function fetchWorshipRowsForServiceIds(');
let requests=[],drafts=new Set();
const context=vm.createContext({state:{services:[],loadedWorshipServiceIds:new Set()},
 chunkArray:(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n)),
 sundayEditSyncHasLocalDraft:id=>drafts.has(id),normalizeWorshipService:s=>s,
 worshipAtomicClient:async()=>({read:(id,options)=>new Promise((resolve,reject)=>requests.push({id,options,resolve,reject}))})});
vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),context);
const tick=()=>new Promise(r=>setImmediate(r));
const answer=(r)=>{r.adopted=r.options.adopt();r.resolve({service:{id:r.id,title:'remote'},sections:[{id:r.id}],elements:[{id:r.id}]})};
(async()=>{
 context.state.services=['a','b','c','d'].map(id=>({id,title:'local'}));
 const task=context.fetchWorshipRowsForServiceIds(['a','b','a','','c','d']);await tick();
 assert.deepEqual(requests.map(r=>r.id),['a','b','c']);
 drafts.add('b');context.state.loadedWorshipServiceIds.add('c');
 answer(requests[2]);answer(requests[1]);await tick();assert.equal(requests.length,3);
 answer(requests[0]);await tick();assert.equal(requests.length,4);answer(requests[3]);
 const result=await task;assert.equal(JSON.stringify(result.sections),JSON.stringify(['a','b','c','d'].map(id=>({id}))));
 assert.deepEqual(requests.map(r=>r.adopted),[true,false,false,true]);
 assert.equal(context.state.services[1].title,'local');assert.equal(context.state.services[2].title,'local');
 assert.equal(context.state.services[0].title,'remote');
 requests=[];let settled=false;
 const failure=context.fetchWorshipRowsForServiceIds(['a','b','c','d']).then(()=>{throw Error('must fail')},e=>{assert.equal(e.message,'read failed');settled=true});await tick();
 requests[0].reject(Error('read failed'));await tick();assert.equal(settled,false);
 answer(requests[1]);await tick();assert.equal(settled,false);answer(requests[2]);await failure;
 assert.equal(requests.length,3,'no later group after failure');
 requests=[];const retry=context.fetchWorshipRowsForServiceIds(['a']);await tick();answer(requests[0]);await retry;
 assert.equal((await context.fetchWorshipRowsForServiceIds([])).elements.length,0);
 console.log('PASS bounded concurrent reads, deterministic order, deduplication, late draft guards, settlement barrier and retry');
})().catch(e=>{console.error(e);process.exitCode=1});
