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
    page.route('**/mindex-release.json*',lambda r:r.fulfill(json={'version':'inline-source-test'}))
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
                      const regions={welcome:'상단 문구',news:'1. 기존 소식',footer:'하단 문구'};
                      items[0].raw_title='인도자';
                      items[0].assignee='명시 담당';
                      items[0].memo=serializeServiceItemMemo({elementType:'plain_text',inputMode:'text',announcementRegions:regions,
                        slides:[regions.welcome,regions.news,regions.footer]});
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
                      for(const toggle of refs.songList.querySelectorAll('[data-presenter-inline-toggle]'))toggle.click();
                      const field=refs.songList.querySelector('[data-presenter-preparation-field-label="광고"]');
                      check(field?.value===regions.news,'left announcement must show weekly news body');
                      const editedNews='1. 왼쪽에서 입력한 공지\\n같은 항목의 상세\\n\\n2. 다음 소식';
                      field.focus();field.value=editedNews;field.dispatchEvent(new Event('input',{bubbles:true}));
                      const titleField=refs.songList.querySelector('[data-presenter-preparation-field-label="설교 제목"]');
                      const personField=refs.songList.querySelector('[data-presenter-preparation-field-label="설교자"]');
                      check(titleField&&personField,'separate sermon inputs missing');
                      titleField.value='사랑 / 믿음';titleField.dispatchEvent(new Event('input',{bubbles:true}));
                      personField.value='김민수 목사';personField.dispatchEvent(new Event('input',{bubbles:true}));
                      const beforeOutput=JSON.stringify(state.presenter);
                      await applyPresenterPreparationInput(sid);
                      check(serviceAnnouncementRegions(state.serviceItems[sid].find(i=>i.label==='광고')).news===editedNews,'real preparation did not update item');
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
                      const reopened=state.serviceItems[sid].find(i=>i.label==='광고');
                      const restored=serviceAnnouncementRegions(reopened);
                      check(restored.news===editedNews && restored.welcome===regions.welcome && restored.footer===regions.footer,'reopen lost announcement regions');
                      check(reopened.raw_title==='인도자' && JSON.stringify(parseServiceItemMemo(reopened.memo).slides)===JSON.stringify([regions.welcome,editedNews,regions.footer]),'announcement changed independent title or slide boundaries');
                      check(reopened.assignee==='명시 담당','reopen lost explicit announcement assignee');
                      const summary=serviceItemSummaryDisplayParts(reopened,service).title;
                      check(summary.includes('왼쪽에서 입력한 공지') && summary.includes('명시 담당') && !summary.includes('인도자'),'closed row shows unrelated title');
                      const preview=buildPresenterSlidesForServiceItem(reopened,service,0).find(slide=>slide.announcementRegions);
                      check(preview && preview.announcementRegions.news===editedNews,'preview lost ordered multiline news');
                      const legacy=structuredClone(reopened);
                      legacy.memo=serializeServiceItemMemo({elementType:'plain_text',inputMode:'text',slides:['1. 소식\\n설명','2. 소식']});
                      check(serviceAnnouncementRegions(legacy).news==='1. 소식\\n설명\\n\\n2. 소식','legacy news lost numbering or paragraphs');
                      applyServiceAnnouncementRegion(legacy,'news','1. 소식\\n설명\\n\\n2. 변경');
                      check(JSON.stringify(parseServiceItemMemo(legacy.memo).slides)===JSON.stringify(['1. 소식\\n설명','2. 변경']),'legacy edit lost slide boundaries');
                      const cleared=structuredClone(reopened);
                      for(const key of ['news','welcome','footer'])applyServiceAnnouncementRegion(cleared,key,'');
                      check(!liturgicalBodyText(cleared,parseServiceItemMemo(cleared.memo),'',service),'cleared announcement fell back to independent title');
                      check(presenterPreparationStructuredFields(service).find(f=>f.label==='광고').value===editedNews,'fresh sidebar news changed on reopen');
                      check(JSON.stringify(state.presenter)===beforeOutput,'edit/save touched output');
                      for(const input of refs.songList.querySelectorAll('[data-presenter-preparation-field]')) {
                        input.value=input.dataset.preparationRole==='assignee'?'김민수 집사':'완료된 공지';
                        input.dispatchEvent(new Event('input',{bubbles:true}));
                      }
                      renderServiceList();
                      check(!refs.songList.querySelector('.svc-outline-editor').hidden,'pending input auto-collapsed');
                      await applyPresenterPreparationInput(sid);
                      check(presenterPreparationFieldValues(service,presenterPreparationDefaultDraftForService(service)).every(row=>row.value),'fixture incomplete');
                      const firstPanel=refs.songList.querySelector('.svc-outline-editor');
                      check(!firstPanel.hidden,'apply without confirmed save collapsed editor');
                      failure=true;await commitPresenterInlineInput(firstPanel);
                      check(!firstPanel.hidden,'failed inline save collapsed editor');
                      failure=false;await commitPresenterInlineInput(firstPanel);
                      check(refs.songList.querySelector('.svc-outline-editor').hidden,'confirmed inline save did not collapse');
                      refs.songList.querySelector('[data-presenter-inline-toggle]').click();renderServiceList();
                      check(!refs.songList.querySelector('.svc-outline-editor').hidden,'manual reopen lost');
                      const edit=refs.songList.querySelector('[data-presenter-preparation-field]');edit.focus();edit.value='아직 반영하지 않은 입력';edit.dispatchEvent(new Event('input',{bubbles:true}));
                      renderServiceList();
                      check(!refs.songList.querySelector('.svc-outline-editor').hidden&&edit.value==='아직 반영하지 않은 입력','new draft auto-collapsed');
                      const other={id:crypto.randomUUID(),type_id:'fixture',date:'2026-10-13',title:'Other'};
                      state.services.push(other);state.serviceItems[other.id]=[];state.loadedWorshipServiceIds.add(other.id);
                      state.selectedServiceId=other.id;renderServiceList();renderPresenterDetail();
                      state.selectedServiceId=sid;renderServiceList();renderPresenterDetail();
                      let returned=refs.songList.querySelector('[data-presenter-preparation-field]');
                      check(returned.value==='아직 반영하지 않은 입력','service return lost pending input');
                      for(let i=0;i<2;i++)refs.songList.querySelector('[data-presenter-inline-toggle]').click();
                      returned=refs.songList.querySelector('[data-presenter-preparation-field]');
                      check(returned.value==='아직 반영하지 않은 입력'&&!returned.closest('.svc-outline-editor').hidden,'collapse/reopen lost pending input');
                      check(JSON.stringify(state.presenter)===beforeOutput,'service return changed output');
                      return 'PASS real input/save retry/reopen, service return, inline save confirmation and pending preservation';
    }'''),flush=True)
    page.unroute_all(behavior='wait')
   finally:browser.close()
finally:server.shutdown()
