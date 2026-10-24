const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,document:{addEventListener(){}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:require('node:crypto').webcrypto};c.window=c;c.__mindexRuntimeStarted=true;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.constants.js','mindex.worship-model.js','mindex.worship-persistence.js','mindex.presenter.js','mindex.presenter-praise.js','mindex.presenter-controller.js','mindex.worship-input.js','mindex.worship-source.js','mindex.setlist-links.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.assert=assert;
vm.runInContext(`
const timing={version:1,audioUrl:'https://example.invalid/track.mp3',audioFingerprint:'audio-hash',duration:17.25,lyricsFingerprint:'lyrics-hash',starts:[0,3.125,null,12.875],enabled:true,photos:[{at:3.125,slideIndex:1,url:'https://example.invalid/photo.png',name:'사진'}]};
assert.deepEqual(JSON.parse(JSON.stringify(parseServiceItemMemo(serializeServiceItemMemo({audioTiming:timing})).audioTiming)),timing,'Timing-only memo must survive serialization');
for(const type of ['children','nursery','special']) {
 const service={id:crypto.randomUUID(),type_id:type,date:'2026-10-25'};
 state.services=[service];state.templateElementSuppressions.clear();
 const sectionId=crypto.randomUUID();
 const items=['직접 추가','찬양 3','찬양 1','봉헌기도'].map((label,index)=>normalizeServiceItem({id:crypto.randomUUID(),service_id:service.id,label,raw_title:'사용자 '+label,assignee:'담당 '+index,sort_order:index+1,_worshipSectionId:sectionId,_worshipSectionKey:'custom',_worshipSectionTitle:'사용자 순서',_worshipElementOrder:index+1,_worshipSectionTemplateModified:true,_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'audio_praise',audioTiming:timing,formPreset:{forms:['V2','C','C','V1'],strength:'manual'},slides:['첫째 가사','둘째 가사']})},index));
 const before=JSON.stringify(items);
 const visible=projectWorshipServiceItemsFromTemplate(service,items);
 assert.equal(JSON.stringify(items),before,'Opening must not mutate source');
 assert.deepEqual(Array.from(visible,i=>i.id),Array.from(items,i=>i.id));
 const deleted={...items[1],memo:serializeServiceItemMemo({...parseServiceItemMemo(items[1].memo),templateSuppressed:true})};
 const opened=projectWorshipServiceItemsFromTemplate(service,[items[0],deleted,...items.slice(2)]);
 assert.ok(!opened.some(i=>i.id===deleted.id),'Stored deletion must stay hidden');
 assert.equal(projectWorshipServiceItemsFromTemplate(service,[]).length,0,'Deleted-all service must remain empty');
 const rows=buildWorshipPersistenceRows(service,items);
 const reopened=groupWorshipElements(rows.sections.slice().reverse(),rows.elements.slice().reverse())[service.id];
 assert.deepEqual(Array.from(reopened,i=>i.raw_title),Array.from(items,i=>i.raw_title));
 assert.deepEqual(Array.from(reopened,i=>i.assignee),Array.from(items,i=>i.assignee));
 for(const item of reopened) {
  const memo=parseServiceItemMemo(item.memo);
  assert.deepEqual(JSON.parse(JSON.stringify(memo.audioTiming)),timing);
  assert.equal(memo.formPreset.forms.join('-'),'V2-C-C-V1');
  assert.equal(memo.slides.join('|'),'첫째 가사|둘째 가사');
 }
}
const ordered=[{id:'news',label:'광고'},{id:'custom',label:'직접 추가'},{id:'song',label:'찬양 1'},{id:'sermon',label:'설교'}];
insertServiceItemInTemplateOrder(ordered,{id:'added',label:'찬양 2'},'children');
assert.equal(ordered.map(i=>i.id).join(','),'news,custom,song,added,sermon','Add within the existing section at its authored position');
console.log('PASS timing-only metadata; independent templates preserve custom order, inputs, deletion, forms, lyrics and audio timing');
`,c);

vm.runInContext(`
for (const mode of ['lyrics_db','score_db','children_audio','manual_praise','audio_praise']) {
 assert.equal(worshipDbInputModeForSave(mode),mode);
 const service={id:crypto.randomUUID(),type_id:'special',date:'2026-10-25'};
 const item=normalizeServiceItem({id:crypto.randomUUID(),service_id:service.id,label:'찬양',raw_title:'보존할 제목',memo:serializeServiceItemMemo({elementType:'praise',inputMode:mode,outputMode:mode==='score_db'?'score':'lyrics',slides:['보존할 가사']})});
 const persisted=buildWorshipPersistenceRows(service,[item],{},{},{elementTypedStateColumns:{inputMode:true,contentState:true}});
 assert.equal(persisted.elements[0].input_mode,mode,'concrete column at save');
 const restored=groupWorshipElements(persisted.sections,persisted.elements)[service.id][0];
 assert.equal(servicePraiseInputMode(restored,parseServiceItemMemo(restored.memo),service),mode);

 const legacy={element_type:'praise',input_mode:'praise_db',config:{inputMode:mode},content_state:{inputMode:mode}};
 assert.equal(canonicalWorshipElementInputMode(legacy),mode);
 const concrete={...legacy,input_mode:mode,config:{inputMode:'audio_praise',outputMode:'score'}};
 assert.equal(canonicalWorshipElementInputMode(concrete),mode,'column outranks stale details');
 const rows={sections:[],elements:[{...legacy,id:crypto.randomUUID()}]};
 sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:{inputMode:true,contentState:true}});
 assert.equal(rows.elements[0].input_mode,mode);
}
assert.equal(canonicalWorshipElementInputMode({input_mode:'praise_db',config:{outputMode:'score'}}),'score_db');
assert.equal(canonicalWorshipElementInputMode({input_mode:'praise_db'}),'lyrics_db');
console.log('PASS canonical modes, legacy read aliases, column precedence and sanitizer');
`,c);
