"""Browsing preserves live output; explicit switching resets it; zero preview matches output."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
remote=os.environ.get('MINDEX_QA_URL','').rstrip('/')
server,url=(None,remote+'/') if remote else start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context(viewport={'width':1440,'height':1000})
   context.route('**/*',lambda r:r.abort() if '.supabase.co/' in r.request.url or r.request.method not in ('GET','HEAD') else r.continue_())
   page=context.new_page();page.goto(url,wait_until='domcontentloaded');page.wait_for_function("typeof runPresenterAction==='function' && !document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    state.services=[{id:'switch-a',type_id:'young-adult',date:'2026-10-18',title:'A'},{id:'switch-b',type_id:'sunday-second',date:'2026-10-18',title:'B'}];
    state.serviceTypes=[{id:'young-adult',name:'A'},{id:'sunday-second',name:'B'}];state.songs=[];
    for(const s of state.services){state.serviceItems[s.id]=[normalizeServiceItem({id:s.id+'-item',service_id:s.id,label:s.title,raw_title:s.title,sort_order:0,memo:serializeServiceItemMemo({elementType:'plain_text',inputMode:'manual',text:s.title+' 확인 문구'})},0)];state.loadedWorshipServiceIds.add(s.id);state.loadedWorshipPresenterServiceIds.add(s.id)}
    canUseClientData=()=>false;loadServiceItems=async()=>{};hydratePresenterServiceData=async()=>false;
    warmServiceItemScriptureReferencesForService=()=>Promise.resolve(false);warmWorshipScriptureReferencesForService=()=>Promise.resolve(false);
    state.client={};state.connectionError='';state.serviceError='';state.selectedServiceId='switch-a';state.module='presenter';state.dirty.service=false;
    preparePresenterService('switch-a');render();publishPresenterState({force:true});
   }''')
   with page.expect_popup() as popup:page.evaluate("()=>{state.presenter.outputWindow=window.open(presenterOutputUrl(),'mindexPresenterOutput')}")
   output=popup.value
   page.wait_for_function('state.presenter.outputConnectedAt>0',timeout=20000)
   def output_is(sid):
    output.wait_for_function('(sid)=>readPresenterStoredPayload()?.serviceId===sid && !!document.querySelector("#presenterOutputRoot .presenter-slide")',arg=sid,timeout=15000)
   output_is('switch-a')
   page.evaluate("selectService('switch-b')")
   assert page.evaluate("state.selectedServiceId==='switch-b' && state.presenter.serviceId==='switch-a'")
   output_is('switch-a')
   page.evaluate("runPresenterAction('next','switch-b')")
   assert page.evaluate("state.presenter.serviceId==='switch-a'")
   page.evaluate("runPresenterAction('open','switch-b')")
   output_is('switch-b')
   assert page.evaluate("state.presenter.index===0 && !state.presenter.liveScripture.active && !state.presenter.safetyBlank")
   for sid in ('switch-b','switch-a'):
    page.evaluate('(sid)=>{selectService(sid);runPresenterAction("open",sid)}',sid);output_is(sid)
    page.evaluate("()=>{renderPresenterControlState(state.selectedServiceId);refs.rightSidebar.hidden=false;document.body.dataset.module='presenter'}")
    jump=page.locator('[data-presenter-jump-input]:visible').first
    jump.fill('0');jump.press('Enter')
    output.wait_for_function('document.querySelector("#presenterOutputRoot")?.classList.contains("is-blackout")')
    page.wait_for_function('!!document.querySelector(".svc-presenter-live-preview .is-blackout")',timeout=3000)
    result=page.locator('.svc-presenter-live-preview .svc-slide-mini-canvas').evaluate('''e=>({background:getComputedStyle(e).backgroundColor,hasBackground:e.classList.contains('has-background'),hasCross:e.classList.contains('is-blank'),image:getComputedStyle(e).backgroundImage})''')
    assert result=={'background':'rgb(0, 0, 0)','hasBackground':False,'hasCross':False,'image':'none'},result
    page.screenshot(path=f'/tmp/mindex-blackout-{engine}-{sid}.png')
    jump.fill('1');jump.press('Enter');output.wait_for_function('!document.querySelector("#presenterOutputRoot")?.classList.contains("is-blackout")')
    assert not page.locator('.svc-presenter-live-preview .is-blackout').count()
   page.evaluate("stopPresenterOutput(state.presenter.serviceId)")
   print(engine,'PASS browse preserves output; explicit switch resets; inactive navigation guarded; zero preview/output black; 1 restores',flush=True)
   context.close();browser.close()
finally:
 if server:server.shutdown()
