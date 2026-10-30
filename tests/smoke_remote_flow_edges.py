"""Recent Remote flow edges; fake relay only, no output or operational requests."""
import ast,os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
source=ast.parse(Path(__file__).with_name('smoke_remote_directory.py').read_text())
fixtures={n.targets[0].id:ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ('MOCK','SESSION')}
SESSION=fixtures['SESSION'].replace('window.setRemoteState=o.onState;', 'window.remoteSession=s;window.setRemoteResult=o.onResult;window.setRemoteState=o.onState;')
server,url=start_local_app_server();url=url.replace('index.html','remote.html')
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':390,'height':844},has_touch=True)
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
   page.route('**/vendor/supabase-js.min.js',lambda r:r.fulfill(body=fixtures['MOCK'],content_type='text/javascript'))
   page.route('**/mindex.remote-session.mjs*',lambda r:r.fulfill(body=SESSION,content_type='text/javascript'))
   page.goto(url);page.locator('#outputList button').first.click();page.fill('#code','0123');page.click('#connect');page.wait_for_function("typeof window.setRemoteState==='function' && !document.querySelector('#controller').hidden")
   page.evaluate("window.currentState={index:0,total:60,current:'현재',next:'다음',catalogKey:'fixture',allowed:['jump','scripture-show','sermon-title']};setRemoteState(currentState)")
   page.click('#slidesOpen')
   page.evaluate("setSlides({key:'fixture',mode:'groups',total:1,offset:0,items:[{index:0,title:'긴 찬양 제목 '.repeat(20),count:60}]})")
   page.locator('#slidesList button').focus();page.press('#slidesList button','Enter')
   page.evaluate("setSlides({key:'fixture',mode:'slides',total:2,offset:0,items:[0,1].map(index=>({index,title:'긴 제목 '.repeat(30),text:'긴 내용 '.repeat(100),group:'찬양'}))})")
   assert page.evaluate("document.activeElement===document.querySelector('#slidesList button')"),'group replacement lost keyboard focus'
   page.click('#slideGroups')
   page.evaluate("setSlides({key:'fixture',mode:'groups',total:1,offset:0,items:[{index:0,title:'찬양',count:60}]})")
   assert page.evaluate("document.activeElement===document.querySelector('#slidesList button')"),'return lost focus'
   page.locator('#slidesList button').click();page.locator('#slidesQuery').focus()
   page.evaluate("setSlides({key:'fixture',mode:'slides',total:1,offset:0,items:[{index:0,title:'찬양',text:'본문',group:'찬양'}]})")
   assert page.evaluate("document.activeElement===document.querySelector('#slidesQuery')"),'late list stole search focus'
   page.click('#slidesClose');assert page.evaluate("document.activeElement===document.querySelector('#slidesOpen')")
   page.fill('#scriptureQuery','시 23:1');page.evaluate("document.querySelector('#scriptureQuery').setSelectionRange(2,2)")
   page.evaluate('setRemoteState({...currentState,liveReference:"요한복음 3:16"})')
   assert page.locator('#scriptureQuery').input_value()=='시 23:1'
   assert page.locator('#scriptureQuery').evaluate('e=>e.selectionStart')==2
   page.click('#scriptureShow');page.evaluate("setRemoteResult({ok:false,message:'성구를 찾을 수 없습니다. 입력을 확인해 주세요.'})")
   assert '입력을 확인' in page.locator('#scriptureFeedback').inner_text()
   assert page.locator('#scriptureQuery').input_value()=='시 23:1'
   page.click('[data-action=sermon-title]');page.evaluate("setRemoteResult({ok:true,message:'처리 완료'})")
   assert page.locator('#scriptureFeedback').inner_text()=='처리 완료'
   page.click('#scriptureShow');page.evaluate("setRemoteResult({ok:false,message:'성구를 찾을 수 없습니다. 입력을 확인해 주세요.'})")
   for theme in ('light','dark'):
    page.emulate_media(color_scheme=theme)
    for width in (320,390,768):
     page.set_viewport_size({'width':width,'height':844})
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
     for selector in ('#scriptureShow','[data-action=sermon-title]'):
      box=page.locator(selector).bounding_box();assert box['height']>=44 and box['width']>=44
     page.locator('.remote-scripture').scroll_into_view_if_needed()
     assert page.locator('#scriptureFeedback').is_visible()
     page.screenshot(path=f'/tmp/remote-flow-{engine}-{theme}-{width}.png')
   page.evaluate('remoteSession.usable=false');page.wait_for_timeout(300)
   assert page.locator('#scriptureShow').is_disabled() and page.locator('[data-action=sermon-title]').is_disabled()
   assert page.locator('#scriptureQuery').input_value()=='시 23:1'
   browser.close();print('PASS',engine,'group focus, scripture feedback/draft, themes/responsive/disabled',flush=True)
finally:server.shutdown()
