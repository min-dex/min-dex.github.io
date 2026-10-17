"""Transient asset recovery and a usable shell while initial reads are pending."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for case in ('script-once','style-once','slow-data'):
    page=b.new_page();seen=[]
    def route(r):
     u=urlsplit(r.request.url);path=u.path
     if u.hostname!='127.0.0.1':r.abort();return
     target='/mindex.constants.js' if case=='script-once' else '/styles.css'
     if case!='slow-data' and path==target:
      retry=parse_qs(u.query).get('boot-retry')==['1'];seen.append(retry)
      if not retry:r.abort();return
     if path=='/app.js':
      extra="\nwindow.qaAppExecutions=(window.qaAppExecutions||0)+1;"
      if case=='slow-data':extra+='''\nconnectClient=()=>{state.client={};};canUseClientData=()=>true;
loadInitialData=()=>{window.qaInitialPending=true;return new Promise(resolve=>window.qaReleaseInitial=()=>{window.qaInitialPending=false;resolve()})};'''
      r.fulfill(body=Path('app.js').read_text()+extra,content_type='text/javascript');return
     r.continue_()
    page.route('**/*',route);page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')&&!document.body.dataset.bootFailed",timeout=12000)
    assert page.evaluate('qaAppExecutions')==1
    if case=='slow-data':
     assert page.evaluate('qaInitialPending===true')
     assert page.locator('.app-shell').is_visible()
     page.evaluate('qaReleaseInitial()');page.wait_for_function('!qaInitialPending')
    else:assert False in seen and seen.count(True)==1,seen
    print('PASS',engine,case,flush=True);page.close()
   b.close()
finally:server.shutdown()
