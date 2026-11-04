"""Logical counts, reviewed navigation duplicates and plain-language empty cards."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   b=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch();p=b.new_page(viewport={'width':1440,'height':900})
   p.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   p.goto(url);p.wait_for_function("typeof serviceUpcomingDisplayServices==='function'&&!document.body.classList.contains('ui-booting')")
   p.evaluate('''()=>{
    globalThis.MINDEX_SINGLE_SONG_BOOTSTRAP_READY=false;state.client={};canUseClientData=()=>false;state.connectionError='';state.serviceError='';state.search='';state.module='home';homeOverviewStats=null;
    const records=['SONG-CONT-9000-0001','SONG-CONT-9000-0002','SONG-CONT-9001-0001'].map((id,i)=>({id,metadata:{title:'검증 곡 '+i},content:{forms:[]},relations:{same_song:i<2?['SONG-CONT-9000-0001','SONG-CONT-9000-0002'].filter(x=>x!==id):[]}}));
    state.singleSongCatalog=MindexSingleSong.createCatalog(records);state.songs=state.singleSongCatalog.ids().map(id=>state.singleSongCatalog.appSong(id));songCatalogLoaded=true;
    const fri={id:'10000000-0000-4000-8000-000000000098',type_id:'friday',date:'2026-11-06',alias:'온세대 월삭예배'},monthly={id:'10000000-0000-4000-8000-000000000099',type_id:'monthly',date:'2026-11-06',alias:fri.alias,_worshipSourceRef:{navigation_duplicate_of:fri.id}};
    state.serviceTypes=[{id:'friday',name:'금요기도회',fixed_items:[]},{id:'monthly',name:'월삭예배',fixed_items:[]}];state.services=[fri,monthly];state.serviceItems={[fri.id]:[],[monthly.id]:[]};state.selectedServiceId=fri.id;servicePrepEditorItems(fri.id);window.polishBefore=JSON.stringify([records,state.services,state.serviceItems]);window.polishRecords=records;
    renderHomeStart();if(!refs.detailPane.querySelector('.home-module-value').parentElement)throw Error('home absent');
    if(![...refs.detailPane.querySelectorAll('.home-module')].find(e=>e.textContent.includes('찬양')).textContent.includes('2곡')||getFilteredSongs().length!==2)throw Error('count differs');
    if(serviceUpcomingDisplayServices(state.services).length!==1||state.services.length!==2)throw Error('duplicate projection deleted records');
    if(JSON.stringify([polishRecords,state.services,state.serviceItems])!==polishBefore)throw Error('Count or duplicate projection changed source records');
    window.polishHost=document.createElement('div');polishHost.style.cssText='position:relative;width:100%';polishHost.innerHTML=renderServicePrepEditorDialog(fri);document.body.append(polishHost);
    // Opening the existing editor classifies template placeholders in its view cache.
    window.polishBefore=JSON.stringify([polishRecords,state.services,state.serviceItems]);
    const headings=[...polishHost.querySelectorAll('.svc-authoring-panel-head>span')].map(e=>e.textContent);if(!headings.includes('예배')||headings.some(x=>['Service','Section'].includes(x)))throw Error('internal labels remain');
    polishHost.innerHTML='<div class="svc-setlist-entry-list" style="width:180px">'+renderWorshipWeekStatus({source:{service_type_id:'fri',service_date:fri.date},slotName:'금요기도회',weeklyStatus:'콘티 미등록',weeklyReason:'찬양 목록이 아직 등록되지 않았습니다'})+'</div>';
    if(!polishHost.textContent.includes('찬양 목록이 비어 있습니다.')||polishHost.textContent.includes('등록되지 않았습니다'))throw Error('stale empty reason');
   }''')
   for theme in ('dark','light'):
    p.evaluate('t=>document.body.dataset.theme=t',theme)
    for width in (1440,1024,390):
     p.set_viewport_size({'width':width,'height':900});p.evaluate('async()=>{await document.fonts.ready}')
     assert p.locator('.svc-setlist-week-status').last.evaluate("e=>getComputedStyle(e).wordBreak==='keep-all'&&e.scrollWidth<=e.clientWidth+1")
     assert p.evaluate('JSON.stringify([polishRecords,state.services,state.serviceItems])===polishBefore')
   print(engine,'PASS home/list logical count, duplicate projection, Korean labels, compact empty reason and immutable records',flush=True);b.close()
finally:server.shutdown();server.server_close()
