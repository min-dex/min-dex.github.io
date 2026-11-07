"""Real same-profile tabs: no passive sender takeover; last main closes output."""
import os
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
s,u=start_local_app_server()
fixture=r'''(mode)=>{
 const prepare=mode===true, refreshed=mode==='updated';
 window.svc={id:'tab-lifetime-fixture',type_id:'sunday-second',title:'탭 검증'};
 state.services=[svc];state.serviceItems={[svc.id]:[]};state.selectedServiceId=svc.id;
 canUseClientData=()=>false;songCatalogLoaded=true;
 state.client={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:svc.id,save_revision:1},error:null})})})})};
 hydratePresenterServiceData=async()=>{};
 window.fixtureSlides=[presenterReadySlide(svc),{id:'one',elementId:'song',type:'lyrics',layout:'lower_bar_text',title:'곡',text:'ONE',outputContext:'clean',backgroundVideo:'tests/fixtures/praise-background.webm'},{id:'two',elementId:'song',type:'lyrics',layout:'lower_bar_text',title:'곡',text:refreshed?'UPDATED ACTIVE':'TWO',outputContext:'clean',backgroundVideo:'tests/fixtures/praise-background.webm'},{id:'future',elementId:'future',type:'lyrics',text:refreshed?'UPDATED NEXT':'NEXT'}];
 buildServicePresenterSlides=()=>fixtureSlides;presenterSlideBuildSourceSignature=()=> 'lifetime-fixture';
 hydratePresenterOutputInBackground=()=>{};renderPresenterControlState=()=>{};
 if(prepare){preparePresenterService(svc.id);selectPresenterBoardSlide(svc.id,1,{render:false});}
 document.body.innerHTML='<button id="open">시작</button>';
 document.getElementById('open').onclick=()=>runPresenterAction('open',svc.id);
}'''
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   ctx=b.new_context(service_workers='block')
   ctx.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(u).netloc else r.abort())
   main=ctx.new_page();main.goto(u);main.wait_for_function("!!window.MindexPresenterLifetime&&!!window.MindexPresenterFreshness&&!document.body.classList.contains('ui-booting')")
   assert main.evaluate('!!navigator.locks?.query')
   prepare_server_state_fixture(main);main.evaluate(fixture,True)
   with main.expect_popup() as popup:main.click('#open')
   output=popup.value;output.wait_for_function("document.body.textContent.includes('ONE')")
   session=main.evaluate('state.presenter.outputSessionId')
   second=ctx.new_page();second.goto(u);second.wait_for_function("!!window.MindexPresenterLifetime&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(second);second.evaluate(fixture,False)
   assert second.evaluate("!state.presenter.serviceId&&!MindexPresenterLifetime.owns(readPresenterStoredPayload()?.outputSessionId)")
   second.evaluate("()=>{const p=readPresenterStoredPayload();publishPresenterPayload({...p,index:0,slides:[{type:'lyrics',text:'STALE'}]},{force:true});restorePresenterControllerSession()}")
   output.wait_for_timeout(1200);assert output.evaluate("document.body.textContent.includes('ONE')&&!document.body.textContent.includes('STALE')")
   # Duplicating a main tab copies sessionStorage, but must not acquire its held owner lock.
   with main.expect_popup() as duplicate:main.evaluate('(u)=>window.open(u,"_blank")',u)
   copied=duplicate.value;copied.wait_for_function("!!window.MindexPresenterLifetime&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(copied);copied.evaluate(fixture,False);assert copied.evaluate('(id)=>!MindexPresenterLifetime.owns(id)',session)
   for i in [2,1,2]:
    main.evaluate('(i)=>runPresenterAction(i===2?"next":"prev",svc.id)',i)
    output.wait_for_function('(t)=>document.body.textContent.includes(t)',arg='TWO' if i==2 else 'ONE')
    second.reload();second.wait_for_function("!!window.MindexPresenterLifetime&&!document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(second);second.evaluate(fixture,False);assert second.evaluate('!state.presenter.serviceId')
    assert main.evaluate('(i)=>state.presenter.index===i',i)
   output.wait_for_function("()=>{const v=document.querySelector('#presenterOutputRoot > video.presenter-output-background-video');return v?.readyState>=2&&!v.paused&&v.style.opacity==='1'}")
   output.evaluate("window.beforeControllerReload=document.querySelector('#presenterOutputRoot > video.presenter-output-background-video')")
   main.reload();main.wait_for_function("!!window.MindexPresenterLifetime&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(main);main.evaluate(fixture,'updated')
   main.wait_for_function('(id)=>MindexPresenterLifetime.owns(id)&&state.presenter.serviceId===svc.id&&state.presenter.index===2',arg=session)
   assert output.evaluate("document.body.textContent.includes('TWO')")
   assert main.evaluate("readPresenterStoredPayload().slides.some(s=>s.text==='UPDATED NEXT') && readPresenterStoredPayload().slides[2].text==='TWO'")
   assert output.evaluate("beforeControllerReload===document.querySelector('#presenterOutputRoot > video.presenter-output-background-video')&&!beforeControllerReload.paused")
   output.evaluate("async()=>{const v=beforeControllerReload;v.pause();const seek=new Promise(r=>v.addEventListener('seeked',r,{once:true}));v.currentTime=v.duration*.5;await seek}")
   output.add_init_script("window.savedReloadTime=JSON.parse(sessionStorage.getItem('mindex.presenter.background-checkpoint')||'null')?.time; document.addEventListener('seeked',e=>{if(e.target.matches('video.presenter-output-background-video'))window.restoredSeekTime=e.target.currentTime},true)")
   held=[]
   output.route('**/tests/fixtures/praise-background.webm',lambda route:held.append(route))
   output.reload(wait_until='domcontentloaded')
   output.wait_for_selector('.presenter-background-reload-poster',state='visible',timeout=8000)
   output.wait_for_function("document.querySelector('.presenter-background-reload-poster')?.naturalWidth>0")
   assert output.evaluate("()=>{const layer=document.querySelector('.presenter-output-layer.is-active');const text=layer.querySelector('.presenter-slide-text');return text?.textContent.includes('TWO')&&text.getBoundingClientRect().width>0&&getComputedStyle(layer).opacity==='1'}"), 'lyrics hidden while restoring background'
   output.wait_for_function("Number.isFinite(savedReloadTime) && savedReloadTime>0.02")
   assert held
   for route in held:route.continue_()
   output.unroute('**/tests/fixtures/praise-background.webm')
   output.wait_for_function("Number.isFinite(window.restoredSeekTime) && Math.abs(restoredSeekTime-savedReloadTime)<.08",timeout=10000)
   output.wait_for_selector('.presenter-background-reload-poster',state='detached',timeout=5000)
   assert output.evaluate("()=>{const v=document.querySelector('#presenterOutputRoot > video.presenter-output-background-video');return v?.readyState>=2&&!v.paused}")
   print(engine,'PASS reload preserves live element, refreshes upcoming content, restores still, lyrics and playhead',flush=True)
   # A pre-upgrade controller has no resume token. Only its original output Window can attest it.
   main.evaluate("()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('mindex.presenter.lifetime:'))sessionStorage.removeItem(key)}")
   main.reload();main.wait_for_function("!!window.MindexPresenterLifetime&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(main);main.evaluate(fixture,False)
   main.wait_for_function('(id)=>MindexPresenterLifetime.owns(id)&&state.presenter.serviceId===svc.id&&state.presenter.index===2',arg=session)
   assert second.evaluate('(id)=>!MindexPresenterLifetime.owns(id)',session)
   print(engine,'PASS new/duplicate/reloaded passive tabs do not publish; owner reload and pre-upgrade original-opener migration recover frame',flush=True)
   # The original opener can close while another main stays open, even with no heartbeat responses.
   await_fullscreen='async()=>{await presenterOutputFullscreenTask?.catch(()=>{});if(document.fullscreenElement)await document.exitFullscreen()}'
   output.evaluate(await_fullscreen);main.close();second.close()
   copied.evaluate('window.dispatchEvent(new Event("blur"))')
   output.wait_for_timeout(9000);assert not output.is_closed();assert output.evaluate("document.body.textContent.includes('TWO')")
   copied.close()
   try:output.wait_for_event('close',timeout=16000)
   except Exception:
    print(engine,'LIFETIME DIAGNOSTIC',output.evaluate('async()=>({opener:!!window.opener,closed:window.opener?.closed,url:location.href,locks:await navigator.locks.query()})'),flush=True)
    raise
   print(engine,'PASS other main lock keeps frame with opener closed; last main closure closes actual popup',flush=True)
   ctx.close();b.close()
finally:s.shutdown();s.server_close()
