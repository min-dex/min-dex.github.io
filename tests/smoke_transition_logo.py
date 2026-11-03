"""Offline logo origin/reveal contract; never opens native output/fullscreen."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ("chromium", "webkit"):
                browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
                page = browser.new_page(viewport={"width": 1920, "height": 1080})
                page.route("**/*supabase*/**", lambda route: route.abort())
                page.goto(url + "?output=presenter", wait_until="domcontentloaded")
                page.wait_for_function("typeof normalizePresenterTransitionLogo === 'function' && typeof WORSHIP_BACKGROUND_BASE === 'string'")
                result = page.evaluate("""async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const config={url:'assets/transition-logos/on-fire.svg',originX:50,originY:29.5,width:255,height:450};
                  const blank={id:'blank-test',type:'blank',elementType:'blank',layout:'blank'};
                  check(normalizePresenterTransitionLogo({url:'javascript:alert(1)'})===null,'unsafe URL');
                  check(normalizePresenterTransitionLogo({url:'data:image/svg+xml,bad'})===null,'inline URL');
                  check(normalizePresenterTransitionLogo({url:'assets/video.mp4'})===null,'non-image URL');
                  const bounded=normalizePresenterTransitionLogo({...config,originY:500,width:-2});
                  check(bounded.originY===100 && bounded.width===32,'bounded geometry');
                  const payload=normalizePresenterPayload({serviceId:'fixture',transitionLogo:config,slides:[blank]});
                  check(payload.transitionLogo.originY===29.5,'payload dropped origin');
                  check(!renderPresenterSlideFrame(blank,{noChromakey:false,transitionLogo:config}).includes('presenter-transition-logo'),'chromakey changed');
                  check(!renderPresenterSlideFrame({...blank,id:'presenter:safety-blank'},{noChromakey:true,transitionLogo:config}).includes('presenter-transition-logo'),'safety blackout changed');
                  check(!renderPresenterSlideFrame(blank,{noChromakey:true}).includes('presenter-transition-logo'),'default changed');
                  check(!renderPresenterSlideFrame({...blank,formBackgroundImage:'photo.png'},{noChromakey:true,transitionLogo:config}).includes('presenter-transition-logo'),'photo-only blank changed');
                  check(presenterOutputFrameKey({serviceId:'fixture',transitionLogo:config},blank,{blankOutput:true})!==presenterOutputFrameKey({serviceId:'fixture'},blank,{blankOutput:true}),'frame cache ignores artwork');
                  const root=document.createElement('div');root.id='transition-test';root.className='presenter-output-root no-chromakey is-blank';root.style.cssText='position:fixed;inset:0;width:1920px;height:1080px;transform:none;--presenter-stage-unit:1px;z-index:99999';
                  root.innerHTML=renderPresenterSlideFrame(blank,{noChromakey:true,transitionLogo:config});document.body.append(root);
                  const logo=root.querySelector('img');await logo.decode();
                  const animation=logo.getAnimations()[0];check(animation,'animation missing');animation.pause();
                  const samples=[];
                  for(const t of [0,425,850]){
                    animation.currentTime=t;await new Promise(requestAnimationFrame);
                    const box=logo.getBoundingClientRect(),css=getComputedStyle(logo),matrix=new DOMMatrixReadOnly(css.transform);
                    samples.push(matrix.a);
                    check(css.clipPath==='none','rectangle mask still clips pointed tips');
                    check(Math.abs(matrix.a-matrix.d)<.001,'silhouette proportions distorted');
                    check(Math.abs(box.left+box.width*.5-960)<1,'x intersection moved');
                    check(Math.abs(box.top+box.height*.295-447.75)<1,'reveal intersection moved');
                    if(t===850)check(Math.abs(box.top+box.height*.5-540)<1,'complete artwork not centered');
                  }
                  check(samples[0]===0 && samples[1]>0 && samples[1]<1 && samples[2]===1,'pointed silhouette did not grow from intersection');
                  check(getComputedStyle(root.querySelector('section'),'::before').display==='none','default cross overlays custom logo');
                  root.classList.add('svc-slide-mini-canvas');await new Promise(requestAnimationFrame);check(getComputedStyle(logo).animationName==='none','thumbnail animation');
                  const union={serviceId:'99df9e1b-1716-41fb-9ea0-f5ca4c99ee45',chromakey:false,transitionLogo:config,presentationDesign:{sectionKeys:['sermon'],logo:config.url,background:'#ffffff',accent:'#ad371d'}};
                  const options={...union,noChromakey:true};
                  const title={id:'sermon',elementId:'sermon',type:'title-content',elementType:'title_content',layout:'center-text',sectionKey:'sermon',title:'설교',text:'설교'};
                  const serviceBlank=presenterElementTrailingBlankSlide(title,0,{id:union.serviceId});
                  const praiseBlank=presenterElementTrailingBlankSlide({...title,sectionKey:'praise',elementType:'praise'},1,{id:union.serviceId});
                  check(praiseBlank.praiseTransitionBlank&&!serviceBlank.praiseTransitionBlank,'trailing blank context lost');
                  const normalized=normalizeServiceDocumentSlides([praiseBlank])[0];
                  check(serviceDocumentSlideToPresenterSlide(normalized,0,{id:union.serviceId}).praiseTransitionBlank,'document blank context lost');
                  check(presenterUnionBlankKind(serviceBlank,options)==='service'&&presenterUnionBlankKind(praiseBlank,options)==='praise','blank kind');
                  check(!presenterUnionBlankKind(serviceBlank,{...options,noChromakey:false})&&!presenterUnionBlankKind(serviceBlank,{...options,emergencyMode:true}),'key/emergency blank theme leak');
                  const stage=document.createElement('div');stage.className='presenter-output-root no-chromakey';stage.style.cssText='position:fixed;inset:0;width:1920px;height:1080px;transform:none;--presenter-stage-unit:1px';document.body.append(stage);
                  stage.innerHTML='<div class="presenter-output-layer is-active">'+renderPresenterSlideFrame(title,options)+'</div><div class="presenter-output-layer is-next">'+renderPresenterSlideFrame(serviceBlank,options)+'</div>';
                  await Promise.all([...stage.querySelectorAll('img')].map(image=>image.decode()));
                  const [oldLayer,newLayer]=stage.children;
                  const whiteBlank=newLayer.querySelector('section'),cross=newLayer.querySelector('img');
                  check(getComputedStyle(whiteBlank).backgroundColor==='rgb(255, 255, 255)'&&getComputedStyle(cross).filter==='none','service blank not white/red');
                  check(!whiteBlank.textContent.trim(),'service blank contains text');
                  const beforeCross=oldLayer.querySelector('img').getBoundingClientRect(),afterCross=cross.getBoundingClientRect();
                  activatePresenterOutputLayer(stage,oldLayer,newLayer,presenterOutputFrameStateForSlide(serviceBlank,union));
                  const moving=stage.querySelector('.presenter-service-cross-morph');check(moving,'blank-only cross morph did not start');
                  const morph=moving.getAnimations()[0];morph.pause();
                  for(const t of [0,425,850]) {morph.currentTime=t;await new Promise(requestAnimationFrame);const box=moving.getBoundingClientRect();
                    if(t===0)check(Math.abs(box.width-beforeCross.width)<1,'cross morph start');
                    if(t===425)check(box.width>beforeCross.width&&box.width<afterCross.width,'cross morph midpoint');
                    if(t===850)check(Math.abs(box.width-afterCross.width)<1&&Math.abs(box.top-afterCross.top)<1,'cross morph end');}
                  morph.finish();await new Promise(requestAnimationFrame);check(!stage.querySelector('.presenter-service-cross-morph')&&cross.style.visibility==='','cross morph cleanup');
                  const backLayer=oldLayer;backLayer.innerHTML=renderPresenterSlideFrame(title,options);
                  activatePresenterOutputLayer(stage,newLayer,backLayer,presenterOutputFrameStateForSlide(title,union));
                  check(stage.querySelector('.presenter-service-cross-morph'),'reverse blank cross morph missing');stage._cancelServiceCrossMorph();
                  stage.innerHTML=renderPresenterSlideFrame(praiseBlank,options);check(getComputedStyle(stage.querySelector('section')).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(stage.querySelector('img')).filter==='brightness(0) invert(1)','praise blank not black/white');
                  check(!preparePresenterServiceBlankCrossMorph(stage,stage,stage),'praise blank acquired service morph');
                  const withVideo={...praiseBlank,autoTrailingBlank:false,songInstrumental:true,backgroundVideo:'tests/fixtures/praise-background.webm'};
                  check(!presenterUnionBlankKind(withVideo,options),'instrumental video replaced by cross');
                  stage.remove();
                  return 'PASS payload, origin, reveal progress, cache, chromakey, safety, default and thumbnails';
                }""")
                page.emulate_media(reduced_motion="reduce")
                assert page.evaluate("getComputedStyle(document.querySelector('#transition-test img')).animationName") == "none"
                print(engine, result)
                browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
