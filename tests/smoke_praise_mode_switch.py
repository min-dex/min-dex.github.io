import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
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
    current().version_id='v1';current().song_version_id='v1';change('score_db');check(current().version_id==='v1','score mode replaced explicitly linked version without a score');
    // A linked record can be absent or only metadata-hydrated when the user changes mode.
    state.songs=[];clearSearchCaches();change('score_db');check(current().version_id==='v1','missing catalog cleared version');
    const pending='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';current().song_id=pending;
    state.songs=[{id:pending,title:'pending',versions:[]}];clearSearchCaches();change('lyrics_db');check(current().version_id==='v1','pending versions cleared ID');
    current().memo=serializeServiceItemMemo({...parseServiceItemMemo(current().memo),slides:['manual draft']});
    change('manual_praise');check(current().song_id===pending&&!current().version_id,'manual mode lost song or kept version');
    const hymn={id:'hymn',title:'모드 검증',hymn_no:'301',praise_types:['hymn'],_relationalVersionsLoaded:true,versions:[{id:'hv',name:'새찬송가',praise_types:['hymn'],hymn_no:'301',_worshipVersionPersisted:true,forms:[{id:'v1',part_type:'Verse',part_number:1,lyrics:'첫 절'},{id:'v2',part_type:'Verse',part_number:2,lyrics:'둘째 절'}]}]};
    state.songs=[hymn];clearSearchCaches();
    const make=(inputMode,outputMode)=>({id:'mode-score',service_id:service.id,label:'찬송',_worshipSectionKey:'hymn_praise',song_id:hymn.id,version_id:'hv',song_version_id:'hv',raw_title:'301 모드 검증',memo:serializeServiceItemMemo({elementType:'praise',inputMode,outputMode})});
    for(const [input,output,wanted] of [['lyrics_db','score','score_db'],['score_db','lyrics','lyrics_db'],['score_db','','score_db'],['lyrics_db','','lyrics_db'],['praise_db','악보','score_db'],['manual_praise','score','manual_praise'],['audio_praise','score','audio_praise'],['children_audio','score','children_audio']]){
     const item=make(input,output),before=JSON.stringify(item),memo=parseServiceItemMemo(item.memo);
     check(servicePraiseInputMode(item,memo,service)===wanted,'effective mode '+input+'/'+output);
     check(serviceItemUsesScoreInputMode(item,memo)===(wanted==='score_db'),'editor score predicate');
     check(presenterServiceItemUsesScoreInputMode(item,memo)===(wanted==='score_db'),'presenter score predicate');
     check(serviceItemOutputMode(item,memo)===(wanted==='score_db'?'score':'lyrics'),'effective output');
     const model=serviceItemEditorModel(item,{service});check(model.praiseInputMode===wanted,'editor model mode');
     check(renderServicePraiseInputModeControl(item,0,model).includes('value="'+wanted+'" selected'),'selected display mode');
     check(JSON.stringify(item)===before,'mode resolution rewrote config');
    }
    const legacy=make('lyrics_db','score');state.serviceItems[service.id]=[legacy];
    state.hymnScoreManifest={};state.hymnScoreManifestLoaded=false;
    const before=JSON.stringify({legacy,hymn});
    const pendingDeck=buildPresenterSlidesForServiceItem(legacy,service,0,{allowHydration:false});
    check(pendingDeck.length>0&&pendingDeck.some(s=>s.loadingContent),'cold score load disappeared');
    check(serviceFormInputWarnings(legacy).length===0&&!renderServiceFormHintInput(legacy,0).includes('aria-invalid="true"'),'loading became form error');
    const explicit={...legacy,memo:serializeServiceItemMemo({...parseServiceItemMemo(legacy.memo),asset:{kind:'score',slides:[{url:'assets/icon-192.png',formLabel:'V1'}]}})};
    check(buildPresenterSlidesForServiceItem(explicit,service,0,{allowHydration:false}).some(s=>s.type==='image')&&!buildPresenterSlidesForServiceItem(explicit,service,0,{allowHydration:false}).some(s=>s.loadingContent),'authored score waits for manifest');
    state.hymnScoreManifest={'301':{title:'모드 검증',slides:[{src:'assets/icon-192.png',scoreFormLabel:'Verse 1',scoreFormKey:'score:verse-1'},{src:'assets/icon-512.png'},{src:'assets/icon-192.png',scoreFormLabel:'Verse 2',scoreFormKey:'score:verse-2'}]}};state.hymnScoreManifestLoaded=true;
    const ready=buildPresenterSlidesForServiceItem(legacy,service,0,{allowHydration:false});
    check(ready.filter(s=>s.type==='image').length===3&&!ready.some(s=>s.loadingContent),'score load did not recover');
    check(serviceItemDefaultFormHint(legacy)==='V1-V2','score default hint');
    check(JSON.stringify({legacy,hymn})===before,'score loading/render changed source');
    legacy.memo=serializeServiceItemMemo({...parseServiceItemMemo(legacy.memo),formPreset:{forms:['V2','V1','V2'],hint:'V2-V1-V2',strength:'manual',titleSequence:true},audio:{url:'keep-audio.mp3',startTimes:[0,10,20]}});
    const authored=legacy.memo,ordered=buildPresenterSlidesForServiceItem(legacy,service,0,{allowHydration:false}).filter(s=>s.type==='image');
    check(ordered.length===4&&ordered[0].formLabel==='Verse 2','manual score sequence changed');
    check(legacy.memo===authored,'manual forms/audio config changed');
    state.serviceItems[service.id]=[legacy];change('lyrics_db');
    check(servicePraiseInputMode(current())==='lyrics_db'&&serviceItemOutputMode(current())==='lyrics','legacy score stuck after user change');
    check(JSON.stringify(parseServiceItemMemo(current().memo).formPreset)===JSON.stringify(parseServiceItemMemo(authored).formPreset),'mode change lost manual form');
    change('score_db');check(servicePraiseInputMode(current())==='score_db'&&serviceItemOutputMode(current())==='score','user score choice lost');
    return 'PASS mode agreement, cold/warm scores, source/forms/audio preservation, actual switching and compatible versions';
   }'''));b.close()

finally:server.shutdown()
