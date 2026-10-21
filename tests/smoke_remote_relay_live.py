"""Opt-in encrypted relay only: no operational records, media or DB calls."""
import os,sys,time
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
if '--relay-only' not in sys.argv:raise SystemExit('Use --relay-only to test disposable encrypted Broadcast channels.')
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  browser=launch_chromium(p)
  contexts=[browser.new_context(),browser.new_context()]
  pages=[c.new_page() for c in contexts]
  for page in pages:
   page.route('**/remote.mjs*',lambda r:r.fulfill(body='',content_type='text/javascript'))
   page.goto(url.replace('index.html','remote.html'))
   page.evaluate('''async()=>{
    window.client=supabase.createClient(MINDEX_SUPABASE.url,MINDEX_SUPABASE.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    window.core=await import('./mindex.remote-core.mjs');window.mod=await import('./mindex.remote-session.mjs');
    window.status='';window.received=null;window.result=null;
   }''')
  host,remote=pages
  code=host.evaluate('core.newCode()')
  host.evaluate('''async code=>{window.fixture={live:true,index:0};window.session=await mod.openRemote({client,code,host:true,read:()=>fixture,execute:()=>fixture.index++,onStatus:s=>window.status=s});}''',code)
  host.wait_for_function("status.includes('코드를 입력')",timeout=20000)
  remote.evaluate('''async code=>{window.session=await mod.openRemote({client,code,onState:s=>window.received=s,onStatus:s=>window.status=s,onResult:r=>window.result=r});}''',code)
  remote.wait_for_function('session.usable',timeout=20000)
  started=time.monotonic();remote.evaluate("session.command('next')");remote.wait_for_function('result?.ok',timeout=8000)
  elapsed=round((time.monotonic()-started)*1000)
  assert host.evaluate('fixture.index')==1
  remote.evaluate('session.end()');host.wait_for_function('!session.connected',timeout=5000)
  print(f'PASS actual Supabase encrypted relay, separate contexts, command ack {elapsed}ms (one sample, not a guarantee), explicit disconnect')
  for c in contexts:c.close()
  browser.close()
finally:server.shutdown()
