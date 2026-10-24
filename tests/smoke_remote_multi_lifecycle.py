"""Four isolated browser contexts; offline RPC/relay faults, not physical phone radios."""
import os,time,uuid
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium

MOCK="""window.remoteOut=[];window.remoteChannels=[];
window.remoteClient={rpc:async(n,a)=>({data:await window.remoteRpc(n,a)}),channel(topic){const c={topic,on(t,f,h){this.handler=h;return this;},subscribe(cb){this.status=cb;remoteChannels.push(this);queueMicrotask(()=>cb('SUBSCRIBED'));return this;},async send(m){remoteOut.push({topic,payload:m.payload});return 'ok';}};return c;},async removeChannel(c){remoteChannels=remoteChannels.filter(x=>x!==c);}};
window.deliver=p=>remoteChannels.filter(c=>c.topic===p.topic).forEach(c=>c.handler({payload:p.payload}));
window.supabase={createClient:()=>remoteClient};"""
server,url=start_local_app_server();url=url.replace('index.html','remote.html')
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   outputs={};tokens=set()
   def rpc(n,a):
    if n=='mindex_remote_entry':
     if a['p_code']=='7777':
      token=str(uuid.uuid4());tokens.add(token);return dict(ok=True,kind='admin',token=token)
     return dict(ok=True,kind='guest')
    if n=='mindex_remote_output':
     action=a['p_action']
     if action=='register':
      oid=str(uuid.uuid4());outputs[oid]=dict(id=oid,code='0123',info={},links={},guest=None)
      return dict(ok=True,id=oid,token=oid,code='0123')
     o=outputs.get(a['p_id'])
     if not o:return dict(ok=False,error='expired')
     if action=='remove':del outputs[o['id']]
     if action=='unlink':o['links'].pop(a.get('p_ready'),None)
     if action=='unlink_guest' and o['guest'] and o['guest']['id']==a.get('p_ready'):o['guest']=None
     if action=='tick':
      o['info']=a['p_info']
      for link in o['links'].values():
       if link['id'] in a['p_info'].get('adminReady',[]):link['ready']=True
      if o['guest'] and o['guest']['id']==a['p_info'].get('guestReady'):o['guest']['ready']=True
     return dict(ok=True,code=o['code'],links=list(o['links'].values()),guest=o['guest'])
    if n=='mindex_remote_admin':
     token=a['p_token'];action=a['p_action']
     if token not in tokens:return dict(ok=False,error='expired')
     if action=='list':return dict(ok=True,outputs=[dict(**o['info'],id=o['id'],code=o['code']) for o in outputs.values()])
     if action=='logout':
      tokens.discard(token)
      for o in outputs.values():o['links']={k:l for k,l in o['links'].items() if l['owner']!=token}
      return dict(ok=True)
     o=outputs.get(a.get('p_output'))
     if not o:return dict(ok=False,error='offline')
     request=a['p_request']
     if action=='disconnect':
      if o['links'].get(request,{}).get('owner')==token:o['links'].pop(request,None)
      return dict(ok=True)
     link=o['links'].setdefault(request,dict(id=request,owner=token,secret=uuid.uuid4().hex*2,ready=False))
     return dict(ok=True,ready=link['ready'],secret=link['secret'] if link['ready'] else None)
    if n=='mindex_remote_guest':
     for o in outputs.values():
      if a['p_action']=='disconnect':
       if o['guest'] and o['guest']['owner']==a['p_token']:o['guest']=None
       continue
      if o['code']!=a.get('p_code'):continue
      if o['guest'] and o['guest']['owner']!=a['p_token']:return dict(ok=False,error='busy')
      if not o['guest']:o['guest']=dict(id=str(uuid.uuid4()),owner=a['p_token'],secret=uuid.uuid4().hex*2,ready=False)
      g=o['guest'];return dict(ok=True,output=o['id'],ready=g['ready'],secret=g['secret'] if g['ready'] else None)
     return dict(ok=a['p_action']=='disconnect',error='invalid_code')
    raise AssertionError(n)
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch()
   contexts=[browser.new_context() for _ in range(4)];pages=[c.new_page() for c in contexts]
   rpc_down=set()
   for i,page in enumerate(pages):
    page.expose_function('remoteRpc',lambda n,a,i=i:dict(ok=False,error='offline') if i in rpc_down else rpc(n,a))
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.route('**/vendor/supabase-js.min.js',lambda r:r.fulfill(body=MOCK,content_type='text/javascript'))
    page.goto(url)
   host,a,b,guest=pages;dropped=set();frozen=set()
   host.evaluate("""async()=>{
    const {createOutputRegistry}=await import('./mindex.remote-admin.mjs?v=3');
    window.calls=0;window.fixture={live:true,index:0,total:100,current:'현재',next:'다음',music:'정지',version:0,allowed:['next']};
    const adapter={read:()=>fixture,execute:()=>{calls++;fixture.index++;fixture.version++;}};
    window.registry=createOutputRegistry(()=>({key:'live',client:remoteClient,adapter,guestAdapter:adapter,info:{title:'검증 예배',device:'PC'}}),{interval:100});
   }""")
   def pump(seconds=.3):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
     for i,page in enumerate(pages):
      if i in frozen:continue
      packets=page.evaluate('remoteOut.splice(0)')
      for packet in packets:
       for j,dest in enumerate(pages):
        if i!=j and i not in dropped and j not in dropped and j not in frozen:dest.evaluate('p=>deliver(p)',packet)
     host.wait_for_timeout(20)
   def until(fn,seconds=8):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
     pump(.1)
     if fn():return
    raise AssertionError('multi lifecycle timeout: '+str([p.locator('#status').inner_text() for i,p in enumerate(pages) if i not in frozen]))
   def enabled(p):return p.locator('[data-action=next]').is_enabled()
   def connect(p,admin=True,login=True):
    if login:p.fill('#code','7777' if admin else '0123');p.click('#connect')
    if admin:
     until(lambda:p.locator('#outputList button').count()==1)
     p.locator('#outputList button').click()
    until(lambda:enabled(p))
   def visibility(p,hidden):
    p.evaluate("h=>{Object.defineProperty(document,'hidden',{configurable:true,value:h});document.dispatchEvent(new Event('visibilitychange'));}",hidden)
   def next_from(p):
    until(lambda:enabled(p) and p.locator('#position').inner_text()==str(host.evaluate('fixture.index+1'))+' / 100');count=host.evaluate('calls');p.click('[data-action=next]');until(lambda:host.evaluate('calls')==count+1)
   connect(a);connect(b);connect(guest,False)
   visibility(a,True);assert not enabled(a);next_from(b);next_from(guest)
   visibility(a,False);assert not enabled(a);until(lambda:enabled(a))
   assert a.locator('#position').inner_text()==str(host.evaluate('fixture.index+1'))+' / 100'
   dropped.add(2);pump(3.5);assert not enabled(b);next_from(a);next_from(guest)
   dropped.clear();until(lambda:enabled(b));next_from(b)
   # A longer outage still retains the peer; others remain in control.
   dropped.add(2);rpc_down.add(2);pump(11.5);next_from(a);next_from(guest)
   dropped.clear();rpc_down.clear();until(lambda:enabled(b));assert b.locator('#adminOutputs').is_hidden()
   # Lost acknowledgement around sleep must not replay an already executed command.
   count=host.evaluate('calls');a.click('[data-action=next]')
   for packet in a.evaluate('remoteOut.splice(0)'):host.evaluate('p=>deliver(p)',packet)
   host.wait_for_function('calls==='+str(count+1));dropped.add(1);visibility(a,True);pump(4)
   assert host.evaluate('calls')==count+1;assert not enabled(a)
   dropped.clear();visibility(a,False);until(lambda:enabled(a));assert host.evaluate('calls')==count+1
   # Actual channel failure for guest must not terminate either admin.
   guest.evaluate("remoteChannels.forEach(c=>c.status('CHANNEL_ERROR'))");pump(.5)
   assert not enabled(guest);next_from(a);next_from(b);until(lambda:enabled(guest));assert guest.locator('#pairForm').is_hidden()
   if engine=='chromium':
    cdp=contexts[2].new_cdp_session(b);cdp.send('Page.setWebLifecycleState',{'state':'frozen'});frozen.add(2)
    pump(11.5);next_from(a);next_from(guest)
    cdp.send('Page.setWebLifecycleState',{'state':'active'});frozen.clear();visibility(b,False)
    until(lambda:enabled(b));assert b.locator('#adminOutputs').is_hidden();cdp.detach()
   a.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));")
   until(lambda:enabled(a));assert a.locator('#pairForm').is_hidden();next_from(b);next_from(guest)
   # Browser offline/online events recover without entering a code again.
   guest.evaluate("dispatchEvent(new Event('offline'))");assert not enabled(guest)
   guest.evaluate("dispatchEvent(new Event('online'))");until(lambda:enabled(guest))
   # A PC registry outage retains all relay slots and never executes queued input.
   count=host.evaluate('calls');rpc_down.add(0);pump(3.5)
   assert all(not enabled(p) for p in (a,b,guest));assert host.evaluate('calls')==count
   rpc_down.clear();until(lambda:all(enabled(p) for p in (a,b,guest)))
   assert host.evaluate('calls')==count
   host.evaluate('registry.close()')
   for c in contexts:c.close()
   browser.close()
   print('PASS',engine,'2 admins + guest: isolated hide/restore, short/long network loss, reconnect, lost ack no replay, channel failure, BFCache retention'+(', actual renderer freeze' if engine=='chromium' else ''),flush=True)
finally:server.shutdown()
