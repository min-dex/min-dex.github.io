"""Offline lifecycle simulation; not a physical iOS/Android lock-screen test."""
import ast,os,time
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
source=ast.parse(Path(__file__).with_name('smoke_presenter_remote.py').read_text())
MOCK=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='MOCK' for t in n.targets))
server,url=start_local_app_server();url=url.replace('index.html','remote.html')
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   hc=browser.new_context();pc=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   host=hc.new_page();phone=pc.new_page()
   for page in (host,phone):
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.route('**/vendor/supabase-js.min.js',lambda r:r.fulfill(body=MOCK,content_type='text/javascript'))
    page.goto(url)
   host.evaluate("async()=>{window.mod=await import('./mindex.remote-session.mjs');window.calls=0;window.fixture={live:true,index:0,total:20,current:'현재',next:'다음',music:'재생 중',allowed:['next']};}")
   def pump(seconds=.3,drop=False):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
     for a,b in ((host,phone),(phone,host)):
      for packet in a.evaluate('remoteOut.splice(0)'):
       if not drop:b.evaluate('p=>deliver(p)',packet)
     phone.wait_for_timeout(20)
   def ready():
    for _ in range(40):
     pump(.1)
     if phone.locator('[data-action=next]').is_enabled():return
    raise AssertionError(phone.locator('#status').inner_text())
   def connect():
    host.evaluate("async()=>{window.s=await mod.openRemote({client:remoteClient,host:true,read:()=>fixture,execute:()=>{calls++;fixture.index++;}});}")
    phone.fill('#code','0123');phone.click('#connect');ready()
   def visibility(hidden):
    phone.evaluate("hidden=>{Object.defineProperty(document,'hidden',{configurable:true,value:hidden});Object.defineProperty(document,'visibilityState',{configurable:true,value:hidden?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'));}",hidden)
   connect()
   # Hidden page cannot operate; returning requires a new request-matched snapshot.
   visibility(True);assert phone.locator('[data-action=next]').is_disabled();pump(1.2)
   assert phone.locator('[data-action=next]').is_disabled()
   host.evaluate('fixture.index=4');visibility(False)
   assert phone.locator('[data-action=next]').is_disabled();ready();assert phone.locator('#position').inner_text()=='5 / 20'
   assert host.evaluate('calls')==0
   # A command delivered just before sleep but with its ack lost is never retried.
   phone.click('[data-action=next]')
   packets=phone.evaluate('remoteOut.splice(0)')
   for packet in packets:host.evaluate('p=>deliver(p)',packet)
   host.wait_for_function('calls===1');visibility(True);pump(4.2,drop=True)
   assert phone.locator('[data-action=next]').is_disabled()
   assert '확인할 수 없' in phone.locator('#result').inner_text()
   visibility(False);ready();assert host.evaluate('calls')==1
   # Longer transport outage must end the session; reconnection cannot replay commands.
   pump(11.5,drop=True);assert not host.evaluate('s.connected')
   pump(1);assert phone.locator('#pairForm').is_visible();assert host.evaluate('calls')==1
   connect();phone.click('[data-action=next]');pump();assert host.evaluate('calls')==2
   # BFCache-style pagehide closes rather than reviving a previously authorized session.
   phone.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));")
   pump(.5);assert phone.locator('#pairForm').is_visible();assert phone.locator('[data-action=next]').is_disabled()
   host.evaluate('s.close()');connect()
   if engine=='chromium':
    # Actual Chromium renderer freeze: no phone JS/timer execution for > host timeout.
    cdp=pc.new_cdp_session(phone);cdp.send('Page.setWebLifecycleState',{'state':'frozen'})
    host.wait_for_timeout(11500);assert not host.evaluate('s.connected')
    cdp.send('Page.setWebLifecycleState',{'state':'active'});visibility(False);pump(1)
    assert phone.locator('[data-action=next]').is_disabled();assert host.evaluate('calls')==2
    cdp.detach()
   host.evaluate('s.close()');hc.close();pc.close();browser.close()
   print('PASS',engine,'hidden/visible freshness, lost ack without replay, long outage/new connection, persisted pagehide'+(', renderer freeze/resume' if engine=='chromium' else ''),flush=True)
finally:server.shutdown()
