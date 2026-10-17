"""Several stalled startup files recover together, without replaying scripts."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
import time
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();held=[];retries={};errors=[]
   targets={'styles.css','mindex.icons.js','app.js'}
   page.on('pageerror',lambda e:errors.append(str(e)))
   def route(r):
    u=urlsplit(r.request.url);name=u.path.lstrip('/');q=parse_qs(u.query)
    if u.hostname!='127.0.0.1':r.abort();return
    if name=='mindex-release.json':r.fulfill(json={'version':'qa-selected-overlap'});return
    if name in targets:
     if q.get('boot-retry')!=['1']:held.append(r);return
     assert q.get('v')==['qa-selected-overlap'],q
     assert name not in retries,name
     retries[name]=time.monotonic()
    if name=='app.js':r.fulfill(body=Path(name).read_text()+'\nwindow.qaRuns=(window.qaRuns||0)+1;',content_type='text/javascript');return
    r.continue_()
   page.route('**/*',route);start=time.monotonic();page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')&&!document.body.dataset.bootFailed",timeout=8000)
   assert set(retries)==targets,retries
   assert max(retries.values())-min(retries.values())<1.5,retries
   assert max(retries.values())-start<6,retries
   assert page.evaluate('qaRuns===1')
   for r in held:
    name=urlsplit(r.request.url).path.lstrip('/')
    suffix='\n:root{--qa-late:wrong}' if name.endswith('.css') else '\nwindow.qaLate=true;'
    r.fulfill(body=Path(name).read_text()+suffix,content_type='text/css' if name.endswith('.css') else 'text/javascript')
   page.wait_for_timeout(350)
   assert page.evaluate("qaRuns===1&&!window.qaLate&&getComputedStyle(document.documentElement).getPropertyValue('--qa-late').trim()==='' ")
   assert not errors,errors
   print('PASS',engine,round(time.monotonic()-start,2),'seconds; three simultaneous stalls recover in one retry interval; stale releases and late scripts never execute',flush=True)
   browser.close()
finally:server.shutdown()
