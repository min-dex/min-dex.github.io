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
   print(engine,page.evaluate(r'''()=>{
const service={id:'qa-offering',type_id:'sunday-main',date:'2026-10-18',alias:'온세대 찬양예배'};
const hymn=normalizeServiceItem({id:'qa-hymn',service_id:service.id,label:'봉헌찬송',_worshipElementTemplateModified:true,raw_title:'빛의 사자들이여',song_id:'qa-song',version_id:'qa-version',_worshipSectionKey:'offering',_worshipElementOrder:1,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V2-C-V1-C'})});
const prayer=normalizeServiceItem({id:'qa-prayer',service_id:service.id,label:'봉헌기도',assignee:'김남영 목사',_worshipSectionKey:'offering',_worshipElementOrder:1,memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text'})});
state.services=[service];state.selectedServiceId=service.id;state.songs=[{id:'qa-song',title:'빛의 사자들이여',_relationalVersionsLoaded:true,versions:[{id:'qa-version',name:'선택 버전',_worshipVersionPersisted:true,forms:[{part_type:'Verse 1',lyrics:'첫째 절'},{part_type:'Verse 2',lyrics:'둘째 절'},{part_type:'Chorus',lyrics:'후렴'}]}]}];
for(const items of [[hymn],[hymn,prayer],[prayer,hymn]]){
const before=JSON.stringify(items);const projected=projectWorshipServiceItemsFromTemplate(service,items);const h=projected.find(i=>i.id==='qa-hymn');if(!h||h.label!=='봉헌찬송'||h.song_id!=='qa-song'||h.version_id!=='qa-version'||parseServiceItemMemo(h.memo).formHint!=='V2-C-V1-C')throw Error('hymn lost or changed '+JSON.stringify(projected.filter(i=>i._worshipSectionKey==='offering')));const prayers=projected.filter(i=>i.label==='봉헌기도');if(prayers.length!==1||prayers[0].song_id)throw Error('prayer inherited hymn');if(projected.indexOf(h)>projected.indexOf(prayers[0]))throw Error('hymn after prayer');if(JSON.stringify(items)!==before)throw Error('mutated source');state.serviceItems={[service.id]:projected};const slides=buildPresenterSlidesForServiceItem(h,service,0);if(slides.length<3)throw Error('missing hymn slides');}
const mixed={...prayer,song_id:hymn.song_id,version_id:hymn.version_id,raw_title:hymn.raw_title,memo:serializeServiceItemMemo({elementType:'title_person',outputMode:'score',formHint:'V2-C-V1-C'})};const mixedBefore=JSON.stringify(mixed);const recovered=recoverAllGenerationsOfferingItems(service,[mixed]);if(recovered.length!==2||recovered[0].song_id!==hymn.song_id||parseServiceItemMemo(recovered[0].memo).inputMode!=='score_db'||recovered[1].id!==prayer.id||recovered[1].assignee!==prayer.assignee||recovered[1].song_id)throw Error('legacy recovery');if(JSON.stringify(mixed)!==mixedBefore||recoverAllGenerationsOfferingItems(service,recovered).length!==2)throw Error('recovery mutation/idempotence');
const reprojection=projectWorshipServiceItemsFromTemplate(service,recovered);if(reprojection.filter(i=>i._worshipSectionKey==='offering').length!==2)throw Error('recovered items collapsed');
const empty={...hymn,song_id:null,version_id:null,raw_title:'',memo:serializeServiceItemMemo({elementType:'praise'})};if(shouldDropAllGenerationsRegularThirdProjectionExtra(service,empty))throw Error('shared offering slot dropped'); if(!shouldDropAllGenerationsRegularThirdProjectionExtra({...service,date:'2026-08-23'},empty))throw Error('replacement day got shared hymn');

if(!sundayEditSyncEligible(hymn,service))throw Error('all-generation offering excluded');
if(sundayEditSyncEligible(hymn,{...service,date:'2026-08-23'}))throw Error('video day participates');
if(sundaySharedContentTypesForItem({...hymn,label:'찬양 3',_worshipSectionKey:'praise',_worshipSlotKey:'praise.song.3'},service).length)throw Error('independent praise linked');
const sourcePrayer={...prayer,_worshipSectionId:'existing-offering',_worshipSectionTitle:'봉헌',_worshipElementOrder:1};
state.serviceItems[service.id]=[sourcePrayer];
state.services=[{...service,type_id:'fixture'}];
const sourceText='[[봉헌]]\n[봉헌찬송]\n- 유형: praise\n- 입력: score_db\n- 곡 ID: qa-song\n- 버전 ID: qa-version\n[봉헌기도]\n- 유형: title_person\n- 입력: text';
const sourceRecords=parseServiceSourceText(sourceText);
if(ensurePortableSourceItems(service,sourceRecords)!==1)throw Error('missing source insertion');
const inserted=state.serviceItems[service.id];
if(inserted.length!==2||inserted[0].label!=='봉헌찬송'||inserted[1].id!==prayer.id||inserted[0]._worshipSectionId!=='existing-offering'||inserted[1]._worshipElementOrder!==2)throw Error('source insertion order/identity');
if(ensurePortableSourceItems(service,sourceRecords)!==0)throw Error('duplicate insertion');
const insertedHymn={...inserted[0],song_id:hymn.song_id,version_id:hymn.version_id,raw_title:hymn.raw_title};
state.services=[service];
const sourceProjection=projectWorshipServiceItemsFromTemplate(service,[insertedHymn,inserted[1]]);
if(sourceProjection.filter(i=>i.label==='봉헌찬송').length!==1||sourceProjection.filter(i=>i.label==='봉헌기도').length!==1)throw Error('source collapse');
const ids=sourceProjection.map(i=>i.id);if(ids.indexOf(insertedHymn.id)>ids.indexOf(prayer.id))throw Error('source reordered');
const savedRows=buildWorshipPersistenceRows(service,sourceProjection,{},{});
const readback=projectWorshipServiceItemsFromTemplate(service,groupWorshipElements(savedRows.sections,savedRows.elements)[service.id]||[]);
const savedHymn=readback.find(i=>i.label==='봉헌찬송');const savedPrayer=readback.find(i=>i.label==='봉헌기도');
if(!savedHymn||!savedPrayer||savedHymn.song_id!==hymn.song_id||savedHymn.version_id!==hymn.version_id||readback.indexOf(savedHymn)>readback.indexOf(savedPrayer))throw Error('save/readback lost offering');
const template=serviceOrderTemplate('sunday-main',{service,items:[]}).find(s=>s.sectionKey==='offering');
if(template.elements[0].label!=='봉헌찬송'||template.elements[1].label!=='봉헌기도')throw Error('missing default shared slot');
const regular={...service,alias:'',date:'2026-10-04'};
const entrance={...hymn,id:'entrance',label:'입례찬양',_worshipSlotKey:'praise.entrance',_worshipSectionKey:'praise',_worshipElementOrder:7};
const praiseSeven={...entrance,id:'praise-seven',label:'찬양 7',_worshipSlotKey:'praise.song.7'};
const separated=collapseDuplicateTemplateProjectionItems(regular,[entrance,praiseSeven]);
if(separated.length!==2)throw Error('different slots collapsed by ordinal');
// The two labels occupy one position and survive an actual persistence row round-trip.
for (const type of ['sunday-first','sunday-second','sunday-main']) {
 for (const date of ['2026-10-04','2026-10-18']) {
  const svc={...service,type_id:type,date,alias:''}; state.services=[svc];
  let changed={...hymn,_worshipSlotKey:'offering.praise'};
  const preserved=JSON.stringify([changed.memo,changed.raw_title,changed.song_id,changed.version_id]);
  if(!replaceServiceOfferingSpecial(changed,true))throw Error('toggle failed');
  if(JSON.stringify([changed.memo,changed.raw_title,changed.song_id,changed.version_id])!==preserved)throw Error('toggle changed content');
  changed._worshipElementTemplateModified=false; // Legacy special labels also remain independent.
  state.serviceItems[svc.id]=[changed,prayer];
  for(let n=0;n<2;n++){
   const projected=projectWorshipServiceItemsFromTemplate(svc,state.serviceItems[svc.id]);
   const specials=projected.filter(i=>i.label==='봉헌특송');
   if(specials.length!==1||projected.some(i=>i.label==='봉헌찬송'))throw Error('duplicate offering '+type+' '+date+' '+JSON.stringify(projected.filter(i=>i._worshipSectionKey==='offering').map(i=>({id:i.id,label:i.label,slot:i._worshipSlotKey,m:i._worshipElementTemplateModified}))));
   changed=specials[0];
   if(serviceItemSlotKey(changed)!=='offering.special'||sundayEditSyncEligible(changed,svc))throw Error('special linked to common hymn');
   const rows=buildWorshipPersistenceRows(svc,projected,{},{});
   state.serviceItems[svc.id]=groupWorshipElements(rows.sections,rows.elements)[svc.id];
  }
  changed=state.serviceItems[svc.id].find(i=>i.label==='봉헌특송');
  if(!renderServiceOfferingSpecialToggle(changed,svc).includes('data-service-offering-toggle="hymn"'))throw Error('reverse control missing');
  if(!replaceServiceOfferingSpecial(changed,false))throw Error('reverse toggle failed');
  const restored=projectWorshipServiceItemsFromTemplate(svc,state.serviceItems[svc.id]);
  if(restored.filter(i=>i.label==='봉헌찬송').length!==1||restored.some(i=>i.label==='봉헌특송'))throw Error('reverse duplicate');
  const h=restored.find(i=>i.label==='봉헌찬송');
  if(h.song_id!==hymn.song_id||h.version_id!==hymn.version_id||parseServiceItemMemo(h.memo).formHint!=='V2-C-V1-C')throw Error('round-trip content lost');
  if(!replaceServiceOfferingSpecial(h,'video'))throw Error('video switch failed');
  const videoRows=buildWorshipPersistenceRows(svc,[h,prayer],{},{});
  let videoItems=projectWorshipServiceItemsFromTemplate(svc,groupWorshipElements(videoRows.sections,videoRows.elements)[svc.id]);
  const v=videoItems.find(i=>i.label==='봉헌영상');
  if(!v||videoItems.some(i=>i.label==='봉헌찬송')||v.song_id||v.version_id)throw Error('video projection lost type');
  if(serviceMemoInputMode(parseServiceItemMemo(v.memo),v)!=='asset')throw Error('video input mode lost');
  if(!replaceServiceOfferingSpecial(v,'hymn'))throw Error('return from video failed');
  if(v.song_id!==hymn.song_id||v.version_id!==hymn.version_id||parseServiceItemMemo(v.memo).formHint!=='V2-C-V1-C')throw Error('video round-trip lost song/version/form');

 }
}
if(serviceItemCanToggleOfferingSpecial(prayer))throw Error('prayer has toggle');
state.services=[service];state.serviceItems[service.id]=[hymn,prayer];
const contexts=[{item:hymn,index:0,service},{item:prayer,index:1,service}];document.body.innerHTML='<main style="padding:20px">'+contexts.map(context=>{presenterBoardSubgroupInputContexts=()=>[context];presenterBoardSubgroupItemContext=()=>context;presenterBoardSubgroupDisplay=()=>({label:context.item.label,title:context.item.raw_title});return renderPresenterBoardSubgroup({slides:[],name:context.item.label},-1,service.id,{showHead:true})}).join('')+'</main>';applyTheme('dark');return 'PASS hymn/prayer separate; song/version/form and source retained; slides generated';
}'''),flush=True)
   page.screenshot(path=f'/tmp/offering-fixed-{engine}.png')
   b.close()
finally:s.shutdown()
