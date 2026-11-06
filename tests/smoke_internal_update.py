import os,sys
os.environ['MINDEX_SMOKE_OFFLINE']='1'
sys.path.insert(0,'tests')
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page()
   page.route('**/*supabase*/**',lambda route:route.abort())
   page.add_init_script('''window.__updates={downloads:0,installs:0,dialogs:[]};window.confirm=message=>{__updates.dialogs.push(message);return true;};window.mindexElectron={isDesktop:true,onUpdateState(){},onCheckUpdateRequested(fn){window.__manual=fn;},getUpdateState:async()=>({ok:true,state:{status:'current'}}),checkForUpdates:async()=>({ok:true,state:{status:'available',version:'1.0.1',manualInstall:true}}),downloadUpdate:async()=>{__updates.downloads++;return {ok:true,manualInstall:true};},installUpdate:async()=>{__updates.installs++;return {ok:true};},getBuildInfo:async()=>({installedVersion:'1.0.0',build:{schema:1,productVersion:'1.0.0',channel:'internal',changes:['내부용 업데이트'],sourceCommit:'fixture',buildVersion:'fixture'}})};''')
   page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("typeof window.__manual==='function' && !document.body.classList.contains('ui-booting')")
   page.evaluate('window.__manual()')
   result=page.evaluate('window.__updates')
   assert result['downloads']==1 and result['installs']==0,result
   assert '설치 파일' in result['dialogs'][0] and '저장·송출 종료' in result['dialogs'][0],result
   print(engine,'PASS compiled internal update prompt/download, no automatic install',flush=True)
   b.close()
finally:server.shutdown()
