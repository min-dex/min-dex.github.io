"""Boot failure recovery, bounded waits and the short one-shot logo reveal."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium

server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for case in ('release-stall','css-failure','module-failure','asset-stall','runtime-failure','slow-css','fast','reduced'):
    page=browser.new_page(viewport={'width':1280,'height':800},color_scheme='dark',reduced_motion='reduce' if case=='reduced' else 'no-preference');held=[]
    page.add_init_script("window.bootSamples=[];new MutationObserver(()=>{if(document.body&&!document.body.classList.contains('ui-booting')&&!window.bootCleared){window.bootCleared=performance.now();window.bootSamples=[...document.querySelectorAll('.mindex-boot-cross,.mindex-boot-wordmark')].map(e=>({opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform}));}}).observe(document,{subtree:true,attributes:true,attributeFilter:['class']});")
    def route(r):
     path=urlsplit(r.request.url).path
     if urlsplit(r.request.url).hostname!='127.0.0.1' or r.request.method!='GET':r.abort();return
     if (case=='release-stall' and path.endswith('mindex-release.json')) or (case=='slow-css' and path.endswith('/styles.css')) or (case=='asset-stall' and path.endswith('mindex.constants.js')):held.append(r);return
     if case=='css-failure' and path.endswith('/styles.css'):r.abort();return
     if case=='module-failure' and path.endswith('mindex.constants.js'):r.abort();return
     if case=='runtime-failure' and path.endswith(('/app.js','/app.runtime.js')):r.fulfill(body=Path(path.lstrip('/')).read_text()+"\nrender=()=>{throw Error('fixture runtime failure')};",content_type='text/javascript');return
     r.continue_()
    page.route('**/*',route);page.goto(url,wait_until='domcontentloaded')
    if case=='slow-css':
     page.wait_for_timeout(600)
     assert page.locator('.mindex-boot').is_visible()
     assert page.evaluate('!window.__mindexRuntimeStarted')
     for r in held:r.continue_()
     held=[]
    failure=case in ('css-failure','module-failure','asset-stall','runtime-failure')
    if failure:
     page.wait_for_function("document.body.dataset.bootFailed==='true'",timeout=22000)
     assert page.locator('#bootError').is_visible()
     assert not page.locator('.app-shell').is_visible()
     assert page.locator('#bootError button').is_visible()
     page.screenshot(path=f'/private/tmp/boot-{engine}-{case}.png')
     if case=='module-failure':
      case='retry-success'
      page.locator('#bootError button').click()
      page.wait_for_function("!document.body.classList.contains('ui-booting')&&!document.body.dataset.bootFailed")
      assert 'mindex-retry' not in page.url
      assert not page.locator('#bootError').is_visible()
    else:
     page.wait_for_function("!document.body.classList.contains('ui-booting')&&!document.body.dataset.bootFailed",timeout=12000)
     assert page.evaluate("bootSamples.length===2&&bootSamples.every(s=>Number(s.opacity)===1)")
     assert not page.locator('#bootError').is_visible()
     sheets=page.locator('link[rel=stylesheet][href]').evaluate_all('(nodes)=>nodes.map(n=>new URL(n.href).pathname.split("/").pop())')
     assert sheets==['styles.css','styles.presenter-output.css','styles.bulletin.css','styles.calendar.css','styles.monitor.css'],sheets
     if case=='fast':
      page.evaluate("document.body.classList.add('ui-booting');document.getElementById('bootStatus').getAnimations({subtree:true}).forEach(a=>{a.currentTime=0;a.play()});finishUiBoot()")
      page.wait_for_timeout(100)
      assert page.locator('.mindex-boot').is_visible(),'intro cut off before finishing'
      page.wait_for_function("!document.body.classList.contains('ui-booting')")
     if case=='reduced':assert page.locator('.mindex-boot-cross').evaluate("e=>getComputedStyle(e).animationName")=='none'
    print('PASS',engine,case,flush=True)
    for r in held:
     try:r.abort()
     except Exception:pass
    page.close()
   browser.close()
finally:server.shutdown()
