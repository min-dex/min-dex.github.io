"""Common fullscreen artwork contrast and confession markers; no native output."""
import os
import io
from PIL import Image
import subprocess
import sys
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'tools/build_background_luminance.py'),'--check'],check=True)
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':900})
   white_image=io.BytesIO();Image.new('RGB',(64,36),'white').save(white_image,format='PNG')
   black_image=io.BytesIO();Image.new('RGB',(64,36),'black').save(black_image,format='PNG')
   def route(request):
    if request.request.url.endswith('contrast-white.png'):
     request.fulfill(body=white_image.getvalue(),content_type='image/png')
    elif request.request.url.endswith('contrast-black.png'):
     request.fulfill(body=black_image.getvalue(),content_type='image/png')
    elif request.request.url.startswith(url.rsplit('/',1)[0]+'/'):
     request.continue_()
    else:
     request.abort()
   page.route('**/*',route)
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof renderPresenterSlideMiniPreview==='function'&&!document.body.classList.contains('ui-booting')")
   result=page.evaluate('''async()=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    const brown='rgb(51, 34, 17)',white='rgb(255, 255, 255)';
    const original=presenterBackgroundSourcesForService;
    const service={id:'contrast-fixture',type_id:'children',date:'2026-10-25'};
    state.services=[service];state.serviceTypes=[{id:'children',name:'어린이부 예배'}];
    const colors=['#FFC832','#C8FF32','#FF96C8','#FF6432','#32C8FF','#9696FF'];
    const emphasis={id:'emphasis',type:'liturgical-body',title:'공동체고백',text:'예배자 훈련자 전도자 치유자 화해자 소명자',layout:'center_text',outputContext:'clean',textHighlights:['예배자','훈련자','전도자','치유자','화해자','소명자'].map((text,i)=>({text,color:colors[i],bold:true}))};
    const slides=[emphasis,
     {id:'ready',type:'ready',title:'예배',text:'예배 준비',layout:'center_text',outputContext:'clean'},
     {id:'creed',type:'liturgical-body',title:'사도신경',text:'나는 전능하신 하나님을 믿습니다',layout:'center_text',outputContext:'clean'},
     {id:'lyric',type:'lyrics',elementType:'praise',text:'주 은혜임을',layout:'center_text',outputContext:'clean'},
     {id:'blank',type:'blank',elementType:'blank',layout:'blank',text:'',outputContext:'clean'}];
    refs.detailPane.innerHTML='<div id="contrast-fixture"></div>';
    const host=document.querySelector('#contrast-fixture');
    const markerState=root=>[...root.querySelectorAll('.presenter-text-highlight--color')].map((el,i)=>{
      const style=getComputedStyle(el);const probe=document.createElement('span');
      probe.style.backgroundImage='linear-gradient(to bottom, transparent 45%, '+colors[i]+' 45%, '+colors[i]+' 95%, transparent 95%)';host.append(probe);
      check(style.backgroundImage===getComputedStyle(probe).backgroundImage,'original marker color/50% coverage mismatch');probe.remove();
      check(style.color===brown&&style.webkitTextStrokeWidth==='0px','marker ink/outline mismatch');
      const padding=+style.paddingLeft.replace('px','')*1920/root.clientWidth;
      check(Math.abs(padding-4)<.01,'marker padding mismatch');
      return [style.color,style.backgroundImage,style.fontWeight];
    });
    try {
     const confessionItem={id:'children-confession',label:'공동체고백',_worshipSectionKey:'community_confession'};
     const originalItem=JSON.stringify(confessionItem);
     const childrenSlides=buildPresenterLiturgicalBodySlides(confessionItem,{},0,service,{},'');
     check(childrenSlides.length===1&&childrenSlides[0].text.endsWith('꿈꾸는 어린이부 공동체가 되겠습니다.'),'children closing missing');
     check(childrenSlides[0].textHighlights.some(h=>h.text.endsWith('꿈꾸는 어린이부 공동체')&&h.bold),'children closing bold missing');
     const mainSlides=buildPresenterLiturgicalBodySlides(confessionItem,{},0,{type_id:'sunday-main'},{},'');
     check(JSON.stringify(mainSlides.map(s=>s.text))===JSON.stringify(PRESENTER_PUBLIC_COMMUNITY_CONFESSION_CHROMAKEY_SLIDES),'third-service confession changed');
     check(JSON.stringify(confessionItem)===originalItem,'confession source mutated');
     const edited={...confessionItem,template_modified:true};
     check(liturgicalBodyText(edited,{slides:['직접 작성한 공동체고백']},'',service)==='직접 작성한 공동체고백','authored confession replaced');
     presenterBackgroundSourcesForService=()=>['assets/worship-backgrounds/26-C2.png'];
     host.innerHTML=renderPresenterSlideMiniPreview(childrenSlides[0],service.id);
     const childMini=host.querySelector('.svc-slide-mini-canvas');
     const childOutput=document.createElement('main');childOutput.className='presenter-output-root';host.append(childOutput);
     applyPresenterOutputFrameState(childOutput,presenterOutputFrameStateForSlide(childrenSlides[0],{chromakey:false,serviceType:'children',backgroundImages:['assets/worship-backgrounds/26-C2.png']}));
     childOutput.innerHTML=renderPresenterSlideFrame(childrenSlides[0],{noChromakey:true});
     await document.fonts.ready;fitPresenterLyricText(host);
     for(const root of [childMini,childOutput]) {
      check(root.textContent.includes('꿈꾸는 어린이부 공동체가 되겠습니다.'),'children preview/output closing mismatch');
      const box=root.querySelector('.presenter-liturgical-body-lines');
      check(box.scrollWidth<=box.clientWidth+1&&box.scrollHeight<=box.clientHeight+1,'children confession overflow');
     }
     check(presenterInkForLuminance(.3)==='white'&&presenterInkForLuminance(.30001)==='brown','contrast boundary mismatch');
     check(presenterInkForLuminance(null)==='white'&&presenterInkForLuminance(NaN)==='white','unreadable background fallback mismatch');
     const count=presenterOutputImagePreloadCache.size;
     for(const name of Object.keys(PRESENTER_BACKGROUND_LUMINANCE)) for(const type of ['children','youth','young-adult','sunday-first']) {
      service.type_id=type;
      const source='assets/worship-backgrounds/'+name+'.png?fixture=1';
      presenterBackgroundSourcesForService=()=>[source];
      const ink=presenterInkForLuminance(PRESENTER_BACKGROUND_LUMINANCE[name]);
      const foreground=ink==='brown'?brown:white;
      for(const slide of slides) {
       host.innerHTML=renderPresenterSlideMiniPreview(slide,service.id);
       const mini=host.querySelector('.svc-slide-mini-canvas');
       const frame=presenterOutputFrameStateForSlide(slide,{chromakey:false,serviceType:type,backgroundImages:[source]});
       const out=document.createElement('main');out.className='presenter-output-root';host.append(out);applyPresenterOutputFrameState(out,frame);out.innerHTML=renderPresenterSlideFrame(slide,{noChromakey:true});
       for(const root of [mini,out]) {
        check(root.dataset.outputInk===ink,name+'/'+type+' ink selection mismatch');
        const text=root.querySelector('.presenter-slide-text,.presenter-liturgical-body-lines,.presenter-ready-screen-message');
        if(text)check(getComputedStyle(text).color===foreground,name+'/'+type+' foreground mismatch');
        const cross=root.querySelector('.presenter-slide--blank');
        if(cross)for(const pseudo of ['::before','::after'])check(getComputedStyle(cross,pseudo).backgroundColor===foreground,'cross ink mismatch');
        for(const logo of root.querySelectorAll('.presenter-ready-screen-logo,.presenter-waiting-loop-logo'))check(getComputedStyle(logo).filter.includes('fullscreen-ink.svg')===(ink==='brown'),'logo ink mismatch');
       }
       if(slide.id==='emphasis')check(JSON.stringify(markerState(mini))===JSON.stringify(markerState(out)),'marker preview/output mismatch');
      }
      const preview='assets/worship-backgrounds/previews/'+name+'.webp?v=1';
      check(presenterBackgroundInk(preview)===ink,'preview file identity mismatch');
     }
     check(presenterOutputImagePreloadCache.size===count,'known backgrounds added original-image downloads for ink analysis');
     check(presenterBackgroundInk('assets/worship-backgrounds/26-C2.png')==='white','grass did not retain default white');
     check(presenterBackgroundInk('assets/worship-backgrounds/26-C5.png')==='brown','cream artwork did not select brown');
     // Unknown uploaded artwork follows the same rule once its image decodes.
     const dark=new URL('contrast-black.png',window.location.href).href,light=new URL('contrast-white.png',window.location.href).href;
     presenterBackgroundSourcesForService=()=>[light];service.type_id='children';
     host.innerHTML=renderPresenterSlideMiniPreview(slides[2],service.id);
     await preloadPresenterOutputImage(light);await Promise.resolve();
     check(host.querySelector('.presenter-output-root').dataset.outputInk==='brown','custom preview did not update after decode');
     const root=document.createElement('main');root.className='presenter-output-root';host.replaceChildren(root);
     const frame=presenterOutputFrameStateForSlide(slides[2],{chromakey:false,serviceType:'young-adult',backgroundImages:[light]});
     applyPresenterOutputFrameState(root,frame);root.innerHTML=renderPresenterSlideFrame(slides[2],{noChromakey:true});
     check(root.dataset.outputInk==='brown','custom light output mismatch');
     applyPresenterOutputFrameState(root,{...frame,backgroundImages:[dark]});
     await preloadPresenterOutputImage(dark);await Promise.resolve();
     check(root.dataset.outputInk==='white'&&getComputedStyle(root.querySelector('.presenter-liturgical-body-lines')).color===white,'custom dark output/stale source mismatch');
     for(const slide of [{...slides[3],scriptureContext:'reading',elementType:'scripture_text'},{id:'presenter:safety-blank',layout:'blank',type:'blank'}]) {
      applyPresenterOutputFrameState(root,presenterOutputFrameStateForSlide(slide,{chromakey:false,serviceType:'children',backgroundImages:[light]}));
      check(root.dataset.outputInk==='white'&&!root.classList.contains('has-background'),'reading/blackout retained image ink');
     }
     // Only fullscreen community confession receives markers, never chromakey/other copy.
     const caption={...emphasis,outputContext:'chromakey'};
     applyPresenterOutputFrameState(root,presenterOutputFrameStateForSlide(caption,{chromakey:true,serviceType:'sunday-main',backgroundImages:[light]}));root.innerHTML=renderPresenterSlideFrame(caption,{noChromakey:false});
     check([...root.querySelectorAll('.presenter-text-highlight--color')].every(e=>getComputedStyle(e).backgroundImage==='none'),'chromakey acquired markers');
     applyPresenterOutputFrameState(root,frame);root.innerHTML=renderPresenterSlideFrame({...emphasis,title:'다른 문구'},{noChromakey:true});
     check([...root.querySelectorAll('.presenter-text-highlight--color')].every(e=>getComputedStyle(e).backgroundImage==='none'),'other copy acquired confession markers');
     return 'PASS all registered backgrounds x four service types: white/brown text/cross/logo and PNG/WebP parity; custom decode/reset; confession-only markers; chromakey/reading isolation';
    } finally {presenterBackgroundSourcesForService=original;}
   }''')
   print(engine,result,flush=True)
   browser.close()
finally:server.shutdown()
