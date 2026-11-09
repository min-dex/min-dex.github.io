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
   page.add_init_script("""(() => {
     const updates = window.__updates = {downloads:0, installs:0, dialogs:[], open:false};
     let state = {status:'current', version:'1.0.6', manualInstall:true};
     window.confirm = message => {
       updates.dialogs.push(message);
       return state.status !== 'downloaded' || updates.open;
     };
     window.mindexElectron = {
       isDesktop:true,
       getUpdateState:async()=>({ok:true,state}),
       checkForUpdates:async()=>{
         if(state.status==='current') state={...state,status:'available'};
         return {ok:true,state};
       },
       downloadUpdate:async()=>{
         updates.downloads++;
         state={...state,status:'downloaded'};
         return {ok:true};
       },
       installUpdate:async()=>{updates.installs++;return {ok:true,installerOpened:true};},
       getBuildInfo:async()=>({installedVersion:'1.0.5',build:{schema:1,productVersion:'1.0.5',
         channel:'internal',changes:['내부용 업데이트'],sourceCommit:'fixture',buildVersion:'fixture'}}),
     };
   })();""")
   page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("!document.body.classList.contains('ui-booting')")
   update=page.locator('#desktopUpdateBtn')
   update.click()
   page.wait_for_function('window.__updates.dialogs.length === 2')
   result=page.evaluate('window.__updates')
   assert result['downloads']==1 and result['installs']==0,result
   assert '설치 파일' in result['dialogs'][0] and '검증이 끝났습니다' in result['dialogs'][1],result
   page.evaluate('window.__updates.open = true')
   update.click()
   page.wait_for_function('window.__updates.installs === 1')
   result=page.evaluate('window.__updates')
   assert result['downloads']==1 and result['installs']==1,result
   assert '설치 화면을 열까요?' in result['dialogs'][2],result
   print(engine,'PASS compiled internal download, verified-file confirmation and explicit installer opening',flush=True)
   b.close()
finally:server.shutdown()
