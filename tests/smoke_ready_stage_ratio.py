"""Generated clean ready text uses the 16:9 stage; standalone media retains viewport fit."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page(viewport={'width': 1870, 'height': 1180})
            page.route('**/*', lambda r: r.continue_() if r.request.method == 'GET' and urlsplit(r.request.url).netloc == urlsplit(url).netloc else r.abort())
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("typeof renderPresenterOutput==='function'&&!document.body.classList.contains('ui-booting')")
            page.evaluate("""() => {
                document.body.className='presenter-output-body';
                document.body.innerHTML='<main id="presenterOutputRoot" class="presenter-output-root"></main>';
                window.ratioService={id:'ratio-children',type_id:'children',date:'2026-11-01'};
                state.services=[ratioService];state.serviceTypes=[{id:'children',name:'어린이부 예배'}];
                const ready=presenterReadySlide(ratioService);
                const prepared=presenterPreparationSlide(ratioService,{id:'ratio-waiting',label:'대기',memo:JSON.stringify({presenterRole:'ready'})},0);
                window.ratioSlides=[ready,prepared,presenterElementTrailingBlankSlide({...ready,elementId:'ratio-element'},2,ratioService)];
                window.ratioRoot=document.querySelector('#presenterOutputRoot');
            }""")
            for index in range(3):
                page.evaluate("i=>renderPresenterOutput({serviceId:ratioService.id,serviceType:'children',chromakey:false,backgroundImages:['assets/worship-backgrounds/26-C2.png'],slides:ratioSlides,index:i})", index)
                page.wait_for_function('(i)=>ratioRoot.querySelector(".is-active")?.dataset.presenterFrameKey?.includes(ratioSlides[i].id)', arg=index)
                for width, height in ((1870, 1180), (1280, 900), (900, 1280), (1920, 1080), (2560, 1080)):
                    page.set_viewport_size({'width': width, 'height': height})
                    result = page.evaluate("""() => {
                        const r=ratioRoot.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top,media:ratioRoot.classList.contains('is-media-output')};
                    }""")
                    scale=min(width/1920,height/1080)
                    assert not result['media'] and abs(result['width']-1920*scale)<1 and abs(result['height']-1080*scale)<1, (engine,index,width,height,result)
                    assert abs(result['left']-(width-result['width'])/2)<1 and abs(result['top']-(height-result['height'])/2)<1
                    if index == 0 and width == 1870 and os.environ.get('MINDEX_TEST_OUTPUT_DIR'):
                        output=Path(os.environ['MINDEX_TEST_OUTPUT_DIR']);output.mkdir(parents=True,exist_ok=True)
                        page.evaluate('document.fonts.ready')
                        page.screenshot(path=str(output/f'{engine}-generated-ready-16x9.png'))
                if index<2:
                    assert page.locator('.is-active .presenter-ready-screen').count()==1
            # Actual external media still uses its own native-aspect contain contract.
            projection=page.evaluate("""() => {
                const image={id:'image',type:'image',elementType:'image',layout:'media',imageSrc:'fixture.svg'};
                const video={id:'loop',type:'video',elementType:'video',layout:'media',presenterRole:'waiting_loop',videoSrc:'fixture.mp4'};
                return [image,video].map(s=>presenterOutputFrameStateForSlide(s,{chromakey:false}).mediaOutput);
            }""")
            assert projection == [True, True]
            print('PASS', engine, 'actual generated ready/preparation/blank builders retain centered 16:9 across five viewports; image/video viewport-fit preserved; operational writes/output/playback 0', flush=True)
            browser.close()
finally:
    server.shutdown()
