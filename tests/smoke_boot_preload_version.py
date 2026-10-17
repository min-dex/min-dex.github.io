"""Speculation overlaps release lookup but never executes a stale fallback version."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit,parse_qs
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();held=[];requests=[]
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname=='127.0.0.1' else r.abort())
   page.route('**/mindex-release.json*',lambda r:held.append(r))
   page.on('request',lambda r:requests.append(r.url))
   page.goto(url,wait_until='domcontentloaded');page.wait_for_function("document.querySelector('link[as=script][href*=\"app.js\"]')")
   page.wait_for_timeout(150)
   assert held and any('/app.js?' in u for u in requests) and any('/styles.css?' in u for u in requests)
   assert next(i for i,u in enumerate(requests) if '/mindex-release.json' in u) < next(i for i,u in enumerate(requests) if '/app.js?' in u), 'release lookup queued behind speculative scripts'
   script_preloads=page.locator('link[as=script]').evaluate_all('(nodes)=>nodes.map(n=>n.getAttribute("href"))')
   assert script_preloads[0].startswith('./app.js?'),script_preloads
   assert sum('/app.js?' in u for u in script_preloads)==1
   assert next(i for i,u in enumerate(requests) if '/styles.css?' in u) < next(i for i,u in enumerate(requests) if '/app.js?' in u), 'stylesheet gate queued behind scripts'
   assert page.evaluate("typeof state==='undefined'")
   for r in held:r.fulfill(json={'version':'test-resolved-release'})
   page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')")
   executed=page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(n=>n.src)')
   assert all('/vendor/' in u or parse_qs(urlsplit(u).query).get('v')==['test-resolved-release'] for u in executed),executed
   assert page.evaluate("MINDEX_RELEASE==='test-resolved-release'")
   page.evaluate('MINDEX_PRELOAD_PRESENTER_FONTS();MINDEX_PRELOAD_PRESENTER_FONTS()')
   assert page.locator('link[as=font][href*=freesentation]').count()==4
   print('PASS speculative downloads, resolved-only execution, stylesheet gate and deduplicated font preload',engine,flush=True)
   browser.close()
finally:server.shutdown()
