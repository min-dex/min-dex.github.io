"""Manual lyrics seed selected version/form order before unlinking; no DB access."""
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page();page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.goto(url);page.wait_for_function("typeof serviceManualPraiseSeedSlides==='function' && typeof state!=='undefined' && !document.body.classList.contains('ui-booting')")
    print(engine,page.evaluate('''async()=>{
     const check=(x,m)=>{if(!x)throw Error(m)};
     const sid=crypto.randomUUID(),songId=crypto.randomUUID(),vid=crypto.randomUUID();
     const service={id:sid,type_id:'manual-seed-fixture',date:'2000-01-01',title:'Fixture'};
     const song={id:songId,title:'Fixture',praise_types:['ccm'],_relationalVersionsLoaded:true,versions:[
      {id:crypto.randomUUID(),name:'Other',forms:[{label:'Verse',part_type:'Verse',lyrics:'WRONG'}]},
      {id:vid,name:'Selected',praise_types:['ccm'],forms:[{id:'v',label:'Verse',part_type:'Verse',lyrics:'verse line'},{id:'c',label:'Chorus',part_type:'Chorus',lyrics:'chorus line'}]}]};
     state.services=[service];state.songs=[song];clearSearchCaches();state.selectedServiceId=sid;state.loadedWorshipServiceIds.add(sid);
     const ids=[crypto.randomUUID(),crypto.randomUUID()];const group={groupId:crypto.randomUUID(),primaryItemId:ids[0],itemIds:ids,title:'Fixture medley'};
     const fresh=(slides=[])=>normalizeServiceItem({id:ids[0],service_id:sid,label:'찬양 1',raw_title:song.title,song_id:songId,version_id:vid,song_version_id:vid,_worshipSectionKey:'praise',_worshipSlotKey:'praise.song.1',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V-C-V',formPreset:{forms:['Verse','Chorus','Verse'],strength:'manual'},slides,connectedPraise:{...group,role:'primary'}})},0);
     refreshPresenterForService=()=>{};updateSaveState=()=>{};
     const field=()=>({value:'manual_praise',dataset:{serviceId:sid,serviceItemIndex:'0',serviceItemField:'praise_input_mode'}});
     const set=item=>{state.serviceItems[sid]=[item,normalizeServiceItem({id:ids[1],service_id:sid,label:'찬양 2',raw_title:'Sibling',memo:serializeServiceItemMemo({elementType:'praise',connectedPraise:{...group,role:'secondary'}})},1)]};
     set(fresh());const before=JSON.stringify(song);const sibling=JSON.stringify(getServiceItems(sid)[1]);
     const seed=serviceManualPraiseSeedSlides(getServiceItems(sid)[0],service);check(seed.length,'seed empty before switch '+JSON.stringify({id:getServiceItems(sid)[0].song_id,version:getPresenterServiceItemVersion(song,getServiceItems(sid)[0],service),plan:presenterFormPlanForServiceItem(song.versions[1],getServiceItems(sid)[0],song)}));
     await updateServiceItemField(field());let item=getServiceItems(sid)[0],memo=parseServiceItemMemo(item.memo);
     check(JSON.stringify(memo.slides)===JSON.stringify(['verse line','chorus line','verse line']),'version/form repeat seed '+JSON.stringify(memo.slides));
     check(item.song_id===songId&&!item.version_id,'manual song retention');check(JSON.stringify(memo.connectedPraise)===JSON.stringify(normalizeServiceConnectedPraise({...group,role:'primary'})),'medley changed');
     check(JSON.stringify(song)===before,'source mutated');check(JSON.stringify(getServiceItems(sid)[1])===sibling,'sibling changed');
     const rows=buildWorshipPersistenceRows(service,getServiceItems(sid),{},{},{elementTypedStateColumns:{inputMode:true,contentState:true}});
     const reopened=groupWorshipElements(rows.sections,rows.elements)[sid].find(x=>parseServiceItemMemo(x.memo).inputMode==='manual_praise');check(JSON.stringify(parseServiceItemMemo(reopened.memo).slides)===JSON.stringify(memo.slides),'roundtrip lost lyrics');
     for(const mode of ['lyrics_db','score_db','children_audio']) {
      set(fresh()); await updateServiceItemField(field());
      applyServiceManualPraiseSlides(getServiceItems(sid)[0],['QA_MANUAL_SENTINEL']);
      check(getServiceItems(sid)[0].song_id===songId,'manual edit lost song');
      await updateServiceItemField({value:mode,dataset:{serviceId:sid,serviceItemIndex:'0',serviceItemField:'praise_input_mode'}});
      const returned=getServiceItems(sid)[0],m=parseServiceItemMemo(returned.memo);
      check(returned.song_id===songId&&!returned.version_id&&!returned.song_version_id,'reverse identity');
      check(!m.slides.length&&m.formHint==='V-C-V','reverse residual/form');
      check(serviceItemSongVersionIdForSave(returned,service)===null,'save chose version');
      check(getPresenterServiceItemVersion(song,returned,service)===null,'presenter chose version');
      check(renderServiceSongVersionPicker(returned,0,serviceItemEditorModel(returned,{service})).includes('버전을 선택해 주세요'),'missing prompt');
      await resolveServiceSongSelectionBeforeSave(sid,0);
      check(returned.song_id===songId&&!returned.version_id,'pre-save chose version');
      const persisted=buildWorshipPersistenceRows(service,getServiceItems(sid),{},{},{elementTypedStateColumns:{inputMode:true,contentState:true}});
      const restored=groupWorshipElements(persisted.sections,persisted.elements)[sid].find(x=>x.id===returned.id)||groupWorshipElements(persisted.sections,persisted.elements)[sid].find(x=>x.song_id===songId);
      check(restored.song_id===songId&&!restored.version_id&&!parseServiceItemMemo(restored.memo).slides.length,'reverse roundtrip');
     }
     set(fresh(['my edited lyrics']));await updateServiceItemField(field());check(parseServiceItemMemo(getServiceItems(sid)[0].memo).slides[0]==='my edited lyrics','existing manual overwritten');
     // A delayed load may not overwrite a newer user edit.
     set(fresh());song._relationalVersionsLoaded=false;let release;
     loadSongsForIds=()=>new Promise(r=>release=r);loadRelationalSongVersionData=async()=>{song._relationalVersionsLoaded=true};
     const pending=updateServiceItemField(field());getServiceItems(sid)[0].raw_title='newer edit';release();await pending;
     check(getServiceItems(sid)[0].song_id===songId,'stale load unlinked newer item');
     set(fresh());song._relationalVersionsLoaded=false;loadSongsForIds=async()=>{};
     await updateServiceItemField(field());check(parseServiceItemMemo(getServiceItems(sid)[0].memo).slides.length===3,'hydration failed to seed');
     set(fresh());song._relationalVersionsLoaded=false;loadSongsForIds=async()=>{throw Error('offline')};showToast=()=>{};
     await updateServiceItemField(field());check(getServiceItems(sid)[0].song_id===songId&&parseServiceItemMemo(getServiceItems(sid)[0].memo).inputMode==='lyrics_db','failed load destroyed source');
     return 'PASS chosen version, V-C-V repetition, existing edit, medley/sibling/source preservation, roundtrip, loading and stale/failure guards';
    }'''),flush=True)
   finally:browser.close()
finally:server.shutdown();server.server_close()
