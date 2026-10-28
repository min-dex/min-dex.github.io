const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,document:{addEventListener(){}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:require('node:crypto').webcrypto};c.window=c;c.__mindexRuntimeStarted=true;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.constants.js','mindex.worship-model.js','mindex.worship-persistence.js','mindex.presenter.js','mindex.presenter-praise.js','mindex.presenter-board.js','mindex.presenter-controller.js','mindex.worship-input.js','mindex.worship-source.js','mindex.setlist-links.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.assert=assert;
vm.runInContext(`
const service={id:'children-template-fixture',type_id:'children',date:'2026-10-25'};
state.services=[service];
const steps=serviceOrderTemplate('children',{service});
assert.deepEqual(Array.from(steps,s=>s.label),['준비','사도신경','찬양','예배의 부름','성경봉독','설교','결단','봉헌','나래파송','주기도문','광고','교제']);
const rows=buildWorshipServiceScaffold(service.id,'children',{service});
const praise=rows.sections.find(s=>s.section_key==='praise');
assert.equal(rows.elements.filter(e=>e.section_id===praise.id).length,4);
const offering=rows.sections.find(s=>s.section_key==='offering');
assert.deepEqual(Array.from(rows.elements.filter(e=>e.section_id===offering.id),e=>e.source_ref.label),['봉헌찬양','봉헌기도']);
const announcement=rows.elements.find(e=>e.source_ref.label==='광고');
assert.match(announcement.body||announcement.title||'',/오늘도 어린이부 예배에 오신 여러분을 환영하고 축복합니다/);
const sermon=rows.elements.find(e=>e.source_ref.label==='설교');
assert.equal(sermon.element_type,'title_person');
const opening=rows.elements.find(e=>e.source_ref.label==='예배의 부름');
assert.equal(opening.element_type,'body');
assert.match(opening.config.slides.join('\\n'),/꿈꾸는 어린이부 여러분,/);
assert.match(opening.config.slides.join('\\n'),/하나님을 예배합니다\\./);
const response=rows.sections.find(s=>s.section_key==='response_song');
assert.equal(response.title,'결단');
assert.equal(rows.elements.find(e=>e.section_id===response.id).source_ref.label,'결단기도');
const confession=rows.elements.find(e=>e.source_ref.label==='공동체고백');
assert.equal(confession.element_type,'body');
assert.equal(rows.sections.find(s=>s.id===confession.section_id).title,'나래파송');
assert.equal(confession.source_ref.label,'공동체고백');
for(const key of ['creed','community_confession','lords_prayer']) {
 const section=rows.sections.find(row=>row.section_key===key);
 for(const element of rows.elements.filter(row=>row.section_id===section.id))assert.ok(!element.config.introSlide,'Children liturgy uses body directly');
}
assert.ok(publicWorshipCreedStep().elements[0].introSlide,'Keep other services shared defaults');
assert.ok(publicWorshipLordsPrayerStep().elements[0].introSlide);
assert.equal(serviceSectionDisplayTitle('community_confession','나래파송'),'나래파송');
assert.equal(serviceSectionDisplayTitle('community_confession','공동체고백'),'공동체고백');
assert.match(presenterCanonicalLiturgicalBodyText('공동체고백',service),/꿈꾸는 어린이부 공동체/);
const items=groupWorshipElements(rows.sections,rows.elements)[service.id];
const oldPrayer={id:'legacy-prayer',label:'기도',assignee:'담당자',raw_title:'',memo:serializeServiceItemMemo({elementType:'title_person',note:'보존'}),_worshipSectionKey:'decision',_worshipSectionTitle:'기도',_worshipSectionId:'legacy-section',_worshipElementTemplateModified:true};
const beforePrayer=JSON.stringify(oldPrayer);
const normalizedPrayer=projectWorshipServiceItemsFromTemplate(service,[oldPrayer])[0];
assert.equal(normalizedPrayer.label,'결단기도');assert.equal(normalizedPrayer._worshipSectionTitle,'결단');
assert.equal(normalizedPrayer.id,oldPrayer.id);assert.equal(normalizedPrayer.memo,oldPrayer.memo);assert.equal(normalizedPrayer.assignee,oldPrayer.assignee);
assert.equal(normalizedPrayer._worshipSectionId,oldPrayer._worshipSectionId);assert.equal(JSON.stringify(oldPrayer),beforePrayer);
const unrelated=[{...oldPrayer,_worshipSectionKey:'prayer'}];
assert.equal(normalizeLegacyWorshipRoleItems(unrelated),unrelated,'Keep editor references when no legacy roles change');
const call={id:'legacy-call',label:'예배의 부름',assignee:'인도자',raw_title:'',memo:serializeServiceItemMemo({elementType:'title_person'}),_worshipSectionKey:'call'};
const callMemo=parseServiceItemMemo(call.memo);
assert.equal(liturgicalBodyText(call,callMemo,'',service),worshipOpeningBodyText('children'));
assert.equal(resolvePresenterServiceItemContentState(call,callMemo,null,service).state,'filled');
const callSlides=buildPresenterLiturgicalBodySlides(call,{},0,service,callMemo,'');
assert.ok(callSlides.length);assert.equal(callSlides[0].bodyText,worshipOpeningBodyText('children'));assert.ok(!callSlides[0].text.includes('인도자'));
assert.equal(liturgicalBodyText(call,{...callMemo,slides:['직접 입력한 전례문']},'',service),'직접 입력한 전례문');
assert.equal(liturgicalBodyText({...call,_worshipElementTemplateModified:true},{...callMemo,elementType:'body',slides:[]},'',service),'');
assert.equal(liturgicalBodyText(call,callMemo,'',{...service,type_id:'youth'}),'','No invented liturgy for another ministry');
const offeringItem=items.find(i=>i.label==='봉헌찬양');
offeringItem.raw_title='직접 입력한 봉헌곡';
offeringItem.memo=serializeServiceItemMemo({...parseServiceItemMemo(offeringItem.memo),formPreset:{forms:['V1','C','C'],strength:'manual'}});
const before=JSON.stringify(items);
const projected=projectWorshipServiceItemsFromTemplate(service,items);
assert.equal(JSON.stringify(items),before,'Projection must not mutate source');
assert.equal(projected.filter(i=>i.id===offeringItem.id).length,1);
assert.equal(projected.find(i=>i.id===offeringItem.id).raw_title,offeringItem.raw_title);
assert.equal(projected.find(i=>i.id===offeringItem.id).memo,offeringItem.memo);
assert.equal(projected.filter(i=>i.label==='봉헌찬양').length,1);
assert.equal(projected.filter(i=>i.label==='봉헌기도').length,1);
const currentTemplate=SERVICE_ORDER_TEMPLATE_FALLBACKS.children;
SERVICE_ORDER_TEMPLATE_FALLBACKS.children=['사도신경','찬양','예배의 부름','성경봉독','설교','결단기도','봉헌','봉헌찬양','봉헌기도','나래파송','주기도문','광고','교제'];
const legacyRows=buildWorshipServiceScaffold(service.id,'children',{service});
const legacy=groupWorshipElements(legacyRows.sections,legacyRows.elements)[service.id];
SERVICE_ORDER_TEMPLATE_FALLBACKS.children=currentTemplate;
for(const label of ['봉헌찬양','봉헌기도','나래파송','설교']) {
 const item=legacy.find(i=>i.label===label);item.raw_title='보존 '+label;item.assignee='직접 담당';
}
const legacyBefore=JSON.stringify(legacy);
const migrated=projectWorshipServiceItemsFromTemplate(service,legacy);
assert.equal(JSON.stringify(legacy),legacyBefore);
for(const label of ['봉헌찬양','봉헌기도','나래파송','설교']) {
 const old=legacy.find(i=>i.label===label);
 const retained=migrated.find(i=>i.id===old.id);
 assert.ok(retained,label+' must retain identity');
 assert.equal(retained.raw_title,old.raw_title);
 assert.equal(retained.assignee,old.assignee);
}
for(const type of ['children','youth','young-adult','sunday-main']) {
 const svc={...service,type_id:type};
 for(const role of ['다같이','다 같이','다함께','인도자','예배 인도자','찬양인도자']) {
  const item={id:'role-fixture',label:'대표기도',raw_title:'대표기도',assignee:role,memo:serializeServiceItemMemo({elementType:'title_person'})};
  const before=JSON.stringify(item);
  assert.equal(cleanPresenterAssignee(role),'');
  const section=presenterSectionForServiceItem(item,0,item.raw_title);
  assert.equal(section.sectionAssignee,'');
  const slide=presenterElementSlideFromMemoCore(item,section,0,parseServiceItemMemo(item.memo),item.raw_title,svc);
  assert.equal(slide.assignee,'');assert.ok(!slide.text.includes(role));
  assert.equal(JSON.stringify(item),before,'Output filtering must preserve bulletin/source');
 }
 assert.equal(cleanPresenterAssignee('김유준 어린이'),'김유준 어린이');
 assert.equal(cleanPresenterAssignee('박소영 전도사님'),'박소영 전도사님');
}
// Navigation uses typed metadata, never the body or a known-text prefix.
for (const label of ['주기도문','사도신경','공동체고백','예배의 부름']) {
 const item={id:'navigation-'+label,label,raw_title:'새로 작성한 본문',memo:serializeServiceItemMemo({elementType:'body',slides:['새로 작성한 본문']})};
 const before=JSON.stringify(item);
 assert.equal(serviceItemLiturgicalNavigationTitle(item),label);
 assert.equal(presenterSectionForServiceItem(item,0,item.raw_title).elementTitle,label);
 assert.equal(serviceSidebarChildItemDisplayParts(item,service).title,'');
 const named={...item,memo:serializeServiceItemMemo({elementType:'body',introSlide:{title:'함께 드리는 고백'},slides:['새로 작성한 본문']})};
 assert.equal(serviceItemLiturgicalNavigationTitle(named),'함께 드리는 고백');
 assert.equal(serviceSidebarChildItemDisplayParts(named,service).title,'함께 드리는 고백');
 assert.equal(JSON.stringify(item),before,'Navigation cannot mutate authored body');
}
assert.equal(serviceItemLiturgicalNavigationTitle({label:'설교',raw_title:'소망',memo:serializeServiceItemMemo({elementType:'title_person'})}),null);
assert.equal(serviceItemLiturgicalNavigationTitle({label:'찬양',_worshipSectionKey:'creed',memo:serializeServiceItemMemo({elementType:'praise'})}),null);
console.log('PASS children order, four praise slots, offering hierarchy, typed content, authored content preservation');
`,c);
