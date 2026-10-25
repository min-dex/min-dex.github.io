"""Public Remote directory/selected-code UI; no operational DB or actual output."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
MOCK=r'''window.rpcCalls=[];window.directoryFail=false;window.rows=[{id:'a',title:'어린이부 예배',device:'1층 PC'},{id:'b',title:'주일예배 [3부]',device:'본당 PC'}];
window.supabase={createClient:()=>({async rpc(name,a={}){
 rpcCalls.push({name,...a});
 if(name==='mindex_remote_outputs')return directoryFail?{error:{message:'offline'}}:{data:{ok:true,outputs:rows}};
 if(name==='mindex_remote_entry')return {data:a.p_code==='7777'?{ok:true,kind:'admin',token:'fixture-token'}:{ok:true,kind:'guest'}};
 if(name==='mindex_remote_admin')return {data:a.p_action==='list'?{ok:true,outputs:rows.map(o=>({...o,code:o.id==='a'?'0123':'0456'}))}:{ok:true,ready:true,secret:'ab'.repeat(32)}};
 if(name==='mindex_remote_guest'){
  if(a.p_action==='disconnect')return {data:{ok:true}};
  const id=a.p_code==='0123'?'a':a.p_code==='0456'?'b':null;
  return {data:id&&(!a.p_output||a.p_output===id)?{ok:true,output:id,ready:true,secret:'ab'.repeat(32)}:{ok:false,error:'invalid_code'}};
 }
 return {data:{ok:false,error:'unexpected'}};
}})};'''
SESSION=r'''export async function openRemote(o){window.opened=(window.opened||0)+1;const s={connected:true,usable:true,close(){o.onClose();},async end(){o.onClose();},suspend(){},refresh(){},offline(){}};setTimeout(()=>o.onState({index:0,total:2,current:'예배',next:'다음',music:'음원 없음',allowed:[]}),0);return s;}'''
server,url=start_local_app_server();url=url.replace('index.html','remote.html')
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':390,'height':844})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
   page.route('**/vendor/supabase-js.min.js',lambda r:r.fulfill(body=MOCK,content_type='text/javascript'))
   page.route('**/mindex.remote-session.mjs*',lambda r:r.fulfill(body=SESSION,content_type='text/javascript'))
   page.goto(url);page.wait_for_function("document.querySelectorAll('#outputList button').length===2")
   assert page.locator('#outputList .output-code:not([hidden])').count()==0
   assert '0123' not in page.locator('#outputList').inner_text()
   for width in (320,390,768,1280):
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.set_viewport_size({'width':390,'height':844})
   # Arrival order can flip on every heartbeat; existing rows/focus must not move.
   page.locator('#outputList button').first.focus()
   page.evaluate("window.originalButton=document.querySelector('#outputList button');rows=[{...rows[1],position:'2 / 10'},{...rows[0],title:'어린이부 예배',position:'3 / 20'},{id:'c',title:'새 예배',device:'새 PC'}]")
   page.wait_for_function("document.querySelectorAll('#outputList button').length===3")
   assert page.locator('#outputList button').evaluate_all("bs=>bs.map(b=>b.dataset.outputId)")==['a','b','c']
   assert page.evaluate('document.activeElement===originalButton && originalButton===document.querySelector("#outputList button")')
   assert '3 / 20' in page.locator('#outputList button').first.inner_text()
   page.evaluate("rows=rows.filter(o=>o.id!=='c').reverse()")
   page.wait_for_function("document.querySelectorAll('#outputList button').length===2")
   page.locator('#outputList button').first.click();assert page.locator('#pairTitle').inner_text()=='어린이부 예배'
   page.fill('#code','0456');page.click('#connect');page.wait_for_function("document.querySelector('#status').textContent.includes('코드') && !document.querySelector('#connect').disabled")
   assert page.evaluate('window.opened||0')==0
   assert page.evaluate("rpcCalls.some(c=>c.name==='mindex_remote_guest'&&c.p_output==='a'&&c.p_code==='0456')")
   page.fill('#code','01');page.wait_for_timeout(3200);assert page.locator('#code').input_value()=='01'
   page.fill('#code','0123');page.click('#connect');page.wait_for_function('window.opened===1');page.wait_for_function("!document.querySelector('#controller').hidden")
   page.click('#disconnect');page.wait_for_function("!document.querySelector('#adminOutputs').hidden")
   page.locator('#outputList button').last.click();page.fill('#code','7777');page.click('#connect');page.wait_for_function('window.opened===2');page.wait_for_function("!document.querySelector('#controller').hidden")
   assert page.evaluate("rpcCalls.some(c=>c.name==='mindex_remote_admin'&&c.p_action==='connect'&&c.p_output==='b')")
   assert page.locator('#selectedOutputTitle').inner_text()=='주일예배 [3부]'
   page.click('#backOutputs');page.wait_for_function("document.querySelectorAll('#outputList .output-code:not([hidden])').length===2")
   page.evaluate("rows.reverse();rows[0].position='8 / 20'")
   page.wait_for_function("document.querySelector('#outputList').textContent.includes('8 / 20')")
   assert page.locator('#outputList button').evaluate_all("bs=>bs.map(b=>b.dataset.outputId)")==['a','b']
   page.click('#adminLogout');page.wait_for_function("document.querySelectorAll('#outputList button').length===2 && document.querySelectorAll('#outputList .output-code:not([hidden])').length===0")
   page.locator('#outputList button[data-output-id=a]').click();page.fill('#code','01');page.evaluate("rows=rows.filter(o=>o.id!=='a')")
   page.wait_for_function("document.querySelector('#pairSelection').hidden");assert page.locator('#code').input_value()==''
   assert '종료' in page.locator('#status').inner_text()
   page.evaluate('rows=[]');page.wait_for_function("document.querySelector('#outputList').textContent.includes('없어요')")
   page.evaluate('directoryFail=true');page.wait_for_function("document.querySelector('#status').textContent.includes('불러오지 못')")
   assert not page.locator('#connect').is_disabled()
   browser.close();print('PASS',engine,'public names without codes, selected guest/admin entry, wrong-output denial, draft retained, stopped output, empty/error, responsive layout',flush=True)
finally:server.shutdown()
