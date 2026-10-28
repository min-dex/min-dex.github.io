"""Standalone media contain fit, orientation, resize and session preservation; offline."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image
from media_fit_fixture import deck_bytes
from smoke_app import start_local_app_server, sync_playwright, launch_chromium


server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page(viewport={'width':1280, 'height':900})
            def route(r):
                if urlsplit(r.request.url).netloc != urlsplit(url).netloc:
                    return r.abort()
                name = urlsplit(r.request.url).path
                if name.startswith('/tests/fixtures/media-fit-'):
                    data=(Path(__file__).parent/'fixtures'/name.rsplit('/',1)[1]).read_bytes()
                    headers={'Accept-Ranges':'bytes'};status=200
                    if r.request.headers.get('range'):
                        match=re.fullmatch(r'bytes=(\d+)-(\d*)',r.request.headers['range']);assert match
                        start=int(match[1]);end=min(int(match[2]) if match[2] else len(data)-1,len(data)-1)
                        headers['Content-Range']=f'bytes {start}-{end}/{len(data)}';data=data[start:end+1];status=206
                    headers['Content-Length']=str(len(data))
                    return r.fulfill(status=status,body=data,headers=headers,content_type='video/mp4')
                if '/fit-image-' in name:
                    w,h=map(int,name.rsplit('fit-image-',1)[1].removesuffix('.svg').split('-'))
                    return r.fulfill(body=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><path fill="#14a050" d="M0 0H{w}V{h}H0z"/></svg>',content_type='image/svg+xml')
                if name.endswith('/fit-landscape.pptx') or name.endswith('/fit-portrait.pptx'):
                    w, h = (160,90) if 'landscape' in name else (90,160)
                    return r.fulfill(body=deck_bytes(w,h), content_type='application/octet-stream')
                return r.continue_()
            page.route('**/*', route)
            page.goto(url+'?mindexSmokeRaw=1')
            page.wait_for_function('typeof renderPresenterOutput==="function"&&!document.body.classList.contains("ui-booting")')
            page.evaluate('''()=>{
              document.body.className='presenter-output-body';
              document.body.innerHTML='<main id="presenterOutputRoot" class="presenter-output-root"></main>';
              window.fitRoot=document.querySelector('main');window.assertFit=(ok,msg)=>{if(!ok)throw Error(msg)};
            }''')
            cases = [('image',210,90),('image',90,160),('video',160,90),('video',90,160),('pptx',160,90),('pptx',90,160),('waiting_loop',90,160)]
            for kind,w,h in cases:
                page.evaluate('''({kind,w,h})=>{
                  const orientation=w>h?'landscape':'portrait',id=`${kind}-${orientation}`;
                  let slide={id,layout:'media',type:kind,elementType:kind};
                  if(kind==='image')slide.imageSrc=`/fit-image-${w}-${h}.svg`;
                  else if(kind==='pptx')slide.pptx={url:new URL(`/fit-${orientation}.pptx`,location.href).href,page:0,clicks:0};
                  else slide={...slide,type:'video',elementType:'video',presenterRole:kind==='waiting_loop'?'waiting_loop':'',videoSrc:`/tests/fixtures/media-fit-${orientation}.mp4`,playback:{autoplay:false,muted:true,autoAdvanceOnEnd:false}};
                  window.fitPayload={serviceId:'offline-fit',chromakey:true,index:0,slides:[slide]};renderPresenterOutput(fitPayload);
                }''', {'kind':kind,'w':w,'h':h})
                selector = '.is-active svg' if kind=='pptx' else '.is-active img' if kind=='image' else '.is-active video'
                print('CHECK',engine,kind,w,h,flush=True)
                page.wait_for_function('''()=>{
                  const slide=fitPayload.slides[0],active=fitRoot.querySelector('.is-active');
                  const key=slide.pptx?`${fitPayload.serviceId}|${presenterPptxKey(slide)}`:presenterOutputFrameKey(fitPayload,slide,presenterOutputFrameStateForSlide(slide,fitPayload));
                  return active?.dataset.presenterFrameKey===key;
                }''')
                page.wait_for_selector(selector)
                if kind=='image':
                    page.wait_for_function('fitRoot.querySelector(".is-active img")?.naturalWidth>0')
                elif kind!='pptx':
                    page.wait_for_function('fitRoot.querySelector(".is-active video")?.readyState>=2')
                    page.evaluate('''async()=>{const v=fitRoot.querySelector('.is-active video');await v.play();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));v.pause();window.fitPausedTime=v.currentTime;}''')
                    assert page.eval_on_selector(selector,'v=>[v.videoWidth,v.videoHeight]') == [w,h]
                else:
                    page.wait_for_function('fitRoot.querySelector(".is-active .presenter-pptx-stage")?.dataset.pptxStep==="0"')
                page.evaluate('(selector)=>window.sameFitMedia=fitRoot.querySelector(selector)',selector)
                for vw,vh in [(1280,900),(900,1280),(1920,1080)]:
                    page.set_viewport_size({'width':vw,'height':vh})
                    page.evaluate('''selector=>{
                      assertFit(fitRoot.querySelector(selector)===sameFitMedia,'resize recreated media');
                      const r=fitRoot.getBoundingClientRect();assertFit(Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1,'media retained design-stage bounds');
                      if(sameFitMedia.tagName!=='svg')assertFit(getComputedStyle(sameFitMedia).objectFit==='contain','media crops or stretches');
                      if(sameFitMedia.tagName==='VIDEO')assertFit(sameFitMedia.paused&&Math.abs(sameFitMedia.currentTime-fitPausedTime)<.05,'resize restarted video');
                    }''',selector)
                    image=Image.open(BytesIO(page.screenshot())).convert('RGB')
                    # Encoded video and SVG rasterization can round edge pixels.
                    points=[]
                    for y in range(0,vh,4):
                        for x in range(0,vw,4):
                            r,g,b=image.getpixel((x,y))
                            if r<90 and 110<g<205 and 40<b<130: points.append((x,y))
                    assert points,(engine,kind,'missing decoded content')
                    scale=min(vw/w,vh/h);ew,eh=w*scale,h*scale
                    bounds=(min(x for x,y in points),min(y for x,y in points),max(x for x,y in points)+1,max(y for x,y in points)+1)
                    expected=((vw-ew)/2,(vh-eh)/2,(vw+ew)/2,(vh+eh)/2)
                    assert all(abs(a-b)<6 for a,b in zip(bounds,expected)),(engine,kind,[vw,vh],bounds,expected)
            page.evaluate('''()=>{
              renderPresenterOutput({serviceId:'offline-fit',slides:[{id:'text',type:'title',elementType:'title',layout:'center_text',text:'Text'}],index:0,chromakey:false});
              assertFit(!fitRoot.classList.contains('is-media-output'),'media layout leaked into text');
              const r=fitRoot.getBoundingClientRect();assertFit(Math.abs(r.width/r.height-16/9)<.001,'text stage changed');
            }''')
            print('PASS',engine,'landscape/portrait image, decoded video, live PPTX, waiting video; maximal contain pixels, resize identity, text-stage restoration',flush=True)
            browser.close()
finally:
    server.shutdown()
