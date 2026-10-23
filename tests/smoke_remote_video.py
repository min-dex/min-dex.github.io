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
    publishPresenterPayload(fixture,{force:true});
   }''')
   VideoHealthHandler.failed=False
   output=context.new_page();output.goto(url+'?output=presenter&outputSession=video-session')
   host.wait_for_function("adapter.read().allowed.includes('video-pause')")
   output.wait_for_function("document.querySelector('.is-active video')?.currentTime>.3")
   host.evaluate("adapter.execute('video-pause')")
   assert output.evaluate("document.querySelector('.is-active video').paused")
   position=output.evaluate("document.querySelector('.is-active video').currentTime")
   host.wait_for_function("adapter.read().allowed.includes('video-play')")
   host.evaluate("adapter.execute('video-play')")
   output.wait_for_function("document.querySelector('.is-active video').currentTime>"+str(position))
   output.evaluate("document.querySelector('.is-active video').currentTime=5")
   host.wait_for_function("state.presenter.videoHealth.revision>=3")
   # Real restart, delivered twice via two controller transports, must execute once.
   output.evaluate("window.playCalls=0;window.video=document.querySelector('.is-active video');window.originalPlay=video.play.bind(video);video.play=()=>{playCalls++;return originalPlay()};void 0")
   host.evaluate("adapter.execute('video-restart')")
   assert output.evaluate('playCalls')==1, output.evaluate('({playCalls,time:video.currentTime,connected:video.isConnected})')
   assert output.evaluate('video.currentTime')<2
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
   # Output replacement rejects a queued request even if index returns to the same value.
   host.evaluate("window.commandCapture=null;state.presenter.outputWindow.postMessage=m=>commandCapture=m;window.channelPost=state.presenter.channel.postMessage.bind(state.presenter.channel);state.presenter.channel.postMessage=m=>commandCapture=m;window.pendingVideo=requestPresenterVideoCommand('remote-video','play').then(()=>({ok:true}),e=>({ok:false,message:e.message}))")
   host.evaluate("state.presenter.channel.postMessage=channelPost;publishPresenterPayload({...fixture,slides:[{id:'text',type:'text',text:'다음 화면'}],updatedAt:Date.now()},{force:true})")
   output.wait_for_function("!document.querySelector('.is-active video')")
   host.evaluate('channelPost(commandCapture)')
   assert not host.evaluate('pendingVideo')['ok']
   assert output.evaluate('playCalls')==1, output.evaluate('({playCalls,time:video.currentTime,connected:video.isConnected})')
   print('PASS',engine,'real video play/pause/restart, duplicate delivery, local/remote race, stale frame and autoplay rejection',flush=True)
   context.close();browser.close()
finally:server.shutdown()
