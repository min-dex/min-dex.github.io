"""Two isolated browser contexts through a ciphertext-only in-memory relay.
No production reads/writes, desktop windows or native fullscreen.
"""
import os,time,json
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
MOCK='''window.remoteOut=[];window.remoteChannels=[];
window.remoteClient={channel(topic){const c={topic,handler:null,on(t,f,h){this.handler=h;return this;},subscribe(cb){this.status=cb;setTimeout(()=>cb('SUBSCRIBED'),0);return this;},async send(m){window.remoteOut.push({topic,payload:m.payload});return 'ok';}};remoteChannels.push(c);return c;},async removeChannel(c){remoteChannels=remoteChannels.filter(x=>x!==c);}};
window.supabase={createClient:()=>window.remoteClient};
window.deliver=p=>{for(const c of remoteChannels)if(c.topic===p.topic)c.handler({payload:p.payload});};'''
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   host_context=browser.new_context(viewport={'width':1280,'height':900})
   phone_context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   host=host_context.new_page();phone=phone_context.new_page();pages=[host,phone]
   for page in pages:
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
   phone.route('**/vendor/supabase-js.min.js',lambda r:r.fulfill(body=MOCK,content_type='text/javascript'))
   host.add_init_script('window.open=()=>null')
   host.goto(url);host.wait_for_function("typeof MindexRemote==='object' && !document.body.classList.contains('ui-booting')")
   host.evaluate(MOCK)
   host.evaluate('''()=>{
    state.client=remoteClient;state.selectedServiceId='remote-fixture';
    Object.assign(state.presenter,{serviceId:'remote-fixture',outputSessionId:'test-session',outputWindow:{closed:false},index:0,slides:[{title:'첫 번째',body:'긴 내용 '.repeat(150)},{title:'두 번째'},{title:'마지막'}],safetyBlank:false});
    presenterControllerIsLive=()=>true;isPresenterOutputWindowOpen=()=>true;
    window.remoteCalls=[];
    runPresenterAction=(action,sid,options)=>{remoteCalls.push(action);if(action==='next')state.presenter.index=Math.min(2,state.presenter.index+1);if(action==='prev')state.presenter.index=Math.max(0,state.presenter.index-1);if(action==='jump')state.presenter.safetyBlank=options.index===-1;};
    Object.assign(state.serviceMusic,{sourceKey:'fixture.wav',ownerServiceId:'remote-fixture',mode:'presenter-audio',playing:false,pending:false,fadeStop:null,autoSyncSuspended:true,timingGroupId:'group'});
    for(const s of state.presenter.slides){s.syncTimeline={groupId:'group',audioSrc:'fixture.wav',localTiming:true};s.songTimingEligible=true;}
    runServiceMusicAction=async action=>{remoteCalls.push(action);state.serviceMusic.playing=action==='toggle'?!state.serviceMusic.playing:false;};
    MindexSongTiming.resumeAutoSync=()=>{remoteCalls.push('resume');state.serviceMusic.autoSyncSuspended=false;return true;};
   }''')
   host.click('#remotePanelBtn');host.click('[data-remote-start]');host.wait_for_function("document.querySelector('[data-remote-code]').textContent.length>0")
   code=host.locator('[data-remote-code]').inner_text()
   phone.goto(url.replace('index.html','remote.html'))
   assert len(code.replace('-',''))==8
   for theme in ('light','dark'):
    phone.emulate_media(color_scheme=theme)
    host.evaluate('theme=>document.body.dataset.theme=theme',theme)
    phone.wait_for_function('theme=>document.documentElement.dataset.theme===theme',arg=theme)
    keys=['--bg','--panel','--panel-2','--ink','--ink-3','--accent','--accent-ink','--r','--font-sans']
    actual=phone.evaluate('keys=>keys.map(k=>getComputedStyle(document.body).getPropertyValue(k).trim())',keys)
    expected=host.evaluate('keys=>keys.map(k=>getComputedStyle(document.body).getPropertyValue(k).trim())',keys)
    assert actual==expected,theme+' Mindex token mismatch'
    assert phone.locator('#connect').evaluate('e=>getComputedStyle(e).borderRadius')=='5px'
    if engine=='chromium':phone.screenshot(path='/tmp/mindex-remote-unified-'+theme+'.png',full_page=True)
   phone.emulate_media(color_scheme='light')
   phone.fill('#code',code.lower());phone.click('#connect')
   history=[]
   def pump(seconds=.3,drop=False):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
     for source,target in ((host,phone),(phone,host)):
      packets=source.evaluate('remoteOut.splice(0)')
      for packet in packets:
       assert set(packet['payload'])=={'mode','box'}
       history.append((source,packet))
       if not drop:target.evaluate('p=>deliver(p)',packet)
     phone.wait_for_timeout(20)
   def ready(action):
    for _ in range(35):
     pump(.1)
     if phone.locator(f'[data-action="{action}"]').is_enabled():return
    raise AssertionError('not ready: '+action+' '+phone.locator('#status').inner_text())
   ready('next');assert phone.locator('#current').inner_text().startswith('첫 번째')
   for width in (320,390,768):
    phone.set_viewport_size({'width':width,'height':844});pump(.1)
    assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow {width}'
    assert phone.locator('[data-action=next]').bounding_box()['height']>=44
   phone.set_viewport_size({'width':390,'height':844})
   if engine=='chromium':phone.screenshot(path='/tmp/mindex-remote-phone.png',full_page=True)
   phone.click('[data-action=next]');pump();assert host.evaluate('state.presenter.index')==1
   assert phone.locator('#result').inner_text()=='처리 완료'
   # Encrypted replay must not execute twice.
   command_packet=[packet for source,packet in history if source==phone and packet['payload']['mode']=='session'][-1]
   count=host.evaluate('remoteCalls.length');host.evaluate('p=>deliver(p)',command_packet);pump();assert host.evaluate('remoteCalls.length')==count
   for action in ('prev','blank','unblank','play','resume','pause','play','stop'):
    ready(action);phone.click(f'[data-action="{action}"]');pump();assert phone.locator('#result').inner_text()=='처리 완료',action
   assert not host.evaluate('state.serviceMusic.playing')
   # A local change between displayed state and command rejects the stale request.
   ready('next');host.evaluate('state.presenter.index=2');phone.click('[data-action=next]');pump()
   assert '바뀌었습니다' in phone.locator('#result').inner_text()
   # No audio/media objects on the remote page.
   assert phone.locator('audio,video,iframe').count()==0
   # Disconnects disable immediately once freshness expires. No commands queued.
   pump(4.2,drop=True);assert phone.locator('[data-action=next]').is_disabled()
   assert '잠김' in phone.locator('#status').inner_text()
   pump(1.5);ready('prev')
   # Host service change revokes the code; output never gets restarted remotely.
   host.evaluate("state.selectedServiceId='other-service'");pump(1.5)
   assert host.locator('[data-remote-status]').inner_text().find('종료')>=0
   pump(3.2);assert phone.locator('[data-action=next]').is_disabled()
   phone.click('#disconnect');assert phone.locator('#pairForm').is_visible()
   phone.fill('#code','123456');phone.click('#connect');pump();assert '확인' in phone.locator('#status').inner_text()
   print('PASS',engine,'separate contexts: phone/tablet layout, pairing, actions, replay, stale revision, outage, service switch, invalid code')
   host_context.close();phone_context.close();browser.close()
finally:server.shutdown()
