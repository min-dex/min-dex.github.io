"""Built-in preview derivatives never leak into output or uploaded media sources."""
import argparse
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
server,url=(None,args.url) if args.url else start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':800})
   page.add_init_script("Object.defineProperty(window,'MINDEX_SUPABASE',{get:()=>({}),set:()=>{}})")
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?output=presenter',wait_until='domcontentloaded')
   page.wait_for_function("typeof presenterPreviewBackgroundSource==='function'")
   result=page.evaluate('''async()=>{
    const originals=[...WORSHIP_BACKGROUND_STATIC_FILES].map(n=>new URL('assets/worship-backgrounds/'+n,document.baseURI).href);
    for(const source of originals){
     const mapped=presenterPreviewBackgroundSource(source+'?v=check');
     if(!mapped.endsWith('/previews/'+source.split('/').pop().replace('.png','.webp')+'?v=check'))throw Error(mapped);
     const image=new Image();image.src=mapped;await image.decode();
     if(image.naturalWidth!==1280)throw Error('wrong preview size');
    }
    const untouched=['https://example.test/assets/worship-backgrounds/26-A1.png',
      new URL('uploads/26-A1.png',document.baseURI).href,'data:image/png;base64,AA==',
      'blob:https://example.test/123','assets/worship-backgrounds/future.png','assets/worship-backgrounds/scripture-reading-cross.png'];
    if(untouched.some(source=>presenterPreviewBackgroundSource(source)!==source))throw Error('custom source rewritten');
    const service={id:'preview-fixture',type_id:'young-adult'};state.services=[service];
    const slide={id:'lyrics',type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:'긴 가사도 온전히 표시합니다 '.repeat(10),formBackgroundImage:originals[0]};
    const before=JSON.stringify(slide);
    const host=document.createElement('div');host.className='svc-presenter-live-preview';
    host.style.cssText='position:fixed;left:0;top:0;width:406px;height:228.375px';
    host.innerHTML=renderPresenterSlideMiniPreview(slide,service.id);document.body.append(host);
    applyPresenterPreviewScales(host);await document.fonts.ready;fitPresenterPreviewText(host);
    const canvas=host.querySelector('.svc-slide-mini-canvas'),box=host.querySelector('.presenter-slide-text');
    if(canvas.offsetWidth!==1920||canvas.offsetHeight!==1080)throw Error('text stage changed');
    if(!getComputedStyle(canvas).backgroundImage.includes('/previews/26-A1.webp'))throw Error('preview original still active');
    const bounds=box.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(box);
    if([...range.getClientRects()].some(r=>r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1))throw Error('clipped preview');
    const payload={serviceId:service.id,serviceType:service.type_id,chromakey:false,backgroundImages:originals.slice(0,1),slides:[slide],index:0};
    const frame=presenterOutputFrameStateForSlide(slide,payload);
    if(frame.backgroundImages[0]!==originals[0]||presenterOutputFrameBackgroundStyle(frame).includes('/previews/'))throw Error('output original changed');
    renderPresenterOutput(payload);
    if(JSON.stringify(slide)!==before)throw Error('slide mutated');
    host.remove();return {assets:originals.length,customSources:untouched.length};
   }''')
   page.wait_for_function("document.querySelector('#presenterOutputRoot .presenter-output-background img')?.naturalWidth>1280")
   assert page.evaluate("!document.querySelector('#presenterOutputRoot .presenter-output-background img').src.includes('/previews/')")
   print('PASS preview assets, custom sources, text bounds and full-resolution actual output',engine,result,flush=True)
   browser.close()
finally:
 if server:server.shutdown()
