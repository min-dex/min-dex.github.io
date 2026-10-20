from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url + '?output=presenter', wait_until='domcontentloaded')
                page.wait_for_function("typeof presenterReadySlide === 'function'")
                print(engine, page.evaluate('''() => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  for(const chromakey of [false,true]) {
                    presenterServiceUsesChromakey=()=>chromakey;
                    const service={id:'ready-fixture',type_id:'fixture'};
                    const ready=presenterReadySlide(service);
                    const closing={id:'closing',elementId:'closing',sectionKey:'closing_visual',type:'image',
                      layout:'media',imageSrc:'closing.png',text:'closing'};
                    const original=JSON.stringify([ready,closing]);
                    const slides=withPresenterElementTrailingBlanks([ready,closing],service);
                    check(slides.length===4,'missing ready/closing blank');
                    check(slides[0]===ready && slides[2]===closing,'original slides changed');
                    for(const blank of [slides[1],slides[3]]) {
                      check(blank.type==='blank' && blank.autoTrailingBlank,'not blank');
                      check(!blank.videoSrc && !blank.imageSrc && !blank.text && !blank.readyServiceName,'payload retained');
                      check(!isPresenterPreparationSlide(blank),'blank treated as ready');
                      check(blank.outputContext===(chromakey?'chromakey':'clean'),'wrong output mode');
                    }
                    check(JSON.stringify([ready,closing])===original,'mutated inputs');
                    check(withPresenterElementTrailingBlanks(slides,service).length===4,'duplicate blanks');
                    check(withPresenterElementTrailingBlanks([ready],service).length===2,'ready-only service');
                  }
                  for (const [name, particle] of [['어린이부 예배','가'],['집중 보기 검증','이'],['모임','이'],['찬양제','가'],['특별 모임) ','이'],['검증'.normalize('NFD'),'이'],['모임 1','이'],['모임 2','가']]) {
                    serviceDisplayTypeName=()=>name;
                    const ready=presenterReadySlide({id:'particle-fixture'});
                    check(ready.text.endsWith(particle+' 시작됩니다'),'ready text particle: '+name);
                    for (const render of [renderPresenterFullscreenReadySlide,renderPresenterGeneratedWaitingLoopSlide]) {
                      const host=document.createElement('div');host.innerHTML=render(ready);
                      check(host.textContent.includes(name.trim()+particle+' 시작됩니다'),'rendered particle: '+name);
                    }
                  }
                  return 'PASS ready screen/video particles, trailing blanks, output modes and input preservation';
                }'''))
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
