const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,document:{addEventListener(){},querySelectorAll(){return []}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:require('node:crypto').webcrypto};c.window=c;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.constants.js','mindex.worship-model.js','mindex.presenter.js','mindex.worship-input.js','mindex.worship-persistence.js','mindex.setlist-links.js','mindex.bulletin.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.assert=assert;c.setImmediate=setImmediate;
(async()=>{try{await vm.runInContext(`(async()=>{
 state.config.authRequired=true;state.services=[{id:'live',praiseLeader:'old',leader:'old'}];
 state.worshipSetlistArchive={loaded:true,live:{services:[{id:'live',praise_leader:'old'}]},sources:[{id:'archive',leader:'old'}]};
 const db={mindex_worship_services:{id:'live',praise_leader:'old',worship_leader:'',other:'keep'},mindex_worship_import_sources:{id:'archive',updated_at:'v1',raw_payload:{other:'keep',service:{leader:'old',songs:['keep']}}}};
 let fail=false;let writes=0;const notifications=[];window.MINDEX_CONTENT_LIVE={publish:(kind,id)=>notifications.push({kind,id})};
 state.client={from(table){let patch=null;const filters=[];const q={update(p){patch=p;return q},select(){return q},eq(k,v){filters.push([k,v]);return q},single(){return Promise.resolve({data:db[table],error:null})},maybeSingle(){writes++;if(fail)return Promise.resolve({error:new Error('fixture failure')});const row=db[table];if(!filters.every(([k,v])=>row[k]===v))return Promise.resolve({data:null,error:null});Object.assign(row,patch);return Promise.resolve({data:row,error:null})}};return q}};
 worshipAtomicClient=async()=>({read:async()=>({service:{...db.mindex_worship_services,source_ref:{mindexServiceDocument:{sourceText:'Keep'}}},sections:[],elements:[]}),
   commit:async request=>{writes++;if(fail)throw Error('fixture failure');assert.equal(request.serviceId,'live');assert.deepEqual(Object.keys(request.metadata),['praise_leader']);assert.equal(request.rows.elements.length,0);Object.assign(db.mindex_worship_services,request.metadata);return {service:{...db.mindex_worship_services}};}});
 assert.match(renderWorshipSetlistLeaderEditor({id:'archive',leader:''}),/—/);
 assert.equal(await persistWorshipSetlistLeader('worship:live','  김광한   전도사 ','old'),'김광한 전도사');
 assert.equal(db.mindex_worship_services.other,'keep');assert.equal(db.mindex_worship_services.worship_leader,'');assert.equal(state.services[0].praiseLeader,'김광한 전도사');
 await assert.rejects(persistWorshipSetlistLeader('worship:live','bad','old'),/변경/);
 await persistWorshipSetlistLeader('archive','이재희 청년','old');assert.deepEqual(db.mindex_worship_import_sources.raw_payload.service.songs,['keep']);assert.equal(db.mindex_worship_import_sources.raw_payload.other,'keep');
 fail=true;await assert.rejects(persistWorshipSetlistLeader('archive','bad','이재희 청년'),/failure/);assert.equal(state.worshipSetlistArchive.sources[0].leader,'이재희 청년');fail=false;
 await persistWorshipSetlistLeader('archive','','이재희 청년');assert.equal(state.worshipSetlistArchive.sources[0].leader,'');
 renderCurrentServiceModuleDetail=()=>{throw new Error("Unexpected full rerender during leader save")};showToast=()=>{};
 worshipSetlistLeaderDrafts.set('archive',{original:'',value:'서영윤 선생님',saving:false});
 assert.equal(renderWorshipSetlistLeaderEditor({id:'archive',leader:''}).includes('data-setlist-leader-save'),false);
 await saveWorshipSetlistLeader('archive');assert.equal(db.mindex_worship_import_sources.raw_payload.service.leader,'서영윤 선생님');
 const beforeNoop=writes;worshipSetlistLeaderDrafts.set('archive',{original:'서영윤 선생님',value:'서영윤 선생님',saving:false});await saveWorshipSetlistLeader('archive');assert.equal(writes,beforeNoop);
 fail=true;worshipSetlistLeaderDrafts.set('archive',{original:'서영윤 선생님',value:'보존할 이름',saving:false});await saveWorshipSetlistLeader('archive');assert.equal(worshipSetlistLeaderDrafts.get('archive').value,'보존할 이름');assert.equal(worshipSetlistLeaderDrafts.get('archive').saving,false);

 assert.equal(notifications.length,4);assert.ok(notifications.every(m=>m.kind==='setlist-archive'&&m.id==='all'));
 fail=false;await saveWorshipSetlistLeader('archive');assert.equal(db.mindex_worship_import_sources.raw_payload.service.leader,'보존할 이름');
 worshipSetlistLeaderDrafts.set('archive',{original:'보존할 이름',value:'',saving:false});await saveWorshipSetlistLeader('archive');assert.equal(db.mindex_worship_import_sources.raw_payload.service.leader,'');assert.match(renderWorshipSetlistLeaderEditor({id:'archive',leader:db.mindex_worship_import_sources.raw_payload.service.leader}),/value=""/);
 fail=true;worshipSetlistLeaderDrafts.set('archive',{original:'',value:'실패 직전',saving:false});await saveWorshipSetlistLeader('archive');worshipSetlistLeaderDrafts.get('archive').value='실패 후 추가 입력';fail=false;await saveWorshipSetlistLeader('archive');assert.equal(db.mindex_worship_import_sources.raw_payload.service.leader,'실패 후 추가 입력');
 console.log('PASS clear/reopen and rollback failure -> additional input -> retry');
 const originalClient=state.client;
 state.client={from(table){const q=originalClient.from(table),original=q.maybeSingle;q.maybeSingle=async()=>{await original();throw Error('lost acknowledgement')};return q}};
 worshipSetlistLeaderDrafts.set('archive',{original:'실패 후 추가 입력',value:'',saving:false});await saveWorshipSetlistLeader('archive');assert.equal(db.mindex_worship_import_sources.raw_payload.service.leader,'');assert.equal(worshipSetlistLeaderDrafts.get('archive').value,'');
 state.client=originalClient;let retryError='';showToast=x=>retryError=x;await saveWorshipSetlistLeader('archive');assert.equal(worshipSetlistLeaderDrafts.has('archive'),false);assert.equal(retryError,'');
 console.log('PASS archive lost acknowledgement resolved by readback without duplicate write');
 let releaseCommit;worshipAtomicClient=async()=>({read:async()=>({service:{...db.mindex_worship_services,source_ref:{mindexServiceDocument:{sourceText:'Keep'}}},sections:[],elements:[]}),commit:request=>new Promise(resolve=>{releaseCommit=()=>{Object.assign(db.mindex_worship_services,request.metadata);resolve({service:{...db.mindex_worship_services}})}})});
 const saving=persistWorshipSetlistLeader('worship:live','',db.mindex_worship_services.praise_leader);await new Promise(setImmediate);
 state.services[0].leader='다른 편집창 추가 입력';state.services[0].praiseLeader='다른 편집창 추가 입력';releaseCommit();await saving;
 assert.equal(state.services[0].leader,'다른 편집창 추가 입력');assert.equal(state.services[0].praiseLeader,'다른 편집창 추가 입력');
 console.log('PASS live completion preserves newer service editor input');
 let pending=null;let lose=true;let replayCount=0;
 worshipAtomicClient=async()=>({pending:()=>pending,read:async()=>({service:{...db.mindex_worship_services,source_ref:{mindexServiceDocument:{sourceText:'Keep'}}},sections:[],elements:[]}),commit:async request=>{
  if(pending){replayCount++;pending=null;throw Error('ATOMIC_RETRY_COMMITTED_RELOAD_REQUIRED')}
  Object.assign(db.mindex_worship_services,request.metadata);
  if(lose){pending={request:{requestId:'owned-attempt'}};throw Error('lost acknowledgement')}
  return {service:{...db.mindex_worship_services}};
 }});
 worshipSetlistLeaderDrafts.set('worship:live',{original:'',value:'첫 시도',saving:false});await saveWorshipSetlistLeader('worship:live');
 assert.equal(worshipSetlistLeaderDrafts.get('worship:live').retry.requestId,'owned-attempt');
 worshipSetlistLeaderDrafts.get('worship:live').value='추가 입력';lose=false;await saveWorshipSetlistLeader('worship:live');assert.equal(replayCount,1);assert.equal(db.mindex_worship_services.praise_leader,'추가 입력');assert.equal(worshipSetlistLeaderDrafts.has('worship:live'),false);
 pending={request:{requestId:'unrelated'}};await assert.rejects(persistWorshipSetlistLeader('worship:live','x','추가 입력'),/이전 예배 저장/);assert.equal(replayCount,1);
 console.log('PASS owned atomic replay before newer input, unrelated pending request protected');

 pending=null;fail=false;let conflictMessage='';showToast=x=>conflictMessage=x;
 for (const id of ['archive','worship:live']) {
   const get=()=>id==='archive'?db.mindex_worship_import_sources.raw_payload.service.leader:db.mindex_worship_services.praise_leader;
   const set=value=>{if(id==='archive')db.mindex_worship_import_sources.raw_payload.service.leader=value;else db.mindex_worship_services.praise_leader=value};
   worshipSetlistLeaderDrafts.set(id,{original:get(),value:'탭 A 입력',saving:false});set('탭 B 저장');
   await saveWorshipSetlistLeader(id);assert.equal(get(),'탭 B 저장');assert.equal(worshipSetlistLeaderDrafts.get(id).value,'탭 A 입력');assert.equal(worshipSetlistLeaderDrafts.get(id).retry,undefined);
   worshipSetlistLeaderDrafts.get(id).value='탭 B 저장';await saveWorshipSetlistLeader(id);assert.equal(worshipSetlistLeaderDrafts.has(id),false);
 }
 console.log('PASS cross-tab conflict preserves both names; edited retry acknowledges current server name');

})()`,c);}catch(e){console.error(e);process.exitCode=1}})();
