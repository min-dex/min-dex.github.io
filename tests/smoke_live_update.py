"""Actual two-release navigation, preserving a draft through all unsafe states."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context();page=context.new_page();version=['release-one'];loads=[]
   def route(r):
    u=urlsplit(r.request.url)
    if r.request.method!='GET' or u.netloc!=urlsplit(url).netloc:return r.abort()
    if u.path.endswith('/mindex-release.json'):return r.fulfill(json={'version':version[0]})
    if u.path.endswith('/live-update-fixture.html'):
     loads.append(version[0])
     return r.fulfill(content_type='text/html',body='''<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles.workspace.css"><main id="detailPane"><div data-bulletin-owner></div><textarea id="draft"></textarea><button id="save">저장</button><button id="idle">작업 완료</button></main><script>
      window.MINDEX_RELEASE="'''+version[0]+'''";
      const state={},presenterPptxImports=new Set(),bulletinTabSessions=new Map([['hidden',new Map([['other',{dirty:true}]])]]);
      let dirty=true,busy=false,workbenchBlocked=true,sourcePending=false;document.querySelector('[data-bulletin-owner]').bulletinController={canApplyUpdate:()=>!workbenchBlocked};const refs={detailPane:document.querySelector('main')};
      function isPresenterOutputRoute(){return false}function departmentRefreshBlocked(){return busy||document.activeElement===draft}
      function serviceHasPendingTextEdits(){return sourcePending}function hasDirtyChanges(){return dirty}function currentSaveButtonState(){return {dirty}}
      window.MINDEX_SERVER_STORAGE={ready:true,pending:false};window.MINDEX_DRAFT_HANDOFF={pending:false};
      draft.value=localStorage.getItem('saved')||'';
      save.onclick=()=>{localStorage.setItem('saved',draft.value);dirty=false;MINDEX_SERVER_STORAGE.pending=true};
      draft.oninput=()=>{dirty=true};
     </script><script src="/mindex.live-update.js"></script>''')
    return r.continue_()
   context.route('**/*',route)
   page.goto(url.rsplit('/',1)[0]+'/live-update-fixture.html')
   page.locator('#draft').fill('작성 중인 주보\n**강조와 줄바꿈** 보존')
   version[0]='release-two'
   # Two real metadata polls (5s and 30s) while the actual textarea is dirty.
   page.locator('.live-update-notice').wait_for(timeout=12000)
   page.wait_for_timeout(26000)
   assert len(loads)==1 and page.locator('#draft').input_value()=='작성 중인 주보\n**강조와 줄바꿈** 보존'
   page.locator('#save').click();page.locator('#idle').click()
   page.wait_for_timeout(6000);assert len(loads)==1,'pending save must block'
   page.evaluate('MINDEX_SERVER_STORAGE.pending=false')
   page.wait_for_timeout(1500);assert len(loads)==1,'inactive bulletin draft must block'
   page.evaluate("bulletinTabSessions.get('hidden').get('other').dirty=false;busy=true")
   page.wait_for_timeout(1500);assert len(loads)==1,'active operation must block'
   page.evaluate('busy=false')
   page.wait_for_timeout(1500);assert len(loads)==1,'workbench print or template draft must block'
   page.evaluate("""()=>{workbenchBlocked=false;const cell=document.createElement('div');cell.id='calendar-draft';cell.contentEditable='true';cell.dataset.initialValue='저장된 일정';cell.textContent='아직 저장되지 않은 일정';document.body.append(cell)}""")
   page.wait_for_timeout(1500);assert len(loads)==1,'unsaved calendar text must block'
   page.evaluate("document.getElementById('calendar-draft').remove();sourcePending=true")
   page.wait_for_timeout(1500);assert len(loads)==1,'unapplied worship source text must block'
   page.evaluate('sourcePending=false')
   page.wait_for_url('**/*mindex-retry*',timeout=6000)
   page.wait_for_function("MINDEX_RELEASE==='release-two'")
   assert loads==['release-one','release-two'],loads
   assert page.locator('#draft').input_value()=='작성 중인 주보\n**강조와 줄바꿈** 보존'
   assert not page.locator('.live-update-notice').count()
   print('PASS live release auto-apply: dirty typing, pending save, inactive draft, active work, exact saved content restored',engine,flush=True)
   browser.close()
finally:server.shutdown()
