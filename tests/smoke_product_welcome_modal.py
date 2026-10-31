"""Real unsaved dialog must retain focus while optional welcome metadata settles."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for race in ('identity','storage'):
    page=browser.new_page()
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
    page.add_init_script("const race="+repr(race)+";"+'''     window.originalFetch=window.fetch;
     window.releaseBuild={schema:1,productVersion:'1.0.0',channel:'release',changes:['변경 사항']};
     window.fetch=(...args)=>String(args[0]).includes('mindex-build.json')?(race==='identity'?new Promise(resolve=>window.settleIdentity=()=>resolve({ok:true,json:async()=>releaseBuild})):Promise.resolve({ok:true,json:async()=>releaseBuild})):originalFetch(...args);
''')
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof confirmUnsavedChangesAction==='function'&&!document.body.classList.contains('ui-booting')")
    page.locator('#bootStatus').wait_for(state='hidden')
    page.evaluate('''race=>{
     window.writes=[];window.MINDEX_SERVER_STORAGE={ready:race==='identity',getItem:()=>null,setItem:async(...args)=>writes.push(args)};
     state.module='home';state.client={};state.dirty.song=true;state.forms=[{id:'fixture',text:'보존할 입력'}];renderHomeStart();
     window.before=JSON.stringify({dirty:state.dirty,forms:state.forms});
    }''',race)
    if race=='identity':page.wait_for_function("typeof settleIdentity==='function'")
    else:page.wait_for_timeout(100)
    page.evaluate("void confirmUnsavedChangesAction().then(choice=>window.choice=choice)")
    assert page.locator('.unsaved-dialog [data-unsaved-action=save]').evaluate('e=>e===document.activeElement')
    if race=='identity':page.evaluate('settleIdentity()')
    else:page.evaluate("MINDEX_SERVER_STORAGE.ready=true;dispatchEvent(new Event('mindex-server-storage-ready'))")
    page.wait_for_timeout(150)
    assert page.locator('.product-release-dialog').count()==0
    assert page.locator('.unsaved-dialog [data-unsaved-action=save]').evaluate('e=>e===document.activeElement')
    assert page.evaluate('before===JSON.stringify({dirty:state.dirty,forms:state.forms})')
    page.locator('[data-unsaved-action=cancel]').click();page.wait_for_function("window.choice==='cancel'")
    assert page.evaluate('before===JSON.stringify({dirty:state.dirty,forms:state.forms})')
    assert page.evaluate('writes.length')==0
    page.close()
   browser.close();print('PASS',engine,'real unsaved modal, delayed identity and storage-ready, focus/dirty retained, nested welcome zero',flush=True)
finally:server.shutdown()
