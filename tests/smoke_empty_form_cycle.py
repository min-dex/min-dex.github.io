"""Cleared form uses playback inference without materializing defaults or DB writes."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page();page.goto(url);page.wait_for_function("!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const forms=[{id:'v1',part_type:'Verse',part_number:1,lyrics:'첫 절'}, {id:'v2',part_type:'Verse',part_number:2,lyrics:'둘째 절'}, {id:'c',part_type:'Chorus',lyrics:'후렴'}];
    const sid=crypto.randomUUID(),song={id:crypto.randomUUID(),title:'Fixture',_relationalVersionsLoaded:true,versions:[{id:crypto.randomUUID(),name:'기본',praise_types:['ccm'],forms}]};
    const version=song.versions[0],service={id:sid,type_id:'fixture',date:'2000-01-01',title:'Fixture'};
    state.services=[service];state.songs=[song];state.selectedServiceId=sid;state.loadedWorshipServiceIds.add(sid);clearSearchCaches();
    refreshPresenterForService=()=>{};updateSaveState=()=>{};
    for(const label of ['특송','봉헌특송','찬양 1','입례찬양','봉헌찬송']){
     const item=normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,label,raw_title:song.title,song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-V2-C',formPreset:{forms:['V1','V2','C'],strength:'manual'}})},0);
     state.serviceItems[sid]=[item];
     check(presenterFormPlanForServiceItem(version,item,song).forms.map(f=>f.id).join()==='v1,v2,c','explicit order changed');
     await updateServiceItemField({value:'',dataset:{serviceId:sid,serviceItemIndex:'0',serviceItemField:'form_hint'}});
     const cleared=getServiceItems(sid)[0],before=JSON.stringify(cleared);
     const plan=presenterFormPlanForServiceItem(version,cleared,song);
     check(plan.forms.map(f=>f.id).join()==='v1,c,v2,c',label+' cleared order');
     const slides=buildPresenterSlidesForServiceItem(cleared,service,0).filter(s=>s.type==='lyrics');
     check(slides.map(s=>s.text).join('|')==='첫 절|후렴|둘째 절|후렴',label+' actual slides '+slides.map(s=>s.text));
     check(serviceItemEffectiveFormHint(cleared)==='' && !presenterServiceItemFormPreset(version,cleared,song,{includePlaybackFallback:false}),'inference leaked into form field');
     check(JSON.stringify(cleared)===before,'render mutated item');
     const reopened={...cleared,memo:serializeServiceItemMemo(parseServiceItemMemo(cleared.memo))};
     check(presenterFormPlanForServiceItem(version,reopened,song).forms.map(f=>f.id).join()==='v1,c,v2,c','reopen');
     check(presenterFormPlanForServiceItem({forms:forms.slice(0,2)},cleared,song).forms.length===2,'missing chorus');
    }
    const disabled={memo:serializeServiceItemMemo({formPresetDisabled:true})};
    check(presenterFormPlanForServiceItem({...version,praise_types:['children']},disabled,song).forms.map(f=>f.id).join()==='v1,v2,c','children changed');
    return 'PASS clear field, actual lyric slides, 5 labels, explicit order, reopen, no mutation, empty editor and children preservation';
   }'''))
   b.close()
finally:server.shutdown()
