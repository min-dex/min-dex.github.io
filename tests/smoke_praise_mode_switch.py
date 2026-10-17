from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url);page.wait_for_function("typeof state!=='undefined' && typeof updateServiceItemField==='function' && !!refs.detailPane")
   print(page.evaluate('''()=>{
     const service={id:'mode-fixture',type_id:'fixture',date:'2026-10-14'};
     state.services=[service];state.selectedServiceId=service.id;state.module='service';
     state.songs=[{id:'song',title:'시험 찬양',hymn_no:1,versions:[{id:'v1',_worshipVersionPersisted:true,name:'편곡',praise_types:['ccm']},{id:'v2',_worshipVersionPersisted:true,name:'새찬송가',praise_types:['hymn']}]}];clearSearchCaches();
     refreshPresenterForService=()=>{};updateSaveState=()=>{};
     const item=normalizeServiceItem({id:'item',service_id:service.id,label:'찬양',song_id:'song',version_id:'v2',song_version_id:'v2',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',outputMode:'lyrics',connectedPraise:{groupId:'mode-medley',role:'primary',primaryItemId:'item',itemIds:['item','next']}})},0);
     const secondary=normalizeServiceItem({...item,id:'next',memo:serializeServiceItemMemo({...parseServiceItemMemo(item.memo),connectedPraise:{groupId:'mode-medley',role:'secondary',primaryItemId:'item',itemIds:['item','next']}})},1);
     state.serviceItems[service.id]=[item,secondary];
     updateServiceItemField({value:'score_db',dataset:{serviceId:service.id,serviceItemIndex:'0',serviceItemField:'praise_input_mode'}});
     const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    const current=()=>state.serviceItems[service.id][0];
    check(current().version_id==='v2','score mode reset compatible version');
    const change=mode=>updateServiceItemField({value:mode,dataset:{serviceId:service.id,serviceItemIndex:'0',serviceItemField:'praise_input_mode'}});
    change('lyrics_db');check(current().version_id==='v2','lyrics mode reset chosen version');
    check(parseServiceItemMemo(current().memo).connectedPraise?.groupId==='mode-medley','mode change lost medley');
    const rows=buildWorshipPersistenceRows(service,state.serviceItems[service.id],{}, {},{elementTypedStateColumns:{inputMode:true,contentState:true}});
    const restored=groupWorshipElements(rows.sections,rows.elements)[service.id][0];
    check(restored.song_id==='song'&&restored.version_id==='v2','round trip lost song/version');
    check(servicePraiseInputMode(restored,parseServiceItemMemo(restored.memo),service)==='lyrics_db','round trip lost effective mode');
    current().version_id='v1';current().song_version_id='v1';change('score_db');check(current().version_id==='v2','score mode kept incompatible version');
    // A linked record can be absent or only metadata-hydrated when the user changes mode.
    state.songs=[];clearSearchCaches();change('score_db');check(current().version_id==='v2','missing catalog cleared version');
    const pending='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';current().song_id=pending;
    state.songs=[{id:pending,title:'pending',versions:[]}];clearSearchCaches();change('lyrics_db');check(current().version_id==='v2','pending versions cleared ID');
    current().memo=serializeServiceItemMemo({...parseServiceItemMemo(current().memo),slides:['manual draft']});
    change('manual_praise');check(current().song_id===pending&&!current().version_id,'manual mode lost song or kept version');
    return 'PASS compatible versions, roundtrip, missing/partial catalog and manual song retention';
   }'''));b.close()

finally:server.shutdown()
