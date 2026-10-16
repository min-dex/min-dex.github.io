"""Reading text keeps output typography in transformed thumbnails and previews."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1920,'height':1080})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?output=presenter')
   page.wait_for_function("typeof renderPresenterSlideMiniPreview==='function'")
   for final in (False,True):
    for repeats in (1,5):
     result=page.evaluate('''async ({final,repeats})=>{
      const slide={id:'scale-test',elementType:PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,type:'scripture',scriptureContext:'reading',referenceBook:'예레미야',referenceRange:'36:1',scriptureVerse:1,title:'예레미야 36:1',translationLabel:'개역개정',scriptureReadingFinal:final,text:('화면 검증을 위한 본문입니다 어절이 끊기지 않고 읽을 수 있는 크기를 유지해야 합니다 ').repeat(repeats)};
      renderPresenterOutput({serviceId:'scale-test',serviceType:'friday-prayer',chromakey:false,slides:[slide],index:0,safetyBlank:false},{});
      const mount=document.createElement('div');mount.style.cssText='position:fixed;left:0;top:0;width:240px;height:135px';mount.innerHTML=renderPresenterSlideMiniPreview(slide);document.body.append(mount);applyPresenterPreviewScales(mount);
      await document.fonts.ready;await new Promise(r=>setTimeout(r,600));
      const measure=root=>{const text=root.querySelector('.presenter-scripture-reading-text'),box=text.closest('.presenter-scripture-reading'),b=box.getBoundingClientRect(),t=text.getBoundingClientRect();return {size:parseFloat(getComputedStyle(text).fontSize),height:t.height,width:t.width,inside:t.bottom<=b.bottom+1&&text.scrollWidth<=text.clientWidth+1};};
      const output=measure(document.getElementById('presenterOutputRoot')),mini=measure(mount);
      mount.remove();return {output,mini};
     }''',{'final':final,'repeats':repeats})
     assert result['output']['inside'] and result['mini']['inside'],result
     assert abs(result['output']['size']-result['mini']['size'])<1,result
     assert result['mini']['size']>25,result
     print('PASS',engine,final,repeats,result,flush=True)
   page.screenshot(path='/tmp/mindex-reading-scale-'+engine+'.png')
   browser.close()
finally:server.shutdown()
