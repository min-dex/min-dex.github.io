"""Offline native video ending and visual-only transitions; no output session or DB."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':960,'height':540})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.on('pageerror',lambda e:print('PAGEERROR',e,flush=True))
   page.goto(url);page.wait_for_function('typeof renderPresenterOutput==="function" && !document.body.classList.contains("ui-booting")')
   page.evaluate('''()=>{
    document.querySelector('#presenterOutputRoot')?.remove();
    window.testRoot=document.createElement('main');testRoot.id='presenterOutputRoot';testRoot.className='presenter-output-root no-chromakey';document.body.append(testRoot);
    window.makeVideo=(role='',playback={})=>({id:'video-'+role,elementType:'video',type:'video',layout:'media',presenterRole:role,videoSrc:'/tests/fixtures/praise-background.webm',playback:{muted:true,...playback}});
    window.makePayload=(role='',playback={})=>({serviceId:'offline-video',serviceType:'youth',chromakey:false,index:0,slides:[makeVideo(role,playback),{id:'after',elementType:'title_person',type:'title-assignee',layout:'lower_bar_text',title:'다음 순서',text:'다음 순서'}]});
    for(const slide of [makeVideo('waiting_loop'),makeVideo('ready'),makeVideo('',{loop:true}),makeVideo('',{autoAdvanceOnEnd:false}),{...makeVideo(),live:true}])if(presenterSlideShouldAutoAdvanceOnEnd(slide))throw Error('excluded video advances');
    if(!presenterSlideShouldAutoAdvanceOnEnd(makeVideo())||!presenterSlideShouldAutoAdvanceOnEnd(makeVideo('intro')))throw Error('ordinary/intro missing');
   }''')
   for role in ('','intro'):
    page.evaluate('''role=>{window.hit=0;window.payload=makePayload(role);renderPresenterOutput(payload,{onAutoAdvance:()=>{hit++;renderPresenterOutput({...payload,index:1});}});}''',role)
    page.wait_for_function('testRoot.querySelector(".is-active video")?.readyState>=1')
    page.evaluate('''async()=>{const v=testRoot.querySelector('.is-active video');v.volume=.37;window.oldVideo=v;await v.play();}''')
    try: page.wait_for_function('hit===1 && testRoot.classList.contains("is-video-end-transition")',timeout=5000)
    except Exception:
     print(page.evaluate('({hit,classes:testRoot.className,marker:testRoot._presenterVideoEndFade,video:oldVideo && {time:oldVideo.currentTime,duration:oldVideo.duration,ended:oldVideo.ended,loop:oldVideo.loop},html:testRoot.innerHTML.slice(0,300)})'),flush=True);raise
    assert page.evaluate("getComputedStyle(testRoot.querySelector('.is-active')).transitionDuration")=='0.5s'
    # Linux WebKit exposes the media backend's float32 volume rounding.
    volume=page.evaluate('oldVideo.volume')
    assert abs(volume-.37)<1e-6, volume
    page.wait_for_function('!testRoot.classList.contains("is-transitioning")')
    assert page.evaluate('hit')==1
   page.evaluate('''()=>{const payload=makePayload();renderPresenterOutput(payload);renderPresenterOutput({...payload,index:1});if(testRoot.classList.contains('is-video-end-transition'))throw Error('manual fade');}''')
   page.evaluate("""() => {
    const payload=makePayload();
    renderPresenterOutput(payload,{onAutoAdvance:()=>renderPresenterOutput({...payload,serviceId:'another-service',index:1})});
    testRoot.querySelector('.is-active video').dispatchEvent(new Event('ended'));
    if(testRoot.classList.contains('is-video-end-transition'))throw Error('cross-service fade');
   }""")
   page.emulate_media(reduced_motion='reduce')
   page.evaluate('''()=>{const payload=makePayload();renderPresenterOutput(payload,{onAutoAdvance:()=>renderPresenterOutput({...payload,index:1})});testRoot.querySelector('.is-active video').dispatchEvent(new Event('ended'));}''')
   assert page.evaluate("getComputedStyle(testRoot.querySelector('.is-active')).transitionDuration")=='0s'
   print('PASS',engine,'native ordinary/intro end, one advance, 500ms visual fade, unchanged volume, exclusions/manual/reduced-motion',flush=True)
   browser.close()
finally:server.shutdown()
