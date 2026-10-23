"""Admin UI and two registered outputs on an isolated encrypted relay, no production."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
MOCK=r'''const channels=new Set(),outputs=new Map();window.calls=[];
window.remoteClient={async rpc(name,a={}){
 let data={ok:true};
 if(name==='mindex_remote_entry')data=a.p_code==='7777'?{ok:true,kind:'admin',token:'test-token'}:{ok:true,kind:'guest'};
 if(name==='mindex_remote_output'){
  if(a.p_action==='register'){const id=crypto.randomUUID();outputs.set(id,{id,token:id,code:String(1000+outputs.size),info:{},link:null});data={ok:true,id,token:id};}
  else {const o=outputs.get(a.p_id);if(!o)return {data:{ok:false,error:'expired'}};
   if(a.p_action==='tick'){o.info=a.p_info;if(a.p_ready&&o.link?.id===a.p_ready)o.ready=true;data={ok:true,link:o.link};}
   if(a.p_action==='unlink'&&o.link?.id===a.p_ready){o.link=null;o.ready=false;}
   if(a.p_action==='remove')outputs.delete(a.p_id);
  }
 }
 if(name==='mindex_remote_admin'){
  const o=outputs.get(a.p_output);
  if(a.p_action==='list')data={ok:true,outputs:[...outputs.values()].map(o=>({...o.info,id:o.id,code:o.code}))};
  if(a.p_action==='connect'){
   if(!o.link)o.link={id:a.p_request,secret:crypto.randomUUID().replaceAll('-','').repeat(2)};
   data={ok:true,ready:!!o.ready,secret:o.ready?o.link.secret:undefined};
  }
  if(a.p_action==='disconnect'&&o){o.link=null;o.ready=false;}
  if(a.p_action==='logout')for(const o of outputs.values()){o.link=null;o.ready=false;}
 }
 return {data};
},channel(topic){return {topic,on(t,f,h){this.handler=h;return this;},subscribe(cb){channels.add(this);queueMicrotask(()=>cb('SUBSCRIBED'));return this;},async send(m){for(const c of channels)if(c!==this&&c.topic===topic)queueMicrotask(()=>c.handler({payload:m.payload}));return 'ok';}};},async removeChannel(c){channels.delete(c);}};
window.supabase={createClient:()=>remoteClient};'''
server,url=start_local_app_server();url=url.replace('index.html','remote.html')
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':390,'height':844})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
   page.route('**/vendor/supabase-js.min.js',lambda r:r.fulfill(body=MOCK,content_type='text/javascript'))
   page.goto(url)
   page.evaluate('''async()=>{
    const {createOutputRegistry}=await import('./mindex.remote-admin.mjs?v=3');
    window.hosts=['첫째 예배','둘째 예배'].map((title,i)=>{
     const h={live:true,index:0,version:0,title};
     h.registry=createOutputRegistry(()=>h.live?{key:title,client:remoteClient,info:{title,device:'송출 PC',position:String(h.index+1)},adapter:{read:()=>({live:h.live,index:h.index,total:5,current:title,next:'다음',music:'음원 없음',version:h.version,allowed:['next','prev','output-stop']}),execute:async action=>{calls.push([i,action]);h.version++;if(action==='next')h.index++;if(action==='prev')h.index--;if(action==='output-stop')h.live=false;}}}:null,{interval:100});return h;
    });
   }''')
   page.fill('#code','7777');page.click('#connect')
   page.wait_for_function("document.querySelectorAll('#outputList button').length===2")
   assert page.locator('#code').input_value()==''
   assert page.locator('#outputList .output-code').all_text_contents()==['코드 1000','코드 1001']
   assert page.locator('#pairForm').is_hidden();assert page.locator('#adminOutputs').is_visible()
   for width in (320,390,768):
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.set_viewport_size({'width':390,'height':844})
   page.screenshot(path='/tmp/mindex-remote-admin-'+engine+'.png',full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.locator('#outputList button').filter(has_text='첫째 예배').click()
   page.wait_for_function("!document.querySelector('[data-action=next]').disabled")
   page.click('[data-action=next]');page.wait_for_function('hosts[0].index===1')
   assert page.evaluate('hosts[1].index')==0
   assert page.locator('#stopOutput').is_visible()
   assert page.locator('#selectedOutputTitle').inner_text()=='첫째 예배'
   assert page.locator('#selectedOutputCode').inner_text()=='코드 1000'
   assert page.locator('#backOutputs').is_visible()
   page.click('#backOutputs');page.wait_for_function("!document.querySelector('#adminOutputs').hidden")
   assert page.evaluate('hosts.every(h=>h.live)')
   page.locator('#outputList button').filter(has_text='둘째 예배').click()
   page.wait_for_function("!document.querySelector('[data-action=next]').disabled")
   page.click('[data-action=next]');page.wait_for_function('hosts[1].index===1')
   page.wait_for_function("!document.querySelector('#stopOutput').disabled")
   page.once('dialog',lambda d:d.accept());page.click('#stopOutput')
   page.wait_for_function('!hosts[1].live');assert page.evaluate('hosts[0].live')
   page.wait_for_function("!document.querySelector('#adminOutputs').hidden")
   page.click('#adminLogout');page.wait_for_function("!document.querySelector('#pairForm').hidden")
   assert page.locator('#code').input_value()==''
   assert page.locator('#pairForm').is_visible()
   page.evaluate('hosts.forEach(h=>h.registry.close())')
   browser.close();print('PASS',engine,'PIN UI, two outputs, encrypted commands, switch preserves outputs, selected stop, logout',flush=True)
finally:server.shutdown()
