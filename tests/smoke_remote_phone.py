"""Phone install and Wake Lock UI with fake OS APIs; no native screen lock requests."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server();url=url.replace('index.html','remote.html')
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.route('**/remote.mjs*',lambda r:r.fulfill(body='',content_type='text/javascript'))
   page.add_init_script("""window.locks=[];window.denied=false;Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{if(denied)throw Error('denied');const s=new EventTarget();s.released=false;s.release=async()=>{s.released=true;s.dispatchEvent(new Event('release'));};locks.push(s);return s;}}});""")
   page.goto(url);page.evaluate("async()=>{window.awake=(await import('./remote.screen.mjs')).setupPhoneExperience();}")
   assert page.locator('#installHelp, #installApp').count()==0;assert page.locator('.phone-options').is_hidden()
   assert page.locator('#code').evaluate("e=>getComputedStyle(e).fontWeight")=='400'
   if engine=='chromium':assert float(page.locator('#code').evaluate("e=>getComputedStyle(e,'::placeholder').opacity"))<.6
   page.evaluate('awake.update({active:true})');page.wait_for_function('locks.length===1');assert page.locator('#screenStatus').is_hidden()
   assert page.locator('#keepAwake').count()==0
   page.evaluate('awake.close()');page.wait_for_function('locks[0].released')
   page.evaluate('awake.update({active:true})');page.wait_for_function('locks.length===2')
   page.evaluate('locks[1].release()');assert page.locator('#screenRetry').is_visible();page.click('#screenRetry');page.wait_for_function('locks.length===3')
   page.evaluate('awake.close();denied=true;awake.update({active:true})');page.wait_for_function("document.querySelector('#screenStatus').textContent.includes('허용하지')")
   assert page.locator('.phone-options').is_visible()
   for width in (320,390,768):
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path='/tmp/mindex-remote-phone-options-'+engine+'.png',full_page=True)
   page.evaluate('awake.close()');browser.close();print('PASS',engine,'automatic wake/reconnect/retry/denial, quiet idle UI, placeholder and narrow layout',flush=True)
finally:server.shutdown()
