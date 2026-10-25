"""Opaque-frame protocol doubles; actual Apple exports/codecs are opt-in evidence."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium

PLAYER=r'''window.__mindexKeynoteController={
 state:'IdleAtInitialState',currentSceneIndex:0,nextSceneIndex:1,currentSlideIndex:0,advances:0,previous:0,
 script:{numScenes:3,slideList:['a','b'],events:[{effects:[]},{effects:[]},{effects:[]}]},
 scriptManager:{slideIndexFromSceneIndex:n=>n>1?1:0},
 draw(){document.getElementById('stage').textContent='Frame '+(this.state==='IdleAtFinalState'&&this.nextSceneIndex>=0?this.nextSceneIndex:this.currentSceneIndex)},
 advanceToNextBuild(){if(this.state==='IdleAtFinalState')this.currentSceneIndex=this.nextSceneIndex;this.advances++;this.nextSceneIndex=this.currentSceneIndex===2?-1:this.currentSceneIndex+1;this.currentSlideIndex=(this.nextSceneIndex<0?this.currentSceneIndex:this.nextSceneIndex)>1?1:0;this.state='IdleAtFinalState';this.draw();if(this.failNext){this.failNext=false;throw Error('unknown after dispatch')}return true},
 goBackToPreviousBuild(){this.previous++;if(this.state==='IdleAtInitialState')this.currentSceneIndex=Math.max(0,this.currentSceneIndex-1);this.state='IdleAtInitialState';this.currentSlideIndex=this.currentSceneIndex>1?1:0;this.nextSceneIndex=this.currentSceneIndex+1;this.draw()},
 jumpToScene(n){this.currentSceneIndex=n;this.currentSlideIndex=n>1?1:0;this.nextSceneIndex=n===2?-1:n+1;this.state='IdleAtInitialState';this.draw()},
 changeState(s){this.state=s}
};__mindexKeynoteController.draw();'''
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page()
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith(('blob:','data:')) else r.abort())
   def setup(saved=None):
    page.wait_for_function('typeof renderPresenterKeynoteHtmlOutput==="function" && !document.body.classList.contains("ui-booting")')
    page.evaluate('''async({player,saved})=>{
     const module=await keynoteHtmlRuntime();window.fixtureModule=module;window.fixturePlayer=player;window.check=(v,m)=>{if(!v)throw Error(m)};window.renders=0;
     loadPresenterKeynoteHtml=async()=>({module,player,manifest:{scenes:3,slides:[{thumbnail:'one.jpeg'},{thumbnail:'two.jpeg'}]}});
     const original={format:'key',name:'source.key',url:new URL('/source.key',location.href).href,size:100,sha256:'a'.repeat(64)};
     const sidecar={format:'apple-keynote-html-v1',url:new URL('/deck/manifest.json',location.href).href,sha256:'b'.repeat(64),sourceSha256:original.sha256,pages:2,poster:new URL('/deck/one.jpeg',location.href).href};
     window.keySlide={id:'key-slide',elementId:'key-item',type:'file',elementType:'file',layout:'media',asset:normalizeServiceAsset({kind:'file',name:'source.key',url:original.url,original,keynoteHtml:sidecar})};
     check(keySlide.asset.keynoteHtml.poster===sidecar.poster,'poster normalization');
     const records=normalizeServiceDocumentSourceRecords([{elementId:'key-item',asset:keySlide.asset}]);check(records[0].asset.keynoteHtml.sha256===sidecar.sha256,'portable source lost sidecar');
     const rows=sanitizeWorshipPersistenceRows({sections:[],elements:[{id:'key-item',asset:keySlide.asset,config:{asset:keySlide.asset}}]});check(rows.elements[0].asset.original.sha256===original.sha256&&rows.elements[0].asset.keynoteHtml.sha256===sidecar.sha256,'atomic normalization lost source/sidecar');
     window.payload={serviceId:'fixture',outputSessionId:'fixture-output',slides:[{id:'before',type:'text',text:'Before'},keySlide,{id:'after',type:'text',text:'After'}],index:1,pptxProgress:saved||null};
     state.presenter={...state.presenter,serviceId:'fixture',slides:payload.slides,index:1,pptxProgress:saved||null};
     renderPresenterControlState=()=>{renders++};publishPresenterState=()=>{payload.pptxProgress=JSON.parse(JSON.stringify(state.presenter.pptxProgress));renderPresenterOutput(payload)};
     document.body.className='presenter-output-body';document.body.innerHTML='<main id="presenterOutputRoot" class="presenter-output-root no-chromakey"></main><span data-keynote-page data-keynote-item-id="key-item"></span>';
     window.root=document.getElementById('presenterOutputRoot');renderPresenterOutput(payload);
    }''',{'player':PLAYER,'saved':saved})
   page.goto(url+'?mindexSmokeRaw=1');setup();page.wait_for_function('root._keynoteHtml?.initialized')
   frame=page.frames[-1]
   assert frame.evaluate('self.origin')=='null'
   assert frame.evaluate('(()=>{try{parent.document.body;return false}catch(e){return e.name==="SecurityError"}})()')
   page.evaluate('''()=>{
    adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata);
    const before=JSON.stringify(state.presenter.pptxProgress);adoptPresenterKeynoteHtmlMetadata({...root._keynoteHtmlMetadata,key:'wrong-service'});check(JSON.stringify(state.presenter.pptxProgress)===before,'foreign service metadata adopted');
    window.sameFrame=root._keynoteHtml.frame;renderPresenterOutput({...payload,safetyBlank:true});check(root._keynoteHtml.frame===sameFrame&&sameFrame.style.visibility==='hidden','blackout remounted');
    renderPresenterOutput({...payload,liveScripture:{active:true,slide:{type:'text',text:'Overlay'}}});check(root._keynoteHtml.frame===sameFrame&&root._keynoteHtml.host.hidden,'overlay disposed deck');renderPresenterOutput(payload);check(root._keynoteHtml.frame===sameFrame,'overlay return replayed');
    sameFrame.contentWindow.postMessage({type:'mindex-keynote-html-command',token:'wrong',request:{id:'forged000',action:'next'}},'*');
    window.postMessage({type:'mindex-keynote-html',token:root._keynoteHtml.token,kind:'ack',id:'forged000',checkpoint:{scene:2,phase:'final',slide:1,nextScene:-1,atEnd:true}},'*');
   }''')
   assert frame.evaluate('__mindexKeynoteController.advances')==0
   page.evaluate('advancePresenterPptx(state.presenter,1);publishPresenterState()')
   page.wait_for_function('root._keynoteHtmlMetadata?.id===state.presenter.pptxProgress.command?.id')
   page.evaluate('adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata);renderPresenterOutput(payload);renderPresenterOutput(payload)')
   assert frame.evaluate('__mindexKeynoteController.advances')==1
   saved=page.evaluate('state.presenter.pptxProgress');saved['command']={'id':'unknown-before-reload','action':'next'};page.reload();setup(saved);page.wait_for_function('root._keynoteHtml?.initialized');frame=page.frames[-1]
   assert page.evaluate('root._keynoteHtmlMetadata.recoveredUnknown') is True
   assert frame.evaluate('__mindexKeynoteController.currentSceneIndex')==1
   assert frame.evaluate('__mindexKeynoteController.advances')==0
   page.evaluate('''()=>{
    adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata);
    check(normalizePresenterMiniPreviewSlide(keySlide).type==='image','controller still shows file card');
    state.presenter.pptxProgress={key:presenterKeynoteHtmlKey(state.presenter,keySlide),checkpoint:{scene:0,phase:'initial',slide:0,nextScene:1}};check(!advancePresenterPptx(state.presenter,-1),'first build blocked ordinary previous');
    state.presenter.pptxProgress={key:presenterKeynoteHtmlKey(state.presenter,keySlide),checkpoint:{scene:2,phase:'final',slide:1,nextScene:-1,atEnd:true}};check(!advancePresenterPptx(state.presenter,1),'last build blocked ordinary next');
    state.presenter.pptxProgress=null;
   }''')
   frame.evaluate('__mindexKeynoteController.failNext=true')
   page.evaluate('advancePresenterPptx(state.presenter,1);publishPresenterState()')
   page.wait_for_function('!!root._keynoteHtmlMetadata?.error');page.evaluate('adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata);requestPresenterKeynoteHtmlMedia(state.presenter,"status");publishPresenterState()')
   page.wait_for_function('root._keynoteHtmlMetadata?.id===state.presenter.pptxProgress.command?.id && !root._keynoteHtmlMetadata.error');assert frame.evaluate('__mindexKeynoteController.advances')==1
   page.evaluate('''()=>{
    adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata);check(!root.dataset.pptxError,'reconnect left stale error');
    const before=JSON.stringify(state.presenter.pptxProgress);const button={disabled:false,dataset:{serviceId:'fixture',keynoteItemId:'other',keynoteSourceHash:'a'.repeat(64),keynoteHtmlAction:'play'}};
    handlePresenterKeynoteHtmlAction({target:{closest:()=>button},preventDefault(){}});check(JSON.stringify(state.presenter.pptxProgress)===before,'other item controlled current deck');
    state.presenter.safetyBlank=true;check(!requestPresenterKeynoteHtmlMedia(state.presenter,'play'),'hidden output started sound');state.presenter.safetyBlank=false;
    releasePresenterKeynoteHtmlOutput(root);window.loadAttempts=0;
    loadPresenterKeynoteHtml=async()=>{loadAttempts++;if(loadAttempts===1)throw Error('temporary fetch failure');return {module:fixtureModule,player:fixturePlayer,manifest:{scenes:3,slides:[{thumbnail:'one.jpeg'},{thumbnail:'two.jpeg'}]}}};
    renderPresenterOutput(payload);
   }''')
   page.wait_for_function('!!root.dataset.pptxError');page.evaluate('adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata);requestPresenterKeynoteHtmlMedia(state.presenter,"status");publishPresenterState()')
   page.wait_for_function('root._keynoteHtml?.initialized&&root._keynoteHtmlMetadata?.id===state.presenter.pptxProgress.command?.id');assert page.evaluate('loadAttempts')==2
   page.evaluate('''()=>{
    adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata);releasePresenterKeynoteHtmlOutput(root);state.presenter.pptxProgress=null;payload.pptxProgress=null;
    loadPresenterKeynoteHtml=()=>new Promise(resolve=>window.finishColdLoad=()=>resolve({module:fixtureModule,player:fixturePlayer,manifest:{scenes:3,slides:[{thumbnail:'one.jpeg'},{thumbnail:'two.jpeg'}]}}));
    renderPresenterOutput(payload);root._onKeynoteAcknowledgement=()=>queueMicrotask(()=>adoptPresenterKeynoteHtmlMetadata(root._keynoteHtmlMetadata));advancePresenterPptx(state.presenter,1);publishPresenterState();finishColdLoad();
   }''')
   page.wait_for_function('root._keynoteHtml?.initialized && !state.presenter.pptxProgress.command && root._keynoteHtmlMetadata?.checkpoint?.phase==="final"');frame=page.frames[-1];assert frame.evaluate('__mindexKeynoteController.advances')==1
   page.evaluate('''()=>{renderPresenterOutput({...payload,slides:[{id:'after',type:'text',text:'After'}],index:0});check(!root._keynoteHtml&&!document.querySelector('iframe[title="Keynote 슬라이드"]'),'departure kept player')}''')
   print('PASS',engine,'opaque protocol double: identity, receipts, canonical reload, boundaries, overlays, preview, unknown outcome status and cleanup',flush=True);browser.close()
finally:server.shutdown()
