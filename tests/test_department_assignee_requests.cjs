const { readRuntimeSource } = require('./helpers/runtime-source.cjs');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,structuredClone,document:{addEventListener(){}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:require('node:crypto').webcrypto};c.window=c;c.__mindexRuntimeStarted=true;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.constants.js','mindex.worship-model.js','mindex.worship-persistence.js','mindex.presenter.js','mindex.worship-input.js','mindex.worship-source.js','mindex.setlist-links.js','app.js'])vm.runInContext(readRuntimeSource(f),c,{filename:f});
c.assert=assert;
(async()=>{
 c.prepare=(await import('../mindex.worship-atomic-client.mjs')).prepareWorshipRowsCommit;
 vm.runInContext(`
 for (const mode of ['legacy','native']) {
 state.singleSongStorage=mode;
 for (const [type,label,field] of [['children','봉헌기도','children_prayer'],['youth','대표기도','youth_prayer'],['youth','봉헌기도','youth_offering_prayer'],['young-adult','대표기도','young_adult_prayer']]) {
  const id=crypto.randomUUID(),service={id,service_type_id:type,service_date:'2026-10-25',title:'fixture',source_ref:{}};
  const normalized=normalizeWorshipService(service), scaffold=buildWorshipServiceScaffold(id,type,{service:normalized});
  const target=scaffold.elements.find(e=>e.source_ref.label===label); assert.ok(target,type+label);
  target.person='기존 담당';target.source_ref.placeholder=false;
  const sections=scaffold.sections.filter(s=>s.id===target.section_id),elements=[target];
  const items=groupWorshipElements(sections,elements)[id];
  service.source_ref=withServiceDocumentSnapshot(normalized,items);
  const aggregate={service,sections,elements,revision:'5'},before=JSON.stringify(aggregate);
  const req=buildDepartmentCalendarServiceRequest(aggregate,field,'새 담당',prepare);
  assert.equal(req.singleSongProtocol,mode==='native'?1:undefined,'native mode must be explicit even without praise links');
  assert.equal(req.expectedRevision,'5');assert.equal(req.elementPatches.length,1);
  assert.deepEqual(Object.keys(req.elementPatches[0].patch),['person']);
  assert.equal(req.elementPatches[0].patch.person,'새 담당');assert.ok(req.document.sourceText.includes('새 담당'));
  assert.equal(JSON.stringify(aggregate),before,'detached preparation preserves baseline');
  const clear=buildDepartmentCalendarServiceRequest(aggregate,field,'',prepare);
  assert.equal(clear.singleSongProtocol,mode==='native'?1:undefined);
  assert.equal(clear.elementPatches[0].patch.person,'');assert.ok(!clear.document.sourceText.includes('기존 담당'));
  const missing={service:{...service,source_ref:{}},sections:[],elements:[],revision:'1'};
  const added=buildDepartmentCalendarServiceRequest(missing,field,'새 담당',prepare);
  assert.equal(added.singleSongProtocol,mode==='native'?1:undefined);
  assert.equal(added.newElements.length,1);assert.equal(added.newSections.length,1);assert.equal(added.newElements[0].patch.person,'새 담당');
 }
 }
 console.log('PASS native/legacy, no praise links, 4 linked slots: targeted requests, source sync, explicit clear, missing template slot and detached baseline');
 `,c);
})().catch(e=>{console.error(e);process.exitCode=1});
