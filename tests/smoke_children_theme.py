"""Shared children foreground parity; offline frames, no output window/fullscreen."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':900})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof renderPresenterSlideMiniPreview==='function'&&!document.body.classList.contains('ui-booting')")
   result=page.evaluate('''()=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    const service={id:'theme-fixture',type_id:'children',date:'2026-10-25'};
    state.services=[service];state.serviceTypes=[{id:'children',name:'어린이부 예배'}];
    const original=presenterBackgroundSourcesForService;
    const brown='rgb(52, 39, 31)';
    const originalColors=['#FFC832','#C8FF32','#FF96C8','#FF6432','#32C8FF','#9696FF'];
    const markerColors=['rgb(255, 200, 50)','rgb(200, 255, 50)','rgb(255, 150, 200)','rgb(255, 100, 50)','rgb(50, 200, 255)','rgb(150, 150, 255)','rgb(18, 52, 86)'];
    const emphasis={id:'emphasis',type:'liturgical-body',title:'공동체고백',text:'예배자 훈련자 전도자 치유자 화해자 소명자 임의색',layout:'center_text',textHighlights:['예배자','훈련자','전도자','치유자','화해자','소명자','임의색'].map((text,i)=>({text,color:originalColors[i]||'#123456',bold:true}))};
    const slides=[
     emphasis,
     {id:'ready',type:'ready',title:'어린이부 예배',text:'예배 준비',layout:'center_text'},
     {id:'creed',type:'liturgical-body',title:'사도신경',text:'나는 전능하신 하나님을 믿습니다',layout:'center_text'},
     {id:'lyric',type:'lyrics',elementType:'praise',text:'주 은혜임을',layout:'center_text'},
     {id:'notice',type:'title-content',title:'광고',text:'광고',bodyText:'주간 소식',layout:'center_text'},
     {id:'title',type:'title-content',title:'찬양',text:'찬양',bodyText:'다같이',layout:'center_text'},
     {id:'blank',type:'blank',elementType:'blank',layout:'blank',text:''}
    ];
    try {
     presenterBackgroundSourcesForService=()=>['assets/worship-backgrounds/26-C5.png'];
     refs.detailPane.innerHTML='<div id="parity"></div>';
     const host=document.querySelector('#parity');
     for(const slide of slides){
      host.innerHTML=renderPresenterSlideMiniPreview(slide,service.id);
      const mini=host.querySelector('.svc-slide-mini-canvas');
      check((mini.getAttribute('style') || '').includes('.webp'),slide.id+' mini did not use derived WebP');
      const frame=presenterOutputFrameStateForSlide(slide,{chromakey:false,serviceType:'children',backgroundImages:['assets/worship-backgrounds/26-C5.png']});
      const out=document.createElement('main');out.className='presenter-output-root';host.append(out);
      applyPresenterOutputFrameState(out,frame);out.innerHTML=renderPresenterSlideFrame(slide,{noChromakey:true});
      for(const root of [mini,out]) {
       check(getComputedStyle(root).getPropertyValue('--presenter-output-fg').trim()==='#34271f',slide.id+' theme ink mismatch');
       const text=root.querySelector('.presenter-slide-text,.presenter-ready-screen-message');
       if(text)check(getComputedStyle(text).color===brown,slide.id+' text remains white');
       if(slide.id==='emphasis') {
        const colors=[...root.querySelectorAll('.presenter-text-highlight')].map(el=>getComputedStyle(el).color);
        check(colors.every(color=>color===brown),'marker foreground mismatch '+colors);
       }
       const cross=root.querySelector('.presenter-slide--blank');
       if(cross)for(const pseudo of ['::before','::after'])check(getComputedStyle(cross,pseudo).backgroundColor===brown,'cross stroke remains white');
       for(const logo of root.querySelectorAll('.presenter-ready-screen-logo,.presenter-waiting-loop-logo'))check(getComputedStyle(logo).filter.includes('children-autumn-ink.svg'),'logo filter missing');
      }
     }
     const compareMarker=(root,code)=>{
      const marks=[...root.querySelectorAll('.presenter-text-highlight')];
      check(marks.length===7,code+' lost authored highlights');
      return marks.map((el,i)=>{
       const style=getComputedStyle(el);
       check(style.color===brown,code+' marker foreground mismatch');
       check(style.backgroundImage.includes(markerColors[i])&&style.backgroundImage.includes('30%')&&style.backgroundImage.includes('95%'),code+' marker color/coverage mismatch');
       check(style.webkitTextStrokeWidth==='0px',code+' retained outline');
       return [style.color,style.backgroundImage,style.fontWeight];
      });
     };
     for(const code of ['C1','C2','C3','C5','S4','S5','S6','custom']) {
      const source=code==='custom'?'https://example.invalid/custom.webp':'assets/worship-backgrounds/26-'+code+'.png?fixture=1';
      presenterBackgroundSourcesForService=()=>[source];
      host.innerHTML=renderPresenterSlideMiniPreview(emphasis,service.id);
      const mini=host.querySelector('.svc-slide-mini-canvas');
      const frame=presenterOutputFrameStateForSlide(emphasis,{chromakey:false,serviceType:'children',backgroundImages:[source]});
      const out=document.createElement('main');out.className='presenter-output-root';host.append(out);applyPresenterOutputFrameState(out,frame);out.innerHTML=renderPresenterSlideFrame(emphasis,{noChromakey:true});
      check(JSON.stringify(compareMarker(mini,code))===JSON.stringify(compareMarker(out,code)),code+' preview/output marker mismatch');
      applyPresenterOutputFrameState(out,{...frame,showBackground:false});
      const mark=out.querySelector('.presenter-text-highlight');
      check(getComputedStyle(mark).backgroundImage==='none'&&getComputedStyle(mark).color===markerColors[0],'marker leaked after background removal');
     }
     // A different URL must not change the theme; reading/blackout must not inherit it.
     for(const source of ['assets/worship-backgrounds/previews/26-C5.webp','https://example.invalid/custom-art.webp']) {
      const frame=presenterOutputFrameStateForSlide(slides[2],{chromakey:false,serviceType:'children',backgroundImages:[source]});
      const root=document.createElement('main');root.className='presenter-output-root';host.replaceChildren(root);applyPresenterOutputFrameState(root,frame);
      check(getComputedStyle(root).getPropertyValue('--presenter-output-fg').trim()==='#34271f','theme depends on asset name');
     }
     for(const slide of [{...slides[2],scriptureContext:'reading',elementType:'scripture_text'},{id:'presenter:safety-blank',layout:'blank',type:'blank'}]) {
      const frame=presenterOutputFrameStateForSlide(slide,{chromakey:false,serviceType:'children',backgroundImages:['assets/worship-backgrounds/26-C5.png']});
      const root=document.createElement('main');root.className='presenter-output-root';host.replaceChildren(root);applyPresenterOutputFrameState(root,frame);
      check(!frame.showBackground,'reading/blackout acquired service artwork');
      check(getComputedStyle(root).getPropertyValue('--presenter-output-fg').trim()!=='#34271f','reading/blackout acquired brown');
     }
     for(const payload of [{chromakey:true,serviceType:'children'},{chromakey:false,serviceType:'youth'}]) {
      const frame=presenterOutputFrameStateForSlide(slides[2],{...payload,backgroundImages:['assets/worship-backgrounds/26-C5.png']});
      const root=document.createElement('main');root.className='presenter-output-root';host.replaceChildren(root);applyPresenterOutputFrameState(root,frame);
      check(getComputedStyle(root).getPropertyValue('--presenter-output-fg').trim()!=='#34271f','unrelated output inherited children ink');
     }
     for(const payload of [{chromakey:true,serviceType:'children'},{chromakey:false,serviceType:'young-adult'}]) {
      const frame=presenterOutputFrameStateForSlide(emphasis,{...payload,backgroundImages:['assets/worship-backgrounds/26-C5.png']});
      const root=document.createElement('main');root.className='presenter-output-root';host.replaceChildren(root);applyPresenterOutputFrameState(root,frame);root.innerHTML=renderPresenterSlideFrame(emphasis,{noChromakey:!payload.chromakey});
      const mark=root.querySelector('.presenter-text-highlight');
      check(getComputedStyle(mark).color==='rgb(255, 200, 50)'&&getComputedStyle(mark).backgroundImage==='none','marker leaked outside children artwork');
     }
     return 'PASS seven backgrounds/custom: common marker RGB/coverage/weight parity, no outlines, text/cross/logo and reading/chroma isolation';
    } finally {presenterBackgroundSourcesForService=original;}
   }''')
   print(engine,result,flush=True)
   browser.close()
finally:server.shutdown()
