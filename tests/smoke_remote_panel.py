"""Slow disconnect double-click regression, no output window or live services."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
HTML='''<meta charset="utf-8"><button id="monitorPanelBtn">현황</button><button data-presenter-remote><span data-remote-button-label>원격 조작</span></button><script>window.isPresenterOutputRoute=()=>false;window.state={client:{},selectedServiceId:'s',presenter:{serviceId:'s',outputSessionId:'o',outputWindow:{}}};window.presenterControllerIsLive=()=>true;window.isPresenterOutputWindowOpen=()=>true;window.ends=0;window.notices=[];window.showToast=m=>notices.push(m);window.starts=0;</script><script src="/mindex.remote.js"></script>'''
MODULE="""export async function openRemote(options){window.starts++;window.remoteOptions=options;window.remoteConnected=false;return {code:'012345',listening:true,get connected(){return window.remoteConnected},close(){options.onClose()},async end(){window.ends++;await new Promise(r=>window.finishEnd=r);options.onClose();}};}"""
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/remote-panel-fixture',lambda r:r.fulfill(body=HTML,content_type='text/html'));page.route('**/mindex.remote-session.mjs*',lambda r:r.fulfill(body=MODULE,content_type='text/javascript'))
   page.goto(url.rsplit('/',1)[0]+'/remote-panel-fixture');page.click('[data-presenter-remote]');page.wait_for_function("document.querySelector('[data-remote-code]').textContent==='012345'")
   assert not page.locator('.remote-panel').is_visible()
   assert page.locator('#remotePanelBtn [data-remote-button-label]').inner_text()=='012345'
   assert page.evaluate('starts')==1
   assert page.locator('[data-presenter-remote] [data-remote-button-label]').inner_text()=='012345'
   assert page.evaluate('notices')==['2분 안에 리모트 화면에서 코드를 입력하세요.'],page.evaluate('notices')
   page.click('#remotePanelBtn');assert page.locator('.remote-panel').is_visible()
   assert page.evaluate('starts')==1
   page.evaluate("remoteConnected=true;remoteOptions.onStatus('리모컨 연결됨')")
   assert page.locator('#remotePanelBtn').get_attribute('aria-label')=='원격 연결됨'
   page.evaluate("document.querySelector('[data-remote-end]').onclick();document.querySelector('[data-remote-end]').onclick();")
   assert page.evaluate('ends')==1;assert page.locator('[data-remote-start]').is_disabled();assert page.locator('[data-remote-end]').is_disabled()
   page.evaluate('finishEnd()');page.wait_for_function("!document.querySelector('[data-remote-start]').disabled");assert page.locator('[data-remote-code]').inner_text()==''
   assert page.locator('#remotePanelBtn').get_attribute('aria-label')=='원격 조작'
   page.click('[data-remote-close]')
   page.click('[data-presenter-remote]');page.wait_for_function("starts===2")
   page.evaluate("remoteOptions.onClose()")
   assert page.locator('[data-presenter-remote] [data-remote-button-label]').inner_text()=='원격 조작'
   page.goto(url.replace('index.html','remote.html'));page.evaluate("window.ends=0;window.supabase={createClient:()=>({})};window.MINDEX_SUPABASE={url:'mock',anonKey:'mock'};")
   page.fill('#code','012345');page.click('#connect');page.wait_for_function("!document.querySelector('#disconnect').hidden")
   page.evaluate("document.querySelector('#disconnect').onclick();document.querySelector('#disconnect').onclick();")
   assert page.evaluate('ends')==1;assert page.locator('#connect').is_disabled();assert page.locator('#disconnect').is_disabled()
   page.evaluate('finishEnd()');page.wait_for_function("!document.querySelector('#connect').disabled");assert page.locator('#disconnect').is_hidden()
   browser.close();print('PASS',engine,'PC/phone slow disconnect double-click and reconnect lock',flush=True)
finally:server.shutdown()
