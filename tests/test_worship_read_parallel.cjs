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
 answer(requests[2]);await tick();assert.equal(requests.length,4,'next read starts while slow first read is pending');
 answer(requests[3]);answer(requests[1]);await tick();
 assert.equal(context.state.services[0].title,'local','do not publish partially assembled metadata');
 answer(requests[0]);
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
 // A draft beginning after its own read settles must still protect metadata.
 requests=[];drafts.clear();context.state.loadedWorshipServiceIds.clear();
 context.state.services=['x','y','z','w','v'].map(id=>({id,title:'local'}));
 const late=context.fetchWorshipRowsForServiceIds(['x','y','z','w','v']);await tick();
 answer(requests[1]);await tick();assert.equal(requests.length,4);
 drafts.add('y');answer(requests[3]);await tick();assert.equal(requests.length,5);
 answer(requests[4]);answer(requests[2]);answer(requests[0]);
 const ordered=await late;
 assert.equal(JSON.stringify(ordered.elements),JSON.stringify(['x','y','z','w','v'].map(id=>({id}))));
 assert.equal(context.state.services[1].title,'local');
 // Failure after refilling a slot still waits for all started reads, with no fifth.
 requests=[];settled=false;
 const lateFailure=context.fetchWorshipRowsForServiceIds(['x','y','z','w','v']).catch(e=>{assert.equal(e.message,'late failed');settled=true});await tick();
 answer(requests[1]);await tick();assert.equal(requests.length,4);
 requests[3].reject(Error('late failed'));await tick();assert.equal(settled,false);
 answer(requests[2]);await tick();assert.equal(settled,false);
 answer(requests[0]);await lateFailure;assert.equal(requests.length,4);
 // Deterministic latency model: one 300ms read and six 30ms reads.
 // The former 3+3+1 batch barrier took 360ms; free slots finish in 300ms.
 requests=[];let clock=0;
 const durations=[300,30,30,30,30,30,30], pending=new Map();
 const simulated=context.fetchWorshipRowsForServiceIds(['0','1','2','3','4','5','6']);await tick();
 let observed=0;
 while (observed<7 || pending.size) {
   for (;observed<requests.length;observed++) pending.set(requests[observed],clock+durations[Number(requests[observed].id)]);
   assert.ok(pending.size<=3,'maximum concurrent DB reads remains three');
   clock=Math.min(...pending.values());
   for (const [request,due] of pending) if(due===clock){pending.delete(request);answer(request);}
   await tick();
 }
 await simulated;assert.equal(clock,300);
 console.log('PASS bounded concurrent reads, deterministic order, deduplication, late draft guards, settlement barrier and retry');
})().catch(e=>{console.error(e);process.exitCode=1});
