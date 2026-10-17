from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url+'?mindexSmokeRaw=1', wait_until='domcontentloaded')
                page.wait_for_function("typeof persistSundayEditSync === 'function'")
                print(engine, page.evaluate('''async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const clone=x=>JSON.parse(JSON.stringify(x));
                  const sid='11111111-1111-4111-8111-111111111111',tid='22222222-2222-4222-8222-222222222222';
                  const source={id:sid,date:'2026-09-06',type_id:'sunday-second'};
                  const target={id:tid,date:source.date,type_id:'sunday-main'};
                  const make=(service,title)=>normalizeServiceItem({id:service.id,service_id:service.id,label:'설교 제목',raw_title:title,
                    assignee:'담당',_worshipSectionKey:'sermon',_worshipSectionTitle:'설교',
                    memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text'})});
                  const previous=make(source,'Original'),edited=make(source,'Edited');
                  edited._worshipSharedContentDirty=true;
                  const originalGroup=groupWorshipElements;
                  groupWorshipElements=()=>({[source.id]:[edited]});
                  const originalPersist=persistSundayEditSync;
                  const originalAtomic=worshipAtomicClient;
                  let jobs=[];
                  persistSundayEditSync=async job=>{jobs.push(clone(job))};
                  state.services=[source,target,{id:'third-date',date:'2026-09-13',type_id:'sunday-main'}];
                  pendingSundayEditSync.clear();
                  await syncSharedSundayContentAfterSave(source,[edited],{previousItems:[previous]});
                  check(jobs.length===1&&jobs[0].targetId===tid,'wrong sync scope');
                  await syncSharedSundayContentAfterSave(source,[edited],{previousItems:[edited]});
                  check(jobs.length===1,'unchanged save resynced');
                  const first={id:'first',date:source.date,type_id:'sunday-first'};
                  const second={id:'second',date:source.date,type_id:'sunday-second'};
                  const firstCitation=normalizeServiceItem({id:'first:citation',service_id:first.id,label:'인용 구절',raw_title:'요한복음 3:16',
                    _worshipSectionKey:'sermon',_worshipSectionTitle:'설교',_worshipSlotKey:'sermon.citation',
                    memo:serializeServiceItemMemo({elementType:'scripture_body',scriptureReferences:['요한복음 3:16']})});
                  const clearedFirstCitation={...firstCitation,raw_title:'',memo:serializeServiceItemMemo({elementType:'scripture_body'})};
                  clearedFirstCitation._worshipSharedContentDirty=true;
                  jobs=[];state.services=[first,second,target];pendingSundayEditSync.clear();
                  await syncSharedSundayContentAfterSave(first,[clearedFirstCitation],{previousItems:[firstCitation]});
                  check(jobs.length===0,'first-service citation deletion leaked to linked services');
                  const readingItem=(service,reference)=>normalizeServiceItem({id:service.id+':reading',service_id:service.id,label:'성경봉독',raw_title:reference,
                    _worshipSectionKey:'scripture_reading',_worshipSlotKey:'word.body',
                    memo:serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',scriptureReferences:[reference]})});
                  for(const origin of [first,second,target]) {
                    const before=readingItem(origin,'요한복음 13:34-35'),after=readingItem(origin,'마태복음 21:33-46');
                    after._worshipSharedContentDirty=true;
                    jobs=[];pendingSundayEditSync.clear();state.services=[first,second,target];
                    groupWorshipElements=()=>({[origin.id]:[after]});
                    await syncSharedSundayContentAfterSave(origin,[after],{previousItems:[before]});
                    check(origin===first ? jobs.length===0 : jobs.length===1&&jobs[0].targetId===(origin===second?target.id:second.id),'reading sync crossed first-service boundary');
                  }
                  const praiseItem=(service,songId)=>normalizeServiceItem({id:`${service.id}:praise`,service_id:service.id,label:'찬양 1',song_id:songId,
                    _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',_worshipSlotKey:'praise.song.1',
                    memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})});
                  const beforePraise=praiseItem(first,'old-song'),nextPraise=praiseItem(first,'new-song');nextPraise._worshipSharedContentDirty=true;
                  jobs=[];state.services=[first,second];pendingSundayEditSync.clear();
                  groupWorshipElements=()=>({[first.id]:[nextPraise]});
                  await syncSharedSundayContentAfterSave(first,[nextPraise],{previousItems:[beforePraise]});
                  check(jobs.length===1&&jobs[0].targetId===second.id&&jobs[0].key==='main-praise:1','first-to-second praise sync missing');
                  check(!Object.hasOwn(JSON.parse(jobs[0].item.memo),'asset'),'sync retry snapshot kept arbitrary payload');
                  const blank=make(target,'');state.serviceItems={[sid]:[edited],[tid]:[blank]};
                  check(serviceItemWithSharedSundayContent(blank,target).raw_title==='','read borrowed content');
                  check(!presenterServiceInputIsStatic(blank),'editor hidden');
                  check(!sundayEditSyncEligible({...blank,label:'봉헌 영상'},target),'video eligible');
                  const praise={...previous,label:'찬양 1',_worshipSectionKey:'praise',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
                  check(sundaySharedContentTypesForItem(praise,target).length===0,'third praise linked');
                  check(applySundayEditSync(edited,previous).raw_title==='Original','apply');
                  check(applySundayEditSync(edited,make(source,'')).raw_title==='','clear unsupported');
                  const manual={...praise,song_id:null,raw_title:'Manual',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['New lyrics']})};
                  const appliedManual=parseServiceItemMemo(applySundayEditSync(praise,manual).memo);
                  check(appliedManual.inputMode==='manual_praise'&&appliedManual.outputMode==='lyrics'&&appliedManual.slides[0]==='New lyrics','manual lyric mode lost');
                  const raw='Memo before\\n[설교]\\n설교 제목: Original\\n  담당: 담당\\n  알수없는정보: keep target\\n\\n[별도]\\n사용자 항목: Keep exactly\\n  알수없는정보: keep';
                  const replaced=sundayEditSyncSourceText({sourceText:raw},previous,edited,source);
                  check(replaced.startsWith('Memo before\\n'),'source preamble lost');
                  check(replaced.endsWith('[별도]\\n사용자 항목: Keep exactly\\n  알수없는정보: keep'),'unrelated source text changed');
                  check(replaced.includes('설교 제목: Edited'),'source block not changed');
                  check(replaced.includes('  알수없는정보: keep target'),'target metadata lost');
                  check(!Object.hasOwn(parseServiceSourceText(raw)[0],'startLine'),'parser default contract changed');
                  const portable='[[설교]]\\n[설교 제목]\\n- 제목: Original\\n- 유형: title_person\\n- 입력: text\\n\\n[[별도]]\\n[사용자 항목]\\n- 제목: Keep exactly';
                  const portableRecords=parseServiceSourceText(portable,{includeRanges:true});
                  check(portableRecords.every(r=>Number.isInteger(r.endLine)&&r.endLine>r.startLine),'portable source missing ranges');
                  let updatedPortable=portable;
                  for(let n=0;n<3;n++) updatedPortable=sundayEditSyncSourceText({sourceText:updatedPortable},previous,edited,source);
                  check(parseServiceSourceText(updatedPortable).length===2,'portable sync duplicated source');
                  check(updatedPortable.endsWith('[[별도]]\\n[사용자 항목]\\n- 제목: Keep exactly'),'portable sync changed unrelated content');
                  groupWorshipElements=originalGroup;
                  persistSundayEditSync=originalPersist;
                  worshipAtomicClient=async()=>({
                    read:async()=>({service:clone(serviceRow),...clone(db)}),
                    commit:async request=>{
                      writes.push(clone(request));
                      if(mode!=='ok')throw Error('REVISION_CONFLICT');
                      db.elements=db.elements.map(row=>request.rows.elements.find(next=>next.id===row.id)||row);
                      serviceRow.source_ref={mindexServiceDocument:clone(request.document)};
                      return {service:clone(serviceRow),...clone(db)};
                    }
                  });
                  const typed={inputMode:true,contentState:true};
                  let db,serviceRow,writes,mode;
                  const reset=()=>{
                    const rows=buildWorshipPersistenceRows(target,[make(target,'Original')],{}, {},{elementTypedStateColumns:typed});
                    db=clone(rows);writes=[];mode='ok';
                    serviceRow={id:tid,service_type_id:'sun_3rd',service_date:source.date,source_ref:{}};
                    state.services=[source,target];state.selectedServiceId=sid;state.dirty.service=false;
                    state.dirtyServiceElementIds=new Map();state.dirtyServiceStructureIds=new Set();
                    state.worshipSections=[];state.worshipElements=[];state.serviceItems={[sid]:[edited]};
                    state.loadedWorshipServiceIds=new Set();
                  };
                  fetchWorshipRowsForServiceIds=async()=>clone(db);
                  refreshPresenterForService=()=>{};
                  state.client={from:()=>{throw Error('Direct table write attempted')}};
                  // Exercise persisted typed rows, not only the in-memory merge helper.
                  const musicItem=(service,slot,label,mode,song,form={})=>normalizeServiceItem({
                    id:service.id,service_id:service.id,label,song_id:song,raw_title:'',
                    _worshipSlotKey:slot,_worshipSectionKey:slot==='hymn.main'?'hymn_praise':'offering',
                    _worshipElementTemplateModified:true,
                    memo:serializeServiceItemMemo({elementType:'praise',inputMode:mode,
                      outputMode:mode==='score_db'?'score':'lyrics',...form})});
                  const songsBeforeAudit=state.songs;
                  state.songs=['old-song','new-song'].map((id,index)=>({id,title:'검증 찬송 '+index,hymn_no:index+1,praise_type:'hymn',versions:[]}));
                  const loadSongsBeforeAudit=loadSongsForIds;loadSongsForIds=async()=>{};
                  for(const [targetMode,sourceMode] of [['score_db','lyrics_db'],['lyrics_db','score_db']]) {
                    reset();
                    const local=musicItem(target,'offering.praise','봉헌찬송',targetMode,'old-song');
                    const before=musicItem(source,'offering.praise','봉헌찬송',sourceMode,'old-song');
                    db=clone(buildWorshipPersistenceRows(target,[local],{}, {},{elementTypedStateColumns:typed}));
                    await persistSundayEditSync({sourceServiceId:sid,targetId:tid,key:'offering-hymn',previous:before,item:{...before,song_id:null}}, {elementTypedStateColumns:typed});
                    const saved=groupWorshipElements(db.sections,db.elements)[tid][0];
                    const memo=parseServiceItemMemo(saved.memo);
                    check(writes.length===1&&!saved.song_id,'clear did not commit once');
                    check(memo.inputMode===targetMode&&memo.outputMode===parseServiceItemMemo(local.memo).outputMode,'clear changed local display mode');
                  }
                  const incomingForm={formHint:'V1-C',formPreset:{forms:['V1','C'],strength:'manual'}};
                  for(const choice of [{},{formHint:'V2-C-Tag',formPreset:{forms:['V2','C','Tag'],strength:'manual'}},{formPresetDisabled:true}]) {
                    reset();
                    const local=musicItem(target,'hymn.main','찬송','score_db',null,choice);
                    const before=musicItem(source,'praise.song.3','찬양 3','lyrics_db','old-song',incomingForm);
                    db=clone(buildWorshipPersistenceRows(target,[local],{}, {},{elementTypedStateColumns:typed}));
                    await persistSundayEditSync({sourceServiceId:sid,targetId:tid,key:'main-praise:3',previous:before,item:{...before,song_id:'new-song'}},{elementTypedStateColumns:typed});
                    const saved=groupWorshipElements(db.sections,db.elements)[tid][0],memo=parseServiceItemMemo(saved.memo);
                    check(writes.length===1&&saved.song_id==='new-song','empty hymn not filled');
                    check(memo.inputMode==='score_db','empty hymn display changed');
                    check(memo.formPresetDisabled===Boolean(choice.formPresetDisabled),'disabled form overwritten');
                    const expectedForm=parseServiceItemMemo(Object.keys(choice).length?local.memo:before.memo);
                    check(memo.formHint===expectedForm.formHint&&JSON.stringify(memo.formPreset)===JSON.stringify(expectedForm.formPreset),'canonical form sequence overwritten');
                  }
                  reset();
                  const ownForm=musicItem(target,'offering.praise','봉헌찬송','score_db','old-song',{formPresetDisabled:true});
                  const sharedBefore=musicItem(source,'offering.praise','봉헌찬송','lyrics_db','old-song',incomingForm);
                  db=clone(buildWorshipPersistenceRows(target,[ownForm],{}, {},{elementTypedStateColumns:typed}));
                  let formConflict=false;
                  try {await persistSundayEditSync({sourceServiceId:sid,targetId:tid,key:'offering-hymn',previous:sharedBefore,item:{...sharedBefore,song_id:'new-song'}},{elementTypedStateColumns:typed});} catch(error) {formConflict=error.message.includes('덮어쓰지 않았습니다');}
                  check(formConflict&&writes.length===0,'populated independent form lost conflict guard');
                  loadSongsForIds=loadSongsBeforeAudit;state.songs=songsBeforeAudit;
                  const job={sourceServiceId:sid,targetId:tid,key:'sermon-title',previous,item:edited};
                  reset();await persistSundayEditSync(job,{elementTypedStateColumns:typed});
                  check(writes.length===1&&writes[0].rows.sections.length===0&&db.elements[0].title==='Edited','target not saved atomically');
                  check(db.elements[0].section_id===db.sections[0].id,'structure overwritten');
                  reset();db.elements[0].title='Independent';
                  let failed=false;try{await persistSundayEditSync(job,{elementTypedStateColumns:typed})}catch{failed=true}
                  check(failed&&writes.length===0,'independent value overwritten');
                  reset();state.dirtyServiceElementIds.set(tid,new Set(['draft']));failed=false;
                  try{await persistSundayEditSync(job,{elementTypedStateColumns:typed})}catch{failed=true}
                  check(failed&&writes.length===0,'local draft overwritten');
                  reset();mode='conflict';failed=false;
                  try{await persistSundayEditSync(job,{elementTypedStateColumns:typed})}catch{failed=true}
                  check(failed&&db.elements[0].title==='Original','zero-row receipt accepted');
                  reset();serviceRow.source_ref={mindexServiceDocument:{sourceText:'설교 제목: Original',slides:[
                    {id:'custom',elementId:'other',type:'image',imageSrc:'keep.png',title:'Keep'},
                    {id:'old',elementId:db.elements[0].id,type:'title-assignee',text:'Original'}]}};
                  await persistSundayEditSync(job,{elementTypedStateColumns:typed});
                  const doc=serviceRow.source_ref.mindexServiceDocument;
                  check(doc.sourceText.includes('Edited'),'source text stale');
                  check(!('slides' in doc)&&!('sourceRecords' in doc)&&!('exceptions' in doc),'derived presentation snapshot persisted');
                  reset();serviceRow.source_ref={mindexServiceDocument:{sourceText:'Original',slides:[]}};mode='document-conflict';failed=false;
                  try{await persistSundayEditSync(job,{elementTypedStateColumns:typed})}catch{failed=true}
                  check(failed&&db.elements[0].title==='Original','rejected commit partially saved');
                  mode='ok';await persistSundayEditSync(job,{elementTypedStateColumns:typed});
                  check(serviceRow.source_ref.mindexServiceDocument.sourceText.includes('Edited'),'partial retry did not repair source');
                  reset();db.elements=[];await persistSundayEditSync(job,{elementTypedStateColumns:typed});
                  check(writes.length===0,'missing item created');
                  reset();db.elements[0].source_ref.label='봉헌 영상';db.elements[0].element_type='video';
                  await persistSundayEditSync(job,{elementTypedStateColumns:typed});check(writes.length===0,'replacement overwritten');
                  reset();
                  const citation=(service)=>normalizeServiceItem({id:service.id,service_id:service.id,label:'인용 구절',
                    raw_title:'요한복음 3:16',_worshipSectionKey:'sermon',_worshipSectionTitle:'설교',_worshipSlotKey:'sermon.citation',
                    memo:serializeServiceItemMemo({elementType:'scripture_body',scriptureReferences:['요한복음 3:16']})});
                  const beforeCitation=citation(source),emptyCitation=citation(source);
                  emptyCitation.raw_title='';emptyCitation.memo=serializeServiceItemMemo({elementType:'scripture_body'});
                  db=clone(buildWorshipPersistenceRows(target,[citation(target)],{}, {},{elementTypedStateColumns:typed}));
                  db.elements[0].source_ref.scriptureReferences=['요한복음 3:16'];
                  db.elements[0].source_ref.customNote='keep';
                  await persistSundayEditSync({sourceServiceId:sid,targetId:tid,key:'sermon-citation',previous:beforeCitation,item:emptyCitation},{elementTypedStateColumns:typed});
                  const restoredCitation=groupWorshipElements(db.sections,db.elements)[tid][0];
                  check(serviceItemScriptureReferences(restoredCitation).length===0,'linked citation deletion resurrected');
                  check(db.elements[0].source_ref.customNote==='keep','unrelated linked metadata lost');
                  groupWorshipElements=()=>({[sid]:[edited]});
                  pendingSundayEditSync.clear();persistSundayEditSync=async()=>{throw Error('network')};failed=false;
                  try{await syncSharedSundayContentAfterSave(source,[edited],{previousItems:[previous]})}catch{failed=true}
                  check(failed&&pendingSundayEditSync.size===1,'failed job lost');
                  check(readPendingSundayEditSync().size===1,'retry not durable');
                  const originalStorageSet=safeStorageSet;
                  safeStorageSet=()=>false;pendingSundayEditSync.clear();let storageBlockedCalls=0;
                  persistSundayEditSync=async()=>{storageBlockedCalls++};
                  await syncSharedSundayContentAfterSave(source,[edited],{previousItems:[previous]});
                  check(storageBlockedCalls===1&&pendingSundayEditSync.size===0,'storage failure blocked live sync');
                  safeStorageSet=originalStorageSet;
                  persistSundayEditSync=async()=>{};
                  await syncSharedSundayContentAfterSave(source,[edited],{previousItems:[edited]});
                  check(pendingSundayEditSync.size===0,'retry failed');
                  groupWorshipElements=originalGroup;
                  // Independent target song exists in stored rows, but is not hydrated yet.
                  const catalogue=['prior','source-new','target-curated'].map((id,index)=>({id,title:id,hymn_no:index+1,praise_type:'hymn',versions:[]}));
                  state.songs=catalogue;reset();
                  const own=musicItem(target,'hymn.main','찬송','score_db','target-curated');
                  db=clone(buildWorshipPersistenceRows(target,[own],{}, {},{elementTypedStateColumns:typed}));
                  state.songs=[];
                  loadSongsForIds=async()=>{state.songs=catalogue};
                  worshipAtomicClient=async()=>({read:async()=>({service:clone(serviceRow),...clone(db)}),commit:async request=>{
                    writes.push(clone(request));db.elements=db.elements.map(row=>request.rows.elements.find(next=>next.id===row.id)||row);
                    serviceRow.source_ref={mindexServiceDocument:clone(request.document)};return {service:clone(serviceRow),...clone(db)};
                  }});
                  const prior=musicItem(source,'praise.song.3','찬양 3','lyrics_db','prior');
                  prior._worshipSectionKey='praise';
                  const incoming={...prior,song_id:'source-new'};
                  let protectedTarget=false;
                  try {await originalPersist({sourceServiceId:sid,targetId:tid,key:'main-praise:3',previous:prior,item:incoming},{elementTypedStateColumns:typed});} catch(error) {protectedTarget=error.message.includes('덮어쓰지 않았습니다');}
                  check(protectedTarget&&writes.length===0&&db.elements[0].song_id==='target-curated','unhydrated independent hymn overwritten');
                  for(const count of [0,1,2]) {
                    state.services=[source,target];state.worshipSections=[];state.worshipElements=[];
                    groupWorshipElements=()=>({[sid]:Array.from({length:count},()=>incoming)});
                    pendingSundayEditSync.clear();
                    pendingSundayEditSync.set('audit',{sourceServiceId:sid,targetId:tid,key:'main-praise:3',previous:prior,item:incoming});
                    let dispatched=0;persistSundayEditSync=async()=>{dispatched++};
                    let rejected=false;
                    try {await syncSharedSundayContentAfterSave(source,[],{previousItems:[]});} catch {rejected=true;}
                    check(dispatched===(count===1?1:0)&&rejected===(count!==1)&&pendingSundayEditSync.size===0,'retry source cardinality guard failed: '+count);
                  }
                  worshipAtomicClient=originalAtomic;
                  return 'PASS unhydrated hymn protection, retry source cardinality, display-mode clear, vacant hymn form retention, populated form conflict, read isolation, scoped sync, drafts, CAS and retry';
                }'''))
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
