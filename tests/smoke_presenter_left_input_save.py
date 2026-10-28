"""Actual left input -> preparation -> atomic failure/retry/reopen, memory server only."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page()
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
    page.add_init_script('window.open=()=>null')
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof saveWorshipServiceInstance==='function' && !!refs.songList && !document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    print(engine,page.evaluate('''async()=>{
                      // This fixture supplies the legacy atomic protocol; native activation has its own smoke.
                      globalThis.MINDEX_SINGLE_SONG_BOOTSTRAP_READY=false;
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const sid=crypto.randomUUID();
                      const service={id:sid,type_id:'fixture',date:'2026-10-12',title:'Fixture',_worshipSourceRef:{}};
                      state.services=[service]; state.selectedServiceId=sid;state.songs=[];
                      state.dirty.service=false;state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
                      state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();
                      state.serviceAliasSupported=true;
                      const items=['First','Second','Third'].map((title,i)=>normalizeServiceItem({
                        id:crypto.randomUUID(),service_id:sid,label:i===2?'설교':i?'대표기도':'광고',raw_title:title,
                        _worshipSectionKey:i===2?'sermon':i?'prayer':'announcements',_worshipSectionTitle:i===2?'설교':i?'대표기도':'광고',
                        _worshipSlotKey:'test.'+i,_worshipElementTemplateModified:true,
                        memo:serializeServiceItemMemo({elementType:i?'title_person':'body',inputMode:'text'})},i));
                      const typed={inputMode:true,contentState:true};
                      worshipElementTypedStateColumns=async()=>typed;
                      refreshPresenterForService=()=>{};
                      const rows=buildWorshipPersistenceRows(service,items,{}, {},{elementTypedStateColumns:typed});
                      sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
                      state.worshipSections=structuredClone(rows.sections);state.worshipElements=structuredClone(rows.elements);
                      state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};
                      const initial={serviceId:sid,serviceTypeId:'fixture',serviceDate:service.date,
                        metadataPatch:{title:'Fixture'},
                        sections:rows.sections.map(({id,service_id,created_at,updated_at,...patch})=>({id,patch})),
                        elements:rows.elements.map(({id,section_id,created_at,updated_at,...patch})=>({id,sectionId:section_id,patch})),
                        document:buildServiceDocumentSnapshot(service,state.serviceItems[sid])};
                      let db={revision:'1',service:{id:sid,service_type_id:'fixture',service_date:service.date,title:'Fixture',source_ref:{mindexServiceDocument:initial.document}},
                        ...structuredClone(rows),slides:[]};
                      service._worshipSourceRef=structuredClone(db.service.source_ref);
                      const writes=[];let failure=false,duringSave=null;
                      state.client={from(){throw Error('Legacy table write attempted')},rpc:async(name,{sid:readId,req})=>{
                        if(name==='get_worship_service_v1')return {data:structuredClone(db)};
                        check(name==='save_worship_service_v1','wrong RPC');
                        if(failure)return {error:{code:'P0001',message:'INJECTED_FAILURE'}};
                        check(req.expectedRevision===db.revision,'stale token');writes.push(structuredClone(req));
                        for(const [key,patches] of [['sections',req.sectionPatches],['elements',req.elementPatches]]) {
                          for(const change of patches){const row=db[key].find(x=>x.id===change.id);Object.assign(row,change.patch);
                            for(const [field,keys] of Object.entries(change.removeKeys||{}))for(const key of keys)delete row[field][key];}
                        }
                        db.sections.push(...req.newSections.map(x=>({id:x.id,service_id:sid,...x.patch})));
                        db.elements.push(...req.newElements.map(x=>({id:x.id,section_id:x.sectionId,...x.patch})));
                        for(const move of req.elementMoves)db.elements.find(x=>x.id===move.id).section_id=move.sectionId;
                        db.elements=db.elements.filter(x=>!req.deleteElementIds.includes(x.id));
                        db.sections=db.sections.filter(x=>!req.deleteSectionIds.includes(x.id));
                        Object.assign(db.service,req.metadataPatch);
                        db.service.source_ref={...db.service.source_ref,mindexServiceDocument:req.document};
                        db.revision=String(Number(db.revision)+1);
                        if(duringSave){const callback=duringSave;duringSave=null;callback();}
                        return {data:{aggregate:structuredClone(db),committedRevision:db.revision,replayed:false}};
                      }};
                      const client=await worshipAtomicClient();await client.read(sid);

                      state.module='presenter';state.serviceTypes=[{id:'fixture',name:'검증 예배'}];state.serviceError='';state.connectionError='';state.search='';
                      document.body.dataset.module='presenter';document.body.classList.remove('ui-booting');
                      renderServiceList();renderPresenterDetail();
                      const field=refs.songList.querySelector('[data-presenter-preparation-field-label="광고"]');
                      check(field,'left announcement input missing');field.focus();field.value='왼쪽에서 입력한 공지';field.dispatchEvent(new Event('input',{bubbles:true}));
                      const titleField=refs.songList.querySelector('[data-presenter-preparation-field-label="설교 제목"]');
                      const personField=refs.songList.querySelector('[data-presenter-preparation-field-label="설교자"]');
                      check(titleField&&personField,'separate sermon inputs missing');
                      titleField.value='사랑 / 믿음';titleField.dispatchEvent(new Event('input',{bubbles:true}));
                      personField.value='김민수 목사';personField.dispatchEvent(new Event('input',{bubbles:true}));
                      const beforeOutput=JSON.stringify(state.presenter);
                      const realApply=applyPresenterPreparationInput;let applying;
                      applyPresenterPreparationInput=(...args)=>(applying=realApply(...args));
                      refs.songList.querySelector('[data-presenter-preparation-apply]').click();
                      await applying;applyPresenterPreparationInput=realApply;
                      check(state.serviceItems[sid].some(i=>i.raw_title.includes('왼쪽에서 입력한 공지')),'real preparation did not update item');
                      const sermon=state.serviceItems[sid].find(item=>item.label==='설교');
                      check(sermon.raw_title==='사랑 / 믿음'&&sermon.assignee==='김민수 목사','title delimiter was parsed as assignee');
                      const draftBefore=JSON.stringify(state.serviceItems[sid]);failure=true;
                      try{await saveWorshipServiceInstance(service);throw Error('failure accepted')}catch(e){check(e.message==='INJECTED_FAILURE',e.message)}
                      check(JSON.stringify(state.serviceItems[sid])===draftBefore,'failure lost input');check(!client.pending(sid),'failed save blocked retry');
                      const retained=presenterPreparationDraftForService(sid);check(JSON.stringify(retained).includes('왼쪽에서 입력한 공지'),'failed save lost left draft');
                      failure=false;duringSave=()=>{field.value='저장 중 추가 입력';field.dispatchEvent(new Event('input',{bubbles:true}));};await saveWorshipServiceInstance(service);
                      check(field.isConnected&&field.value==='저장 중 추가 입력'&&JSON.stringify(presenterPreparationDraftForService(sid)).includes('저장 중 추가 입력'),'receipt overwrote newer left input');
                      check(writes.length===1,'retry wrote unexpected count');
                      check(JSON.stringify(db).includes('왼쪽에서 입력한 공지'),'atomic server receipt missing input');
                      state.serviceItems[sid]=groupWorshipElements(db.sections,db.elements)[sid];
                      delete state.presenterPreparationDrafts[sid];renderServiceList();renderPresenterDetail();
                      check(JSON.stringify(state.serviceItems[sid]).includes('왼쪽에서 입력한 공지'),'reopen lost saved input');
                      check(JSON.stringify(state.presenter)===beforeOutput,'edit/save touched output');
                      for(const input of refs.songList.querySelectorAll('[data-presenter-preparation-field]')) {
                        input.value=input.dataset.preparationRole==='assignee'?'김민수 집사':'완료된 공지';
                        input.dispatchEvent(new Event('input',{bubbles:true}));
                      }
                      renderServiceList();
                      check(!refs.songList.querySelector('.svc-presenter-preparation-input').hidden,'pending input auto-collapsed');
                      await applyPresenterPreparationInput(sid);
                      check(presenterPreparationFieldValues(service,presenterPreparationDefaultDraftForService(service)).every(row=>row.value),'fixture incomplete');
                      check(refs.songList.querySelector('.svc-presenter-preparation-input').hidden,'completed input did not collapse '+JSON.stringify({fields:presenterPreparationStructuredFields(service),pending:state.presenterPreparationDrafts[sid],view:presenterOrderInputView(service)}));
                      refs.songList.querySelector('[data-presenter-order-toggle]').click();renderServiceList();
                      check(!refs.songList.querySelector('.svc-presenter-preparation-input').hidden,'manual reopen lost');
                      const edit=refs.songList.querySelector('[data-presenter-preparation-field]');edit.focus();edit.value='아직 반영하지 않은 입력';edit.dispatchEvent(new Event('input',{bubbles:true}));
                      renderServiceList();
                      check(!refs.songList.querySelector('.svc-presenter-preparation-input').hidden&&edit.value==='아직 반영하지 않은 입력','new draft auto-collapsed');
                      const other={id:crypto.randomUUID(),type_id:'fixture',date:'2026-10-13',title:'Other'};
                      state.services.push(other);state.serviceItems[other.id]=[];state.loadedWorshipServiceIds.add(other.id);
                      state.selectedServiceId=other.id;renderServiceList();renderPresenterDetail();
                      state.selectedServiceId=sid;renderServiceList();renderPresenterDetail();
                      let returned=refs.songList.querySelector('[data-presenter-preparation-field]');
                      check(returned.value==='아직 반영하지 않은 입력','service return lost pending input');
                      for(let i=0;i<2;i++)refs.songList.querySelector('[data-presenter-order-toggle]').click();
                      returned=refs.songList.querySelector('[data-presenter-preparation-field]');
                      check(returned.value==='아직 반영하지 않은 입력'&&!returned.closest('.svc-presenter-preparation-input').hidden,'collapse/reopen lost pending input');
                      check(JSON.stringify(state.presenter)===beforeOutput,'service return changed output');
                      return 'PASS real input/save retry/reopen, service return, disclosure and pending preservation';
    }'''),flush=True)
   finally:browser.close()
finally:server.shutdown()
