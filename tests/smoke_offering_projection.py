import os,sys
os.environ['MINDEX_SMOKE_OFFLINE']='1'
sys.path.insert(0,'tests')
from smoke_app import start_local_app_server,sync_playwright
from urllib.parse import urlsplit
s,u=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=getattr(p,engine).launch(headless=True);page=b.new_page()
   page.add_init_script("Element.prototype.requestFullscreen=async()=>{};Element.prototype.webkitRequestFullscreen=()=>{};window.open=()=>null")
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(u).netloc else r.abort())
   page.goto(u+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterBoardSubgroup==='function'&&!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''()=>{
const service={id:'qa-offering',type_id:'sunday-main',date:'2026-10-18',alias:'온세대 찬양예배'};
const hymn=normalizeServiceItem({id:'qa-hymn',service_id:service.id,label:'봉헌찬송',raw_title:'빛의 사자들이여',song_id:'qa-song',version_id:'qa-version',_worshipSectionKey:'offering',_worshipElementOrder:1,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V2-C-V1-C'})});
const prayer=normalizeServiceItem({id:'qa-prayer',service_id:service.id,label:'봉헌기도',assignee:'김남영 목사',_worshipSectionKey:'offering',_worshipElementOrder:1,memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text'})});
state.services=[service];state.selectedServiceId=service.id;state.songs=[{id:'qa-song',title:'빛의 사자들이여',_relationalVersionsLoaded:true,versions:[{id:'qa-version',name:'선택 버전',forms:[{part_type:'Verse 1',lyrics:'첫째 절'},{part_type:'Verse 2',lyrics:'둘째 절'},{part_type:'Chorus',lyrics:'후렴'}]}]}];
for(const items of [[hymn],[hymn,prayer],[prayer,hymn]]){
const before=JSON.stringify(items);const projected=projectWorshipServiceItemsFromTemplate(service,items);const h=projected.find(i=>i.id==='qa-hymn');if(!h||h.label!=='봉헌찬송'||h.song_id!=='qa-song'||h.version_id!=='qa-version'||parseServiceItemMemo(h.memo).formHint!=='V2-C-V1-C')throw Error('hymn lost or changed '+JSON.stringify(projected.filter(i=>i._worshipSectionKey==='offering')));const prayers=projected.filter(i=>i.label==='봉헌기도');if(prayers.length!==1||prayers[0].song_id)throw Error('prayer inherited hymn');if(JSON.stringify(items)!==before)throw Error('mutated source');state.serviceItems={[service.id]:projected};const slides=buildPresenterSlidesForServiceItem(h,service,0);if(slides.length<3)throw Error('missing hymn slides');}
const mixed={...prayer,song_id:hymn.song_id,version_id:hymn.version_id,raw_title:hymn.raw_title,memo:serializeServiceItemMemo({elementType:'title_person',outputMode:'score',formHint:'V2-C-V1-C'})};const mixedBefore=JSON.stringify(mixed);const recovered=recoverAllGenerationsOfferingItems(service,[mixed]);if(recovered.length!==2||recovered[0].song_id!==hymn.song_id||parseServiceItemMemo(recovered[0].memo).inputMode!=='score_db'||recovered[1].id!==prayer.id||recovered[1].assignee!==prayer.assignee||recovered[1].song_id)throw Error('legacy recovery');if(JSON.stringify(mixed)!==mixedBefore||recoverAllGenerationsOfferingItems(service,recovered).length!==2)throw Error('recovery mutation/idempotence');
const reprojection=projectWorshipServiceItemsFromTemplate(service,recovered);if(reprojection.filter(i=>i._worshipSectionKey==='offering').length!==2)throw Error('recovered items collapsed');
const empty={...hymn,song_id:null,version_id:null,raw_title:'',memo:serializeServiceItemMemo({elementType:'praise'})};if(!shouldDropAllGenerationsRegularThirdProjectionExtra(service,empty))throw Error('empty inherited hymn retained');
const contexts=[{item:hymn,index:0,service},{item:prayer,index:1,service}];document.body.innerHTML='<main style="padding:20px">'+contexts.map(context=>{presenterBoardSubgroupInputContexts=()=>[context];presenterBoardSubgroupItemContext=()=>context;presenterBoardSubgroupDisplay=()=>({label:context.item.label,title:context.item.raw_title});return renderPresenterBoardSubgroup({slides:[],name:context.item.label},-1,service.id,{showHead:true})}).join('')+'</main>';applyTheme('dark');return 'PASS hymn/prayer separate; song/version/form and source retained; slides generated';
}'''),flush=True)
   page.screenshot(path=f'/tmp/offering-fixed-{engine}.png')
   b.close()
finally:s.shutdown()
