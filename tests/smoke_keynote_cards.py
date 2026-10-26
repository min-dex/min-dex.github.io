"""Common deck cards with a deliberate opaque Keynote protocol double, offline."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

PLAYER = r'''window.__mindexKeynoteController={
 state:'IdleAtInitialState',currentSceneIndex:0,nextSceneIndex:1,currentSlideIndex:0,advances:0,jumps:0,
 script:{numScenes:25,slideList:Array.from({length:24},(_,n)=>'slide'+n),events:Array.from({length:25},(_,n)=>({effects:n===24?[{type:'transition'}]:[]}))},
 scriptManager:{slideIndexFromSceneIndex:n=>n<2?0:n-1},
 draw(){document.getElementById('stage').textContent='Page '+(this.currentSlideIndex+1)},
 jumpToScene(n){this.jumps++;this.currentSceneIndex=n;this.currentSlideIndex=n<2?0:n-1;this.nextSceneIndex=n===24?-1:n+1;this.state='IdleAtInitialState';this.draw()},
 changeState(s){this.state=s},
 advanceToNextBuild(){if(this.state==='IdleAtFinalState')this.currentSceneIndex=this.nextSceneIndex;this.advances++;this.nextSceneIndex=this.currentSceneIndex===24?-1:this.currentSceneIndex+1;const n=this.nextSceneIndex<0?this.currentSceneIndex:this.nextSceneIndex;this.currentSlideIndex=n<2?0:n-1;this.state='IdleAtFinalState';this.draw();return true},
 goBackToPreviousBuild(){if(this.state==='IdleAtInitialState')this.currentSceneIndex=Math.max(0,this.currentSceneIndex-1);this.currentSlideIndex=this.currentSceneIndex<2?0:this.currentSceneIndex-1;this.nextSceneIndex=this.currentSceneIndex+1;this.state='IdleAtInitialState';this.draw()}
};__mindexKeynoteController.draw();'''
server, url = start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith(('blob:','data:')) else r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function('typeof presenterKeynoteHtmlDeckAsset==="function" && !document.body.classList.contains("ui-booting")')
   page.evaluate(r'''async(player)=>{
    window.check=(v,m)=>{if(!v)throw Error(m)};
    const module=await keynoteHtmlRuntime(), hash='a'.repeat(64), service={id:'cards-service',type_id:'custom',date:'2026-10-25',title:'Offline Keynote cards'};
    window.cardManifest={format:'apple-keynote-html-v1',runtimeSha256:module.KEYNOTE_HTML_RUNTIME_SHA256,sourceSha256:hash,pages:24,scenes:25,slides:Array.from({length:24},(_,page)=>({thumbnail:'assets/page'+page+'.jpeg',sceneStart:page===0?0:page+1,scenes:page===0?2:1})),files:{'assets/player/main.js':{size:1,sha256:module.KEYNOTE_HTML_RUNTIME_SHA256},'assets/header.json':{size:1,sha256:hash}}};
    cardManifest.slides.forEach(s=>cardManifest.files[s.thumbnail]={size:1,sha256:hash});
    const bytes=new TextEncoder().encode(JSON.stringify(cardManifest)), digest=await presenterPptxDigest(bytes);
    const original={format:'key',name:'original.key',url:new URL('/original.key',location.href).href,size:100,sha256:hash};
    window.cardAsset={kind:'file',name:'original.key',url:original.url,original,keynoteHtml:{format:'apple-keynote-html-v1',url:new URL('/cards/manifest.json',location.href).href,sha256:digest,sourceSha256:hash,pages:24,poster:new URL('/cards/assets/page0.jpeg',location.href).href}};
    state.client=null;state.services=[service];state.selectedServiceId=service.id;state.module='presenter';state.loading=false;state.saving=false;
    state.serviceItems={[service.id]:[{id:'card-item',service_id:service.id,label:'참고 화면',raw_title:'original.key',sort_order:1,memo:serializeServiceItemMemo({elementType:'file',inputMode:'asset',asset:cardAsset,note:'preserve',audioTiming:{starts:[1,2]}})}]};
    state.serviceItems[service.id].push({id:'other-deck',service_id:service.id,label:'참고 화면',raw_title:'Other deck',sort_order:2,memo:serializeServiceItemMemo({elementType:'file',inputMode:'asset',asset:{kind:'imported_deck',name:'Other deck',slides:[{url:new URL('/other1.jpeg',location.href).href},{url:new URL('/other2.jpeg',location.href).href}]}})});
    window.originalMemo=getServiceItems(service.id)[0].memo;window.manifestReads=0;
    fetchPresenterPptxBytes=async()=>{manifestReads++;await new Promise(r=>setTimeout(r,60));if(manifestReads===1)throw Error('temporary metadata failure');return bytes};
    loadPresenterKeynoteHtml=async()=>({module,manifest:cardManifest,player});
    renderPresenterControlState=()=>{refs.detailPane.innerHTML=renderPresenterSlideBoard(state.presenter.slides,state.presenter.index,service.id)};
    publishPresenterState=()=>{};preparePresenterService(service.id);renderPresenterControlState();
    window.cardIndexes=()=>state.presenter.slides.flatMap((s,i)=>s.keynote?[i]:[]);
   }''',PLAYER)
   page.wait_for_function('[...presenterKeynoteHtmlManifests.values()].some(entry=>entry.error)')
   assert page.evaluate('cardIndexes().length')==0
   page.locator('.svc-slide-thumb[data-presenter-slide-id="other-deck:imported-deck:1"]').click()
   page.get_by_role('button',name='재연결',exact=True).click()
   page.wait_for_function('cardIndexes().length===24')
   cards=page.locator('.svc-slide-thumb[data-presenter-slide-id^="card-item:imported-deck:"]:not([data-presenter-slide-id$=":after-blank"])')
   assert cards.count()==24
   page.evaluate('''()=>{
    check(manifestReads===2,'manifest was read repeatedly after explicit retry');check(getServiceItems('cards-service')[0].memo===originalMemo,'read projection mutated memo');
    check(state.presenter.slides[state.presenterBoardSelection.indexes[0]]?.id==='other-deck:imported-deck:1','late metadata moved the other deck selection');
    check(state.presenter.slides.filter(s=>s.keynote).every((s,n)=>s.keynote.page===n&&s.imageSrc.endsWith('page'+n+'.jpeg')),'card thumbnails/pages collapsed');
   }''')
   cards.nth(11).click()
   assert page.evaluate('state.presenterBoardSelection.indexes[0]===cardIndexes()[11]')
   page.evaluate('''()=>{
    window.root=document.createElement('main');document.body.append(root);
    window.cardPayload=()=>({serviceId:'cards-service',slides:state.presenter.slides,index:state.presenter.index,pptxProgress:state.presenter.pptxProgress});
    publishPresenterState=()=>renderPresenterKeynoteHtmlOutput(root,cardPayload());
    root._onKeynoteAcknowledgement=()=>queueMicrotask(()=>adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata));
    state.presenter.index=cardIndexes()[11];state.presenter.pptxProgress=null;publishPresenterState();
   }''')
   page.wait_for_function('root._keynoteHtml?.initialized && state.presenter.pptxProgress?.checkpoint?.slide===11')
   frame=page.frames[-1];assert frame.evaluate('__mindexKeynoteController.currentSceneIndex')==12
   page.evaluate('window.sameKeyFrame=root._keynoteHtml.frame;runPresenterAction("jump","cards-service",{index:cardIndexes()[0],scroll:false})')
   page.wait_for_function('state.presenter.pptxProgress?.checkpoint?.slide===0 && !root._keynoteHtml.selecting')
   assert page.evaluate('root._keynoteHtml.frame===sameKeyFrame')
   page.evaluate('runPresenterAction("next","cards-service",{scroll:false})')
   page.wait_for_function('!state.presenter.pptxProgress?.command && state.presenter.pptxProgress?.checkpoint?.phase==="final"')
   assert page.evaluate('state.presenter.index===cardIndexes()[0]')
   page.evaluate('runPresenterAction("next","cards-service",{scroll:false})')
   page.wait_for_function('state.presenter.index===cardIndexes()[1] && !state.presenter.pptxProgress?.command')
   assert frame.evaluate('__mindexKeynoteController.jumps')==2, 'metadata card sync jumped/replayed'
   # A repeated user selection resets that page, while repeated rendering does not.
   page.evaluate('runPresenterAction("jump","cards-service",{index:cardIndexes()[1],scroll:false})')
   page.wait_for_function('state.presenter.pptxProgress?.checkpoint?.scene===2 && state.presenter.pptxProgress?.checkpoint?.phase==="initial"')
   before=frame.evaluate('__mindexKeynoteController.jumps')
   page.evaluate('publishPresenterState();publishPresenterState()');assert frame.evaluate('__mindexKeynoteController.jumps')==before
   # Select twice without waiting: only the newest target owns subsequent metadata.
   page.evaluate('runPresenterAction("jump","cards-service",{index:cardIndexes()[3],scroll:false});runPresenterAction("jump","cards-service",{index:cardIndexes()[17],scroll:false})')
   page.wait_for_function('state.presenter.pptxProgress?.checkpoint?.slide===17 && !root._keynoteHtml.selecting')
   assert page.evaluate('state.presenter.index===cardIndexes()[17] && root._keynoteHtml.frame===sameKeyFrame')
   # The real output checkpoint survives a fresh frame; no new native next is replayed.
   page.evaluate('window.cardSaved=structuredClone(state.presenter.pptxProgress);releasePresenterKeynoteHtmlOutput(root);state.presenter.pptxProgress=cardSaved;publishPresenterState()')
   page.wait_for_function('root._keynoteHtml?.initialized && state.presenter.pptxProgress?.checkpoint?.slide===17')
   frame=page.frames[-1];assert frame.evaluate('__mindexKeynoteController.advances')==0
   page.evaluate('runPresenterAction("jump","cards-service",{index:cardIndexes()[23],scroll:false})')
   page.wait_for_function('state.presenter.pptxProgress?.checkpoint?.slide===23 && !root._keynoteHtml.selecting')
   last=page.evaluate('state.presenter.index');page.evaluate('runPresenterAction("next","cards-service",{scroll:false})')
   page.wait_for_function('!root._keynoteHtml')
   assert page.evaluate('state.presenter.index')==last+1
   assert not errors,errors
   print('PASS',engine,'24 common cards, offline selection, exact native jump/build sync, one frame, races, restore, last-build handoff and memo preservation',flush=True)
   browser.close()
finally:server.shutdown()
