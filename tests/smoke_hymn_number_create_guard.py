"""Offline numeric worship input must resolve hymns, never create number titles."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
failures=[]
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch(headless=True)
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof createBlankPraiseSongForServiceInput==='function'&&!document.body.classList.contains('ui-booting')")
   result=page.evaluate("""async()=>{
    const errors=[],check=(ok,msg)=>{if(!ok)errors.push(msg)};
    const service={id:crypto.randomUUID(),type_id:'fixture'};
    const item={id:crypto.randomUUID(),service_id:service.id,label:'봉헌찬송',raw_title:'382',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    state.services=[service];state.selectedServiceId=service.id;state.serviceItems={[service.id]:[item]};state.client={};songCatalogLoaded=true;
    const before=JSON.stringify(state.serviceItems);let creates=0;
    state.singleSongCatalog=MindexSingleSong.createCatalog([]);
    state.singleSongRepository={mutate:async(operation,input)=>{creates++;const record={id:'SONG-CONT-0900-0001',revision:1,metadata:input.metadata,content:input.content,relations:{same_song:[],related:[]}};return {id:record.id,records:[record],deleted:[]}}};
    const setSongs=rows=>{state.songs=rows;clearSearchCaches()};
    const hymn={id:'SONG-HYMN-N382-0001',title:'너 근심 걱정 말아라',hymn_no:'382',praise_types:['hymn'],versions:[{id:'new',name:'새찬송가',hymn_no:'382',forms:[]}]};
    const bad={id:'SONG-CONT-0445-0001',title:'382',praise_types:['ccm'],versions:[]};
    for(const label of ['찬양1','찬송','봉헌찬송','파송찬송','폐회찬송','송영'])check(normalizePresenterPreparationEntryContent(label,'382')==='찬 382장',label+' numeric normalization');
    for(const value of ['382','찬 382장','찬송가 382','새 382','통 382','9999','12345','３８２']){
      setSongs([]);const n=creates;try{await createBlankPraiseSongForServiceInput(value,service,item)}catch{}
      check(creates===n,'unresolved created '+value);
    }
    setSongs([bad,hymn]);check(resolveExistingPraiseSongForServiceInput('382',item,service)?.id===hymn.id,'bare number reused false title');
    const old={...hymn,id:'SONG-HYMN-T382-0001',title:'허락하신 새 땅에',hymn_no:'통 382',versions:[{id:'old',name:'통일찬송가',hymn_no:'통 382',forms:[]}]};
    setSongs([bad,old,hymn]);check(resolveExistingPraiseSongForServiceInput('통 382',item,service)?.id===old.id,'explicit old edition');check(resolveExistingPraiseSongForServiceInput('새 382',item,service)?.id===hymn.id,'explicit new edition');
    setSongs([bad]);check(!resolveExistingPraiseSongForServiceInput('382',item,service),'bad numeric title matched');
    setSongs([]);songCatalogLoaded=false;let loads=0;
    loadSongs=async()=>{loads++;setSongs([hymn]);songCatalogLoaded=true};
    const n=creates;check((await createBlankPraiseSongForServiceInput('382',service,item))?.id===hymn.id,'load then resolve hymn');check(loads===1&&creates===n,'loading created duplicate');
    setSongs([]);const m=creates;await createBlankPraiseSongForServiceInput('새로운 찬양 제목',service,item);check(creates===m+1,'ordinary title creation changed');
    check(JSON.stringify(state.serviceItems)===before,'service draft changed');return errors;
   }""")
   print(engine,result or 'PASS numeric creation fence, false-title rejection, loaded hymn lookup and unchanged drafts',flush=True)
   failures.extend((engine,e) for e in result);browser.close()
finally:server.shutdown()
assert not failures,failures
