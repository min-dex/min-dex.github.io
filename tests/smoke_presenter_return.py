"""Offline controller history/geometry. No output window or remote data."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
from urllib.parse import urlsplit
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof state!=='undefined' && typeof renderPresenterControlsTop==='function' && !document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    const service={id:'return-fixture',type_id:'sunday-second',date:'2026-10-24'};
    state.services=[service];state.serviceItems[service.id]=[];state.selectedServiceId=service.id;
    state.presenter.serviceId=service.id;state.presenter.outputSessionId='fixture';
    state.presenter.slides=Array.from({length:211},(_,i)=>({id:'fixture-'+i,title:'슬라이드 '+(i+1),kind:'title'}));
    state.presenter.index=10;state.presenter.safetyBlank=false;
    isPresenterOutputWindowOpen=()=>true;presenterSlidesForService=()=>state.presenter.slides;
    publishPresenterPayload=()=>{};suspendServiceMusicAutoSync=()=>{};
    syncSelectedServiceItemToPresenterSlide=()=>{};syncServiceMusicWithPresenterContext=()=>{};scrollPresenterOutlineToActive=()=>{};
    window.drawFixture=()=>{document.body.innerHTML='<div class="svc-presenter-side-panel" style="width:300px;margin:10px">'+renderPresenterControlsTop(service,state.presenter.slides,true,state.presenter.index)+'</div>';refreshIcons(document.body)};
    renderPresenterControlState=window.drawFixture;
    document.body.addEventListener('click',handlePresenterDetailClick);
    publishPresenterState();state.presenter.index=39;publishPresenterState();drawFixture();
   }''')
   back=page.locator('[data-presenter-action="return"]');assert back.is_enabled();back.click()
   assert page.evaluate('state.presenter.index')==10
   page.evaluate('drawFixture()')
   inp=page.locator('[data-presenter-jump-input]');assert inp.input_value()=='11'
   for theme in ['dark','light']:
    page.evaluate('(theme)=>document.body.dataset.theme=theme',theme)
    for width in [260,320,520]:
     page.set_viewport_size({'width':width+20,'height':850});page.locator('.svc-presenter-side-panel').evaluate('(e,w)=>e.style.width=w+"px"',width)
     assert inp.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
     assert page.locator('.svc-presenter-main').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(engine,width)
     assert page.locator('[data-presenter-action="return"] svg').count()==1
     inp.focus();assert inp.evaluate('e=>getComputedStyle(e).outlineStyle')!='none';inp.evaluate('e=>e.blur()')
     page.screenshot(path=f'/tmp/mindex-return-{engine}-{theme}-{width}.png')
   page.evaluate('MindexPresenterHistory.reset();drawFixture()');assert page.locator('[data-presenter-action="return"]').is_disabled()
   browser.close();print('PASS',engine,'return 40→11, disabled empty history, icon, number focus, 260/320/520px light/dark',flush=True)
finally:server.shutdown()
