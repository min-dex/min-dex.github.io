"""Real HTTP video + separate output/controller pages. No native fullscreen or production data."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from functools import partial
import threading
from smoke_app import APP_DIR,MindexSmokeServer,launch_chromium,sync_playwright
from smoke_video_health import VideoHealthHandler
server=MindexSmokeServer(('127.0.0.1',0),partial(VideoHealthHandler,directory=str(APP_DIR)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context();host=context.new_page();host.goto(url)
   host.wait_for_function("typeof MindexRemote==='object' && !document.body.classList.contains('ui-booting')")
   host.evaluate('''()=>{
    const sid='remote-video';state.presenter.serviceId=sid;state.selectedServiceId=sid;
    state.presenter.outputSessionId='video-session';state.presenter.index=0;state.presenter.safetyBlank=false;state.presenter.liveScripture=null;
    markPresenterOutputConnected=()=>{};restorePresenterControllerSession=()=> 'restored';
    presenterControllerIsLive=()=>true;isPresenterOutputWindowOpen=()=>true;
    state.presenter.outputWindow={closed:false,postMessage(message){state.presenter.channel.postMessage(message)}};
    window.fixture={serviceId:sid,outputSessionId:'video-session',serviceType:'sunday-afternoon',chromakey:true,
      slides:[{id:'video',type:'video',elementType:'video',layout:'media',videoSrc:'probe-health.mp4',playback:{autoplay:true,muted:true,loop:true}}],index:0,safetyBlank:false,updatedAt:Date.now()};
    state.presenter.slides=fixture.slides;
    window.adapter=MindexRemote.adapter(sid,'video-session',state.presenter.outputWindow);
    publishPresenterPayload(fixture,{force:true});window.mediaSourceBefore=JSON.stringify(fixture);
   }''')
   VideoHealthHandler.failed=False
   output=context.new_page();output.add_init_script("const originalInterval=window.setInterval;window.setInterval=(fn,ms,...args)=>originalInterval(()=>{if(fn.name!=='postHeartbeat'||!window.pauseHeartbeat)fn(...args)},ms)");output.goto(url+'?output=presenter&outputSession=video-session')
   host.wait_for_function("adapter.read().allowed.includes('video-pause')")
   output.wait_for_function("document.querySelector('.is-active video')?.currentTime>.3")
   host.evaluate("state.module='presenter';renderGlobalPlaybackControls()")
   host.click('.global-playback-trigger')
   host.click('[data-global-playback-action="video-pause"]')
   host.wait_for_function("!presenterVideoRequests.size && state.presenter.videoHealth.status==='paused'")
   assert host.locator('#globalPlaybackPanel').is_visible()
   assert output.evaluate("document.querySelector('.is-active video').paused")
   # Controller uses the output clock and seeks the paused video without starting it.
   host.wait_for_function("state.presenter.videoHealth.durationSeconds>0 && !document.querySelector('[data-presenter-video-seek]').disabled")
   assert '이번 반복 남은' in host.locator('[data-presenter-video-clock]').inner_text()
   host.evaluate("window.seekNode=document.querySelector('[data-presenter-video-seek]');beginPresenterVideoSeek(seekNode);seekNode.value=3;previewPresenterVideoSeek(seekNode);renderGlobalPlaybackControls()")
   assert host.evaluate("document.querySelector('[data-presenter-video-seek]')===seekNode && Number(seekNode.value)===3")
   host.evaluate("commitPresenterVideoSeek(seekNode)")
   output.wait_for_function("document.querySelector('.is-active video').paused && Math.abs(document.querySelector('.is-active video').currentTime-3)<.15")
   host.wait_for_function("!presenterVideoRequests.size && state.presenter.videoHealth.status==='paused'")
   assert host.locator('#globalPlaybackPanel').is_visible()
   slider=host.locator('[data-presenter-video-seek]');slider.focus();slider.press('ArrowRight')
   output.wait_for_function("Math.abs(document.querySelector('.is-active video').currentTime-3.1)<.04")
   host.wait_for_function("!presenterVideoRequests.size && state.presenter.videoHealth.status==='paused'")
   slider.press('ArrowLeft')
   output.wait_for_function("Math.abs(document.querySelector('.is-active video').currentTime-3)<.04")
   host.wait_for_function("!presenterVideoRequests.size && state.presenter.videoHealth.status==='paused'")
   assert host.evaluate("presenterMediaClockText(5,20)==='0:05 / 0:20 · 남은 0:15' && presenterMediaClockText(5,Infinity).endsWith('남은 –:––')")
   for value in (-1, float('inf'), 999999):
    assert host.evaluate("async value=>{try{await requestPresenterVideoCommand('remote-video','seek',value);return false}catch{return true}}",value)
   # Input preview owns a separate native media element; it never controls live output.
   host.evaluate("()=>{const h=document.createElement('aside');h.id='input-video-fixture';h.style.cssText='position:fixed;top:10px;left:10px;width:300px;z-index:9999';h.innerHTML=renderPresenterReferenceMediaPreview({url:'probe-health.mp4',name:'영상 입력 미리보기'},'video');h.querySelector('details').open=true;document.body.append(h)}")
   preview=host.locator('#input-video-fixture video')
   assert preview.get_attribute('controls') is not None
   host.wait_for_function("document.querySelector('#input-video-fixture video').readyState>=1")
   preview.evaluate("v=>{v.currentTime=5}")
   host.wait_for_function("document.querySelector('#input-video-fixture [data-input-video-clock]').textContent.startsWith('0:05')")
   assert output.evaluate("document.querySelector('.is-active video').paused && Math.abs(document.querySelector('.is-active video').currentTime-3)<.15")
   host.locator('#globalPlaybackPanel').screenshot(path=f'/tmp/mindex-controller-video-panel-{engine}.png')
   host.locator('#input-video-fixture').screenshot(path=f'/tmp/mindex-controller-video-input-{engine}.png')
   for width in (1280,390):
    host.set_viewport_size({'width':width,'height':900})
    assert host.locator('#globalPlaybackPanel').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   host.set_viewport_size({'width':1280,'height':900})
   preview.evaluate("v=>{window.inputPreviewVideo=v;v.muted=true;void v.play()}")
   host.wait_for_function('!inputPreviewVideo.paused')
   host.locator('#input-video-fixture details').evaluate('e=>e.open=false')
   host.wait_for_function('inputPreviewVideo.paused')
   host.locator('#input-video-fixture details').evaluate('e=>e.open=true')
   preview.evaluate('v=>{void v.play()}');host.wait_for_function('!inputPreviewVideo.paused')
   host.locator('#input-video-fixture').evaluate('e=>e.remove()')
   host.wait_for_function('inputPreviewVideo.paused && presenterInputVideoPreviews.size===0 && presenterInputVideoObserver===null')
   # A local output action supersedes a slider gesture captured against the old revision.
   host.evaluate("beginPresenterVideoSeek(seekNode);seekNode.value=4;previewPresenterVideoSeek(seekNode)")
   output.evaluate("void document.querySelector('.is-active video').play()")
   host.wait_for_function("state.presenter.videoHealth.status==='playing'")
   host.evaluate("commitPresenterVideoSeek(seekNode)")
   assert output.evaluate("document.querySelector('.is-active video').currentTime<4"), 'stale drag sought another revision'
   output.evaluate("document.querySelector('.is-active video').pause()")
   host.wait_for_function("state.presenter.videoHealth.status==='paused'")
   position=output.evaluate("document.querySelector('.is-active video').currentTime")
   host.wait_for_function("adapter.read().allowed.includes('video-play')")
   host.evaluate("adapter.execute('video-play')")
   output.wait_for_function("document.querySelector('.is-active video').currentTime>"+str(position))
   output.evaluate("document.querySelector('.is-active video').currentTime=5")
   output.wait_for_function("!document.querySelector('.is-active video').seeking")
   revision=output.evaluate("presenterVideoRevisions.get(document.querySelector('.is-active video')).value")
   host.wait_for_function("state.presenter.videoHealth.revision==="+str(revision))
   # Seeking increments revision before canplay; wait for the visible action to be ready too.
   host.wait_for_function("state.presenter.videoHealth.status==='playing' && !document.querySelector('[data-global-playback-action=video-restart]').disabled")
   # Real restart, delivered twice via two controller transports, must execute once.
   output.evaluate("window.playCalls=0;window.video=document.querySelector('.is-active video');window.originalPlay=video.play.bind(video);video.play=()=>{playCalls++;return originalPlay()};void 0")
   host.evaluate("document.querySelector('[data-global-playback-action=video-restart]').click();window.secondCommand=requestPresenterVideoCommand('remote-video','restart').then(()=>true,()=>false)")
   assert not host.evaluate('secondCommand'), 'PC/remote in-flight command must not overlap'
   host.wait_for_function('!presenterVideoRequests.size')
   assert output.evaluate('playCalls')==1, output.evaluate('({playCalls,time:video.currentTime,connected:video.isConnected})')
   assert output.evaluate('video.currentTime')<2
   # Native media state events report promptly with periodic heartbeats disabled.
   output.evaluate("window.pauseHeartbeat=true")
   output.evaluate('video.pause()')
   host.wait_for_function("state.presenter.videoHealth.status==='paused'",timeout=700)
   output.evaluate('originalPlay()')
   host.wait_for_function("state.presenter.videoHealth.status==='playing'",timeout=700)
   output.evaluate("window.pauseHeartbeat=false")
   # Freeze heartbeat state, then PC/output pause wins over an outdated remote play state.
   host.evaluate("window.savedHealth=structuredClone(state.presenter.videoHealth);window.originalHandler=handlePresenterControllerMessage;handlePresenterControllerMessage=m=>{if(m.type!=='presenter-heartbeat')originalHandler(m)};void 0")
   output.evaluate('video.pause()')
   result=host.evaluate("async()=>{try{await requestPresenterVideoCommand('remote-video','restart');return 'unexpected'}catch(e){return e.message}}")
   assert '바뀌었습니다' in result,result
   assert output.evaluate('video.paused && playCalls===1')
   host.evaluate('handlePresenterControllerMessage=originalHandler;void 0')
   host.wait_for_function("adapter.read().allowed.includes('video-play')")
   # Browser rejection is surfaced; it must not be acknowledged as playback success.
   output.evaluate("video.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));void 0")
   result=host.evaluate("async()=>{try{await adapter.execute('video-play');return 'unexpected'}catch(e){return e.message}}")
   assert '허용' in result,result
   output.evaluate('video.play=originalPlay;void 0')
   assert host.evaluate('JSON.stringify(fixture)===mediaSourceBefore'), 'media controls changed source payload'
   # Output replacement rejects a queued request even if index returns to the same value.
   host.evaluate("window.commandCapture=null;state.presenter.outputWindow.postMessage=m=>commandCapture=m;window.channelPost=state.presenter.channel.postMessage.bind(state.presenter.channel);state.presenter.channel.postMessage=m=>commandCapture=m;window.pendingVideo=requestPresenterVideoCommand('remote-video','play').then(()=>({ok:true}),e=>({ok:false,message:e.message}))")
   host.evaluate("state.presenter.channel.postMessage=channelPost;publishPresenterPayload({...fixture,slides:[{id:'text',type:'text',text:'다음 화면'}],updatedAt:Date.now()},{force:true})")
   output.wait_for_function("!document.querySelector('.is-active video')")
   host.evaluate('channelPost(commandCapture)')
   assert not host.evaluate('pendingVideo')['ok']
   assert output.evaluate('playCalls')==1, output.evaluate('({playCalls,time:video.currentTime,connected:video.isConnected})')
   print('PASS',engine,'real video play/pause/restart/seek, countdown, separate input preview, stale gesture, duplicate delivery, local/remote race, stale frame and autoplay rejection',flush=True)
   context.close();browser.close()
finally:server.shutdown()
