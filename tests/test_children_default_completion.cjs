const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,document:{addEventListener(){}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:require('node:crypto').webcrypto};c.window=c;c.__mindexRuntimeStarted=true;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.constants.js','mindex.inline-text.js','mindex.worship-model.js','mindex.worship-persistence.js','mindex.presenter.js','mindex.presenter-praise.js','mindex.presenter-board.js','mindex.presenter-controller.js','mindex.presenter-ui.js','mindex.worship-input.js','mindex.worship-source.js','mindex.setlist-links.js','mindex.bulletin.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.assert=assert;
(async()=>{try{await vm.runInContext(`(async()=>{
const clone=value=>JSON.parse(JSON.stringify(value));
const sid='10000000-0000-4000-8000-000000000001';
const raw={id:sid,service_type_id:'children',service_date:'2099-11-01',source_ref:{created_from:'mindex_template'}};
const baseline={revision:'2',service:raw,slides:[],sections:[
{id:'20000000-0000-4000-8000-000000000001',service_id:sid,sort_order:1,section_key:'offering',title:'봉헌',config:{keep:'offering'}},
{id:'20000000-0000-4000-8000-000000000002',service_id:sid,sort_order:2,section_key:'announcements',title:'광고',config:{keep:'ads'}}],elements:[
{id:'30000000-0000-4000-8000-000000000001',section_id:'20000000-0000-4000-8000-000000000001',sort_order:1,element_type:'title_person',input_mode:'text',person:'기존 담당',source_ref:{label:'봉헌기도'},config:{note:'보존'}},
{id:'30000000-0000-4000-8000-000000000002',section_id:'20000000-0000-4000-8000-000000000002',sort_order:1,element_type:'plain_text',input_mode:'text',body:'기존 광고',source_ref:{label:'광고'},config:{announcementRegions:{welcome:'기존 환영',news:'기존 소식',footer:'기존 하단'},unknown:{keep:true}}}]};
const service=normalizeWorshipService(raw),before=JSON.stringify(baseline);
assert(worshipDefaultOrderSeedEligible(baseline));
const rows=completeWorshipDefaultOrderSeed(baseline,buildWorshipServiceScaffold(sid,'children',{service}));
assert.equal(rows.sections.length,12);assert.equal(rows.elements.length,17);
for(const old of baseline.elements)assert.deepEqual({...rows.elements.find(e=>e.id===old.id),sort_order:old.sort_order},old);
for(const old of baseline.sections)assert.deepEqual({...rows.sections.find(s=>s.id===old.id),sort_order:old.sort_order},old);
assert.equal(JSON.stringify(baseline),before);
for(const altered of [
{...baseline,service:{...raw,service_type_id:'youth'}},
{...baseline,service:{...raw,source_ref:{created_from:'custom'}}},
{...baseline,elements:[...baseline.elements,{...baseline.elements[0],id:'another'}]},
{...baseline,elements:baseline.elements.map((e,i)=>i?e:{...e,config:{templateSuppressed:true}})},
{...baseline,elements:baseline.elements.map((e,i)=>i?e:{...e,content_state:{hiddenInPresentation:true}})}])assert(!worshipDefaultOrderSeedEligible(altered));
let reads=0,mode='',output=false;
reconcileDirtyState=()=>{};serviceHasPendingTextEdits=()=>false;isPresenterOutputWindowOpen=()=>output;
renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};updateSaveState=()=>{};showToast=()=>{};
refreshPresenterForService=(_id,options)=>assert.equal(options.publish,false,'Completion must not publish');
worshipAtomicClient=async()=>({pending:()=>mode==='pending'?{}:null,baseline:()=>clone(baseline),read:async()=>{reads++;if(mode==='read-failure')throw Error('network');if(mode==='input-race')state.serviceItems[sid][0].assignee='새 입력';if(mode==='service-race')state.selectedServiceId='other';return mode==='revision-race'?{...clone(baseline),revision:'3'}:clone(baseline)}});
function reset(){state.services=[service];state.client={};state.selectedServiceId=sid;state.dirty.service=false;state.saving=false;state.dirtyServiceStructureIds.clear();state.worshipSections=clone(baseline.sections);state.worshipElements=clone(baseline.elements);state.loadedWorshipServiceIds.add(sid);state.serviceItems={[sid]:groupWorshipElements(baseline.sections,baseline.elements)[sid]};reads=0;output=false;mode='';}
reset();assert.match(renderWorshipDefaultOrderFillControl(service),/기본 순서 채우기/);
assert.equal(await fillWorshipDefaultOrderDraft(sid),true);assert.equal(getServiceItems(sid).length,17);assert.equal(reads,1);
assert.equal(renderWorshipDefaultOrderFillControl(service),'');assert.equal(state.dirty.service,true);assert(state.dirtyServiceStructureIds.has(sid));
assert.deepEqual(state.worshipSections,baseline.sections);assert.deepEqual(state.worshipElements,baseline.elements,'Confirmed rows remain intact until normal Save');
for(const blocked of ['pending','read-failure','revision-race','input-race','service-race']){reset();mode=blocked;assert.equal(await fillWorshipDefaultOrderDraft(sid),false,blocked);assert.equal(state.serviceItems[sid].length,2,blocked);if(blocked==='input-race')assert.equal(state.serviceItems[sid][0].assignee,'새 입력');}
reset();output=true;assert.equal(await fillWorshipDefaultOrderDraft(sid),false);assert.equal(reads,0);
reset();state.dirty.service=true;assert.equal(await fillWorshipDefaultOrderDraft(sid),false);assert.equal(reads,0);
assert.equal(JSON.stringify(baseline),before);
console.log('PASS explicit seed completion: full default draft, original IDs/content, no automatic save/output, pending/draft/live/revision/input/navigation guards');
})()`,c);}catch(e){console.error(e);process.exitCode=1}})();
