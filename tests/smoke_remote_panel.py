"""Stable output-code panel and double-disconnect protection; no real output."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
HTML='''<meta charset="utf-8"><button id="monitorPanelBtn">현황</button><button data-presenter-remote data-remote-service-id="s" hidden><span data-remote-button-label>원격 조작</span></button><script>window.isPresenterOutputRoute=()=>false;window.state={client:{},selectedServiceId:'s',services:[],presenter:{serviceId:'s',outputSessionId:'o',outputWindow:{}}};window.presenterControllerIsLive=()=>true;window.isPresenterOutputWindowOpen=()=>true;window.ends=0;window.starts=0;</script><script src="/mindex.remote.js"></script>'''
REGISTRY="""export function createOutputRegistry(context,{onUpdate}){window.starts++;window.updateRemote=onUpdate;onUpdate({code:'0123',connected:false,available:true});return {close(){onUpdate({code:'',connected:false,available:false});},async disconnectGuest(){window.ends++;await new Promise(r=>window.finishEnd=r);onUpdate({code:'0123',connected:false,available:true});}};} export async function adminRpc(client,name){return name==='mindex_remote_entry'?{ok:true,kind:'guest'}:{ok:true}} export const relayRegistration=secret=>({secret,revoke:async()=>{}});"""
PAIRING="""export async function obtainOutputPairing(){return {secret:'11'.repeat(32),code:'0123',revoke:async()=>{}};}"""
SESSION="""export async function openRemote(options){return {async end(){window.ends++;await new Promise(r=>window.finishEnd=r);options.onClose();},close(){options.onClose();}};}"""
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/remote-panel-fixture',lambda r:r.fulfill(body=HTML,content_type='text/html'));page.route('**/mindex.remote-admin.mjs*',lambda r:r.fulfill(body=REGISTRY,content_type='text/javascript'))
   page.goto(url.rsplit('/',1)[0]+'/remote-panel-fixture');page.wait_for_function("document.querySelector('[data-remote-code]').textContent==='0123'")
   assert not page.locator('.remote-panel').is_visible()
   assert page.locator('#remotePanelBtn [data-remote-button-label]').inner_text()=='0123'
   assert page.locator('[data-presenter-remote] [data-remote-button-label]').inner_text()=='0123'
   assert page.locator('[data-remote-service-id]').is_visible()
   page.evaluate("state.presenter.serviceId='other';updateRemote({code:'0123',connected:false,available:true})");assert page.locator('[data-remote-service-id]').is_hidden()
   page.evaluate("state.presenter.serviceId='s';updateRemote({code:'0123',connected:false,available:true})")
   page.click('#remotePanelBtn');assert page.locator('.remote-panel').is_visible();assert page.evaluate('starts')==1
   page.evaluate("updateRemote({code:'0123',connected:true,available:true})")
   assert page.locator('#remotePanelBtn').get_attribute('aria-label')=='송출 코드 0123'
   page.evaluate("document.querySelector('[data-remote-end]').onclick();document.querySelector('[data-remote-end]').onclick();")
   assert page.evaluate('ends')==1;assert page.locator('[data-remote-end]').is_disabled()
   page.evaluate('finishEnd()');page.wait_for_function("!document.querySelector('#remotePanelBtn').disabled");assert page.locator('[data-remote-code]').inner_text()=='0123'
   page.evaluate("updateRemote({code:'',connected:false,available:false})");assert page.locator('#remotePanelBtn').get_attribute('aria-label')=='원격 조작'
   page.route('**/mindex.output-pairing.mjs*',lambda r:r.fulfill(body=PAIRING,content_type='text/javascript'))
   page.route('**/mindex.remote-session.mjs*',lambda r:r.fulfill(body=SESSION,content_type='text/javascript'))
   page.goto(url.replace('index.html','remote.html'));page.evaluate("window.ends=0;window.supabase={createClient:()=>({})};window.MINDEX_SUPABASE={url:'mock',anonKey:'mock'};")
   page.fill('#code','0123');page.click('#connect');page.wait_for_function("!document.querySelector('#disconnect').hidden")
   page.evaluate("document.querySelector('#disconnect').onclick();document.querySelector('#disconnect').onclick();")
   assert page.evaluate('ends')==1;assert page.locator('#connect').is_disabled();assert page.locator('#disconnect').is_disabled()
   page.evaluate('finishEnd()');page.wait_for_function("!document.querySelector('#connect').disabled");assert page.locator('#disconnect').is_hidden()
   browser.close();print('PASS',engine,'automatic stable code, code retained after guest disconnect, PC/phone double-disconnect guards',flush=True)
finally:server.shutdown()
