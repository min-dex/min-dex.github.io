"""Recover a silent preload stall without executing its late script or stale release."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for case in ('app.js','mindex.constants.js','vendor/lucide.min.js','styles.css','original-wins'):
    target='app.js' if case=='original-wins' else case
    page=browser.new_page();held=[];retries=[];errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    def route(r):
     u=urlsplit(r.request.url);name=u.path.lstrip('/');query=parse_qs(u.query)
     if u.hostname!='127.0.0.1':r.abort();return
     if name=='mindex-release.json':r.fulfill(json={'version':'qa-current-release'});return
     if name==target:
      if query.get('boot-retry')!=['1']:held.append(r);return
      retries.append(query)
      if case=='original-wins':
       original=next(h for h in held if parse_qs(urlsplit(h.request.url).query).get('v')==['qa-current-release'])
       held.remove(original)
       original.fulfill(body=Path('app.js').read_text()+"\nwindow.qaExecutions=(window.qaExecutions||0)+1;",content_type='text/javascript')
       held.append(r);return
     if name=='app.js':
      r.fulfill(body=Path(name).read_text()+"\nwindow.qaExecutions=(window.qaExecutions||0)+1;",content_type='text/javascript');return
     r.continue_()
    page.route('**/*',route);page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')&&!document.body.dataset.bootFailed",timeout=12000)
    expected={'boot-retry':['1']} if target.startswith('vendor/') else {'v':['qa-current-release'],'boot-retry':['1']}
    assert retries==[expected],retries
    assert page.evaluate('qaExecutions')==1
    assert page.evaluate('MINDEX_RELEASE')=='qa-current-release'
    assert all('/vendor/' in u or parse_qs(urlsplit(u).query).get('v')==['qa-current-release'] for u in page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(n=>n.src)'))
    assert held,'original download was not stalled'
    for r in held:
     suffix='\n:root{--qa-late-style:applied}' if target.endswith('.css') else '\nwindow.qaLateExecution=true;'
     r.fulfill(body=Path(target).read_text()+suffix,content_type='text/css' if target.endswith('.css') else 'text/javascript')
    page.wait_for_timeout(350)
    assert page.evaluate('qaExecutions===1&&!window.qaLateExecution')
    assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--qa-late-style').trim()")!='applied'
    assert not errors,errors
    print('PASS',engine,case,'silent-stall recovery, current release only, late response never executes/applies',flush=True)
    page.close()
   browser.close()
finally:server.shutdown()
