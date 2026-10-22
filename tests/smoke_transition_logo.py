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
                page.wait_for_function("typeof normalizePresenterTransitionLogo === 'function'")
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
                  check(presenterOutputFrameKey({serviceId:'fixture',transitionLogo:config},blank,{blankOutput:true})!==presenterOutputFrameKey({serviceId:'fixture'},blank,{blankOutput:true}),'frame cache ignores artwork');
                  const root=document.createElement('div');root.id='transition-test';root.className='presenter-output-root no-chromakey is-blank';root.style.cssText='position:fixed;inset:0;width:1920px;height:1080px;transform:none;--presenter-stage-unit:1px;z-index:99999';
                  root.innerHTML=renderPresenterSlideFrame(blank,{noChromakey:true,transitionLogo:config});document.body.append(root);
                  const logo=root.querySelector('img');await logo.decode();
                  const animation=logo.getAnimations()[0];check(animation,'animation missing');animation.pause();
                  const samples=[];
                  for(const t of [0,425,850]){animation.currentTime=t;await new Promise(requestAnimationFrame);const box=logo.getBoundingClientRect();samples.push(getComputedStyle(logo).clipPath);check(Math.abs(box.left+box.width*.5-960)<1,'x intersection moved '+JSON.stringify({x:box.left,w:box.width,root:root.getBoundingClientRect().toJSON(),section:logo.parentElement.getBoundingClientRect().toJSON()}));check(Math.abs(box.top+box.height*.295-540)<1,'y intersection moved');}
                  check(samples[0].includes('29.5%'),'reveal does not start at intersection');check(samples[0]!==samples[1] && samples[1]!==samples[2],'reveal did not progress');check(samples[2]==='inset(0%)' || samples[2]==='inset(0px)','reveal not complete: '+samples[2]);
                  check(getComputedStyle(root.querySelector('section'),'::before').display==='none','default cross overlays custom logo');
                  root.classList.add('svc-slide-mini-canvas');await new Promise(requestAnimationFrame);check(getComputedStyle(logo).animationName==='none','thumbnail animation');
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
