const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,document:{addEventListener(){}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:require('node:crypto').webcrypto};c.window=c;c.__mindexRuntimeStarted=true;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.constants.js','mindex.worship-model.js','mindex.worship-persistence.js','mindex.presenter.js','mindex.presenter-praise.js','mindex.presenter-board.js','mindex.presenter-media-state.js','mindex.keynote-html.js','mindex.presenter-controller.js','mindex.worship-input.js','mindex.worship-source.js','mindex.worship-week.js','mindex.setlist-links.js','mindex.bulletin.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.assert=assert;
vm.runInContext(`
const target='a9208dff-ed16-408d-836f-c43160fa3cbc',source='10000000-0000-4000-8000-000000000001';
const replaced={id:source,type_id:'friday',date:'2026-11-13',alias:'다니엘기도회 대체 · 정규 집회 없음',_worshipSourceRef:{no_gathering:true,replacement_service_id:target}};
state.services=[replaced,{id:target,type_id:'special',date:'2026-11-01',alias:'다니엘기도회'}];state.serviceItems={[source]:[],[target]:[]};
const before=JSON.stringify(replaced);
assert.equal(worshipReplacementServiceId(replaced),target);
assert.equal(resolveServiceNavigationId(source),target);
assert.equal(serviceIsNoGathering(replaced),true,'Linking must preserve no-gathering semantics');
for(const render of [renderServiceDateCard,renderServiceWeekCard,renderServiceSidebarCard]) {
 const card=render(replaced);assert.ok(card.includes('data-service-id="'+target+'"'));assert.ok(!card.includes('disabled aria-disabled'));
 const original={...replaced,_worshipSourceRef:{no_gathering:true}};assert.ok(render(original).includes('disabled aria-disabled'));
}
assert.equal(JSON.stringify(replaced),before);
assert.equal(worshipReplacementServiceId({...replaced,_worshipSourceRef:{replacement_service_id:source}}),'');
assert.equal(worshipReplacementServiceId({...replaced,_worshipSourceRef:{replacement_service_id:'javascript:alert(1)'}}),'');
const raw={id:source,service_type_id:'fri',service_date:'2026-11-13',service_alias:replaced.alias,no_gathering:true,replacement_service_id:target};
const week=MindexWorshipWeek.build([], [raw]);assert.equal(week[0].entries[0].source.replacement_service_id,target);
const entry=week[0].entries[0];const html=renderWorshipWeekStatus(entry);assert.ok(html.includes('data-setlist-open-service="'+target+'"'));
// Wednesday links use the same fallback and explicit links always outrank earlier targets.
const day='2026-11-04',late={id:'10000000-0000-4000-8000-000000000010',type_id:'special',date:day,alias:'다니엘기도회',_worshipSourceRef:{start_time:'20:00'}},early={...late,id:'10000000-0000-4000-8000-000000000011',_worshipSourceRef:{start_time:'19:00'}};
const wed={...replaced,type_id:'wednesday',date:day,_worshipSourceRef:{no_gathering:true}};
state.services=[wed,late,early];assert.equal(serviceNavigationTargetId(wed),early.id);
assert.equal(serviceNavigationTargetId({...wed,_worshipSourceRef:{no_gathering:true,replacement_service_id:late.id}}),late.id);
assert.equal(serviceStartSortMinutes({type_id:'holy-week-dawn'}),300);
assert.equal(serviceStartSortMinutes({type_id:'holy-week-dawn',title:'고난주간 특별새벽기도회'}),290);
const dawn={id:crypto.randomUUID(),type_id:'holy-week-dawn',title:'감사 특별새벽기도회',date:'2026-11-02'};
assert.equal(serviceStartSortMinutes(dawn),295);
assert.equal(serviceStartSortMinutes({...dawn,_worshipSourceRef:{start_time:'04:40'}}),280);
const steps=serviceOrderTemplate(dawn.type_id,{service:dawn}).filter(s=>s.sectionKey!=='ready'&&s.sectionKey!=='closing_visual');
assert.equal(steps.map(s=>s.label).join('|'),'찬양|대표기도|특송|광고|성경봉독|설교|자율기도');
const authored=[1,2].map(n=>normalizeServiceItem({id:crypto.randomUUID(),service_id:dawn.id,label:'찬양 '+n,raw_title:'작성된 찬양 '+n,_worshipSectionKey:'praise',_worshipSectionId:'10000000-0000-4000-8000-000000000020',_worshipSectionTitle:'찬양',_worshipElementOrder:n,_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'audio_praise',slides:['사용자 가사 '+n],formPreset:{forms:['V2','C','C'],strength:'manual'}})},n-1));
state.services=[dawn];const authoredBefore=JSON.stringify(authored),visible=projectWorshipServiceItemsFromTemplate(dawn,authored);
assert.equal(JSON.stringify(authored),authoredBefore,'Default order must not rewrite authored praise');
for(const item of authored){const restored=visible.find(x=>x.id===item.id);assert.ok(restored);assert.equal(restored.raw_title,item.raw_title);assert.equal(restored.memo,item.memo);}
const sermon=steps.find(s=>s.sectionKey==='sermon');assert.ok(sermon.elements.some(e=>e.label==='인용 구절'&&!e.default_text));
const common={id:crypto.randomUUID(),service_id:target,label:'공동기도',raw_title:'공동기도',_worshipSectionKey:'corporate_prayer',_worshipSectionId:crypto.randomUUID(),_worshipSectionTitle:'공동기도',_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'image',inputMode:'asset',asset:{kind:'image',name:'다니엘기도회 공동기도.png',url:'./assets/presenter/daniel-common-prayer-template-7473226f8525.png'}})};
const deck=presenterElementSlideFromMemoCore(common,{},0,parseServiceItemMemo(common.memo),'공동기도');
assert.equal(deck.type,'image');assert.equal(deck.label,'공동기도');assert.ok(deck.imageSrc.includes('daniel-common-prayer-template-'));
assert.ok(SERVICE_SLOT_MUSIC['dawn.free'].source.endsWith('69c12c677944.mp3'));
assert.ok(!SERVICE_SLOT_MUSIC['prayer.meeting.free'].source.includes('69c12c677944'));
console.log('PASS linked replacements preserve absence, route all three card layouts and setlist status to the actual service');
`,c);

assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync('assets/presenter/dawn-free-prayer-69c12c677944.mp3')).digest('hex'),'69c12c677944b1dc38ee666e2758f26631ef6075a2d88202d2567e0ca8bfe0f5','Approved final dawn audio must match the supplied file');
