"""Native worship variant selection: offline DOM events and persistence roundtrip."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, launch_chromium, sync_playwright
server, url = start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium', 'webkit'):
   browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
   page = browser.new_page(viewport={'width':1280,'height':900})
   page.on('pageerror',lambda error:print('PAGE ERROR',error.stack,flush=True))
   page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.route('**/app.runtime.js*', lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'), content_type='text/javascript'))
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof serviceNativeSongVariants==='function' && typeof installSingleSongSession==='function' && !document.body.classList.contains('ui-booting')")
   print(engine, page.evaluate(r'''async()=>{
    const check=(x,m)=>{if(!x)throw Error(m)}, same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const ids=['SONG-CONT-9001-0001','SONG-CONT-9001-0002','SONG-CONT-9001-0003','SONG-CONT-9002-0001'];
    const missing='SONG-CONT-9001-0004';
    const records=ids.map((id,i)=>({id,revision:1,metadata:{title:'같은 제목',praise_types:['ccm']},
      content:{name:['원곡','편곡','다른 언어','동명 다른 곡'][i],praise_types:['ccm'],forms:[{id:crypto.randomUUID(),part_type:'Verse',part_number:i===2?2:1,lyrics:'가사 '+i,sort_order:1}]},
      relations:{same_song:i===0?[ids[1],missing]:i===1?[ids[0],ids[2]]:i===2?[ids[1]]:[],related:i===0?[ids[3]]:[]}}));
    installSingleSongSession(records,{read:async()=>records,save:async()=>{throw Error('song write forbidden')}});
    const service={id:crypto.randomUUID(),type_id:'custom',date:'2026-10-25',title:'오프라인 예시'};
    const make=(id,order)=>({id:crypto.randomUUID(),service_id:service.id,sort_order:order,label:'찬양 '+order,raw_title:'사용자가 적은 제목',song_id:id,version_id:null,song_version_id:null,
      memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-V1',audioTiming:{starts:[0,8,16]},note:'보존 메모',slides:['직접 입력 가사']})});
    state.services=[service];state.selectedServiceId=service.id;state.serviceItems={[service.id]:normalizeServiceItemsInCurrentOrder([make(ids[0],1),make(ids[1],2)])};
    const members=getServiceItems(service.id),group={groupId:'fixture-medley',primaryItemId:members[0].id,itemIds:members.map(i=>i.id),title:'메들리'};
    members.forEach((item,i)=>{const memo=parseServiceItemMemo(item.memo);memo.connectedPraise={...group,role:i?'secondary':'primary'};item.memo=serializeServiceItemMemo(memo)});
    state.client=null;state.loading=false;state.saving=false;
    updateSaveState=()=>{};refreshPresenterForService=()=>{};schedulePresenterRefreshForService=()=>{};
    let saved=null,writes=0;
    saveCommittedServiceItem=(index,sid)=>{writes++;saved=buildWorshipPersistenceRows(service,getServiceItems(sid),{},{},{singleSongCatalog:state.singleSongCatalog,singleSongStorage:'native'});};
    const before=structuredClone(getServiceItems(service.id));
    // Catalogue-only peer works even before it is in the UI song list.
    state.songs=state.songs.filter(s=>s.id!==ids[2]);clearSearchCaches();
    const mount=()=>refs.detailPane.innerHTML=getServiceItems(service.id).map((item,index)=>renderServiceSongVersionPicker(item,index,serviceItemEditorModel(item,{service}))).join('');
    mount();const select=refs.detailPane.querySelector('select');
    check(select.value===ids[0],'current native record not selected');
    check([...select.options].some(o=>o.value===ids[2]),'transitive/catalog-only variant missing');
    check(![...select.options].some(o=>o.value===ids[3]),'same-title or related-only song leaked into versions');
    check([...select.options].find(o=>o.value===missing)?.disabled,'missing record must remain disabled');
    check(!!refs.detailPane.querySelector('[data-service-song-retry]'),'explicit retry missing');
    select.value=ids[2];select.dispatchEvent(new Event('change',{bubbles:true}));
    const after=getServiceItems(service.id);
    check(after[0].song_id===ids[2]&&!after[0].version_id&&!after[0].song_version_id,'native identity not switched');
    check(after[0].raw_title===before[0].raw_title&&after[0].memo===before[0].memo,'user title/form/timing/manual data changed');
    const warningItem=structuredClone(after[0]),warningMemo=parseServiceItemMemo(warningItem.memo);warningMemo.slides=[];warningItem.memo=serializeServiceItemMemo(warningMemo);
    check(serviceFormInputWarnings(warningItem,'V1-V1').length>0,'incompatible DB form must remain a visible warning');
    check(after[1].song_id===before[1].song_id&&after[1].memo===before[1].memo,'sibling medley item changed');
    check(writes===1&&saved.elements.some(row=>row.praise_record_id===ids[2]&&row.song_id===null&&row.song_version_id===null),'select did not use native save path');
    const reopened=groupWorshipElements(saved.sections,saved.elements)[service.id];
    check(reopened[0].song_id===ids[2],'reopened variant not retained');
    const memo=parseServiceItemMemo(reopened[0].memo),original=parseServiceItemMemo(before[0].memo);
    check(memo.formHint===original.formHint&&same(memo.audioTiming,original.audioTiming)&&same(memo.slides,original.slides),'save/reopen changed form/timing/lyrics');
    // Forged/unrelated selections and missing records cannot mutate editor state.
    const snapshot=JSON.stringify(getServiceItems(service.id));
    for(const id of [ids[3],missing,'unknown'])updateServiceItemField({value:id,dataset:{serviceItemField:'praise_record_id',serviceItemIndex:'0',serviceId:service.id}});
    check(JSON.stringify(getServiceItems(service.id))===snapshot,'invalid variant mutated data');
    // Manual data survives an explicit switch back as well.
    mount();const back=refs.detailPane.querySelector('select');back.value=ids[0];back.dispatchEvent(new Event('change',{bubbles:true}));
    check(getServiceItems(service.id)[0].song_id===ids[0]&&getServiceItems(service.id)[0].memo===before[0].memo,'switch-back changed memo');
    return 'PASS native group/transitive/catalog-only selection; missing/forged guards; per-member preservation; real DOM change to native persistence roundtrip';
   }'''), flush=True)
   browser.close()
finally: server.shutdown()
