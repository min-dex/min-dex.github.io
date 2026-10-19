"""Headless direct-window IPC and channel transport, with native fullscreen blocked."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for channels in (True,False):
    context=browser.new_context()
    context.add_init_script("Element.prototype.requestFullscreen=async()=>{};Element.prototype.webkitRequestFullscreen=()=>{};")
    if not channels:context.add_init_script("delete window.BroadcastChannel")
    context.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page=context.new_page();page.goto(url+'?mindexSmokeRaw=1')
    page.wait_for_function("typeof runPresenterAction==='function'&&!document.body.classList.contains('ui-booting')")
    page.evaluate('''()=>{
     window.svc={id:'transport-fixture',type_id:'sunday-second',title:'전달 검증'};
     state.services=[svc];state.serviceItems={[svc.id]:[]};state.selectedServiceId=svc.id;
     canUseClientData=()=>false;songCatalogLoaded=true;
     window.fixtureSlides=[presenterReadySlide(svc),...[1,2,3].map(n=>({id:'slide'+n,type:'lyrics',layout:'lower_bar_text',title:'Slide '+n,text:'Fixture text '+n}))];
     buildServicePresenterSlides=()=>fixtureSlides;presenterSlideBuildSourceSignature=()=> 'transport-fixture';
     hydratePresenterOutputInBackground=()=>{};renderPresenterControlState=()=>{};
     preparePresenterService(svc.id);selectPresenterBoardSlide(svc.id,1,{render:false});
     const button=document.createElement('button');button.id='transportOpen';button.textContent='Open';
     button.onclick=()=>runPresenterAction('open',svc.id);document.body.append(button);
    }''')
    with page.expect_popup() as popup:page.click('#transportOpen')
    output=popup.value;output.wait_for_selector('#presenterOutputRoot')
    output.wait_for_function("document.body.textContent.includes('Fixture text 1')")
    output.keyboard.press('ArrowRight')
    page.wait_for_function('state.presenter.index===2')
    output.wait_for_function("document.body.textContent.includes('Fixture text 2')")
    page.wait_for_timeout(250)
    assert page.evaluate('state.presenter.index')==2,'duplicate next skipped a slide'
    output.keyboard.press('ArrowLeft');page.wait_for_function('state.presenter.index===1')
    output.wait_for_function("document.body.textContent.includes('Fixture text 1')")
    assert page.evaluate("localStorage.getItem('mindex.presenter.state')") is None
    page.evaluate('stopPresenterOutput(svc.id)')
    print('PASS',engine,'channel' if channels else 'direct-window','single next/previous, output rendering, no browser payload persistence',flush=True)
    context.close()
   browser.close()
finally:server.shutdown()
