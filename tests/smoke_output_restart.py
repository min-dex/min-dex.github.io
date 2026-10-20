"""Real popup stop/reopen, with local fixture slides and no production access."""
import os
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
s,u=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    ctx=b.new_context();ctx.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(u).netloc else r.abort())
    page=ctx.new_page();page.goto(u);page.wait_for_function("typeof runPresenterAction==='function'&&!!window.MindexPresenterFreshness&&!document.body.classList.contains('ui-booting')")
    page.evaluate('''()=>{
     window.svc={id:'restart-fixture',type_id:'sunday-second',title:'재시작 검증'};state.services=[svc];state.serviceItems={[svc.id]:[]};state.selectedServiceId=svc.id;
     canUseClientData=()=>false;songCatalogLoaded=true;
     // No DB-linked songs in this fixture; use the real preflight with a stable revision.
     state.client={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:svc.id,save_revision:1},error:null})})})})};
     hydratePresenterServiceData=async()=>{};
     window.fixtureSlides=[presenterReadySlide(svc),{id:'old',type:'lyrics',layout:'lower_bar_text',title:'이전 화면',text:'이전 송출 내용'}, {id:'new',type:'lyrics',layout:'lower_bar_text',title:'새 선택',text:'새로 선택한 내용'}];
     buildServicePresenterSlides=()=>fixtureSlides;presenterSlideBuildSourceSignature=()=> 'fixture';
     hydratePresenterOutputInBackground=()=>{};renderPresenterControlState=()=>{};
     state.serviceMusic.playing=true;state.serviceMusic.mode='manual';state.serviceMusic.sourceKey='background-fixture';
     window.musicStops=0;stopServiceMusicPlayback=()=>{musicStops++;throw Error('background music stopped')};
     preparePresenterService(svc.id);state.presenter.index=1;selectPresenterBoardSlide(svc.id,1,{render:false});
     document.body.innerHTML='<button id="open">시작</button><button id="stop">종료</button>';
     document.querySelector('#open').onclick=()=>runPresenterAction('open',svc.id);
     document.querySelector('#stop').onclick=()=>runPresenterAction('stop',svc.id);
    }''')
    for expected in [1,0,2]:
     if expected==2:page.evaluate("selectPresenterBoardSlide(svc.id,2,{render:false})")
     with page.expect_popup() as pop:page.click('#open')
     out=pop.value;out.wait_for_selector('#presenterOutputRoot');page.wait_for_function('(i)=>readPresenterStoredPayload()?.index===i',arg=expected)
     if expected:out.wait_for_function('(text)=>document.body.textContent.includes(text)',arg='이전 송출 내용' if expected==1 else '새로 선택한 내용')
     else:out.wait_for_function("!document.body.textContent.includes('이전 송출 내용')")
     out.screenshot(path=f'/tmp/output-restart-{engine}-{expected}.png')
     page.evaluate('window.lastOutputRef=state.presenter.outputWindow')
     page.click('#stop');page.wait_for_function('lastOutputRef.closed');page.wait_for_timeout(250)
     # WebKit can retain a closed popup Page handle; Window.closed is authoritative.
     assert page.evaluate("state.presenter.index===0 && presenterSelectedLaunchIndex(svc.id)===null && state.presenter.pptxProgress===null && musicStops===0 && state.serviceMusic.playing")
     print(engine,'PASS actual popup start',expected,'stop clears selection, background music preserved',flush=True)
    for attempt in range(3):
     with page.expect_popup() as pop:page.click('#open')
     out=pop.value;out.wait_for_selector('#presenterOutputRoot')
     page.evaluate('window.lastOutputRef=state.presenter.outputWindow;stopPresenterOutput(svc.id)')
     page.wait_for_function('lastOutputRef.closed')
     assert page.evaluate('state.presenter.outputStopAt>0 && musicStops===0 && state.serviceMusic.playing')
    print(engine,'PASS three rapid fullscreen app stops preserve controller and background music',flush=True)
    # A delayed explicit slide launch must not reopen output after stop.
    page.evaluate('''()=>{window.resolveLaunch=null;hydratePresenterServiceData=()=>new Promise(r=>resolveLaunch=r);window.pendingLaunch=startPresenterAtSlide(svc.id,2);stopPresenterOutput(svc.id);resolveLaunch()}''')
    page.evaluate('pendingLaunch');assert page.evaluate('state.presenter.outputWindow===null && state.presenter.index===0')
    print(engine,'PASS delayed launch cancelled by stop',flush=True)
   finally:b.close()
finally:s.shutdown();s.server_close()
