"""Large boards prioritize visible fits, yield to input, and keep exact text fitting."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':800})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("typeof fitPresenterPreviewText==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('document.fonts.ready')
   page.evaluate('''() => {
    state.module='presenter'; document.body.dataset.module='presenter';
    const service={id:'budget-fixture',type_id:'young-adult'};state.services=[service];
    refs.detailPane.style.cssText='position:fixed;inset:60px auto 0 0;width:800px;overflow:auto';
    refs.detailPane.innerHTML='<div class="svc-presenter-board-column"><div class="svc-slide-board"><div class="svc-board-section"><div class="svc-board-subgroups"><div class="svc-board-subgroup">'+Array.from({length:180},(_,i)=>
      `<div class="svc-slide-thumb" data-fit-index="${i}" style="position:relative;width:300px;height:169px"><div class="svc-slide-thumb-frame" style="--presenter-preview-scale:.15625">${renderPresenterSlideMiniPreview({id:'fit-'+i,type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:i+' 아주 긴 가사도 끝까지 보여야 합니다 '.repeat(5)+'\\n둘째 줄도 온전히 보여야 합니다'},service.id)}</div></div>`).join('')+'</div></div></div></div></div>';
    refs.detailPane.scrollTop=refs.detailPane.scrollHeight;
    window.fitOrder=[];window.gaps=[];window.lastTick=performance.now();
    window.tick=setInterval(()=>{const now=performance.now();gaps.push(now-lastTick);lastTick=now},20);
    const original=fitPresenterPreviewCanvas;
    fitPresenterPreviewCanvas=preview=>{fitOrder.push(Number(preview.closest('[data-fit-index]')?.dataset.fitIndex));return original(preview)};
    fitPresenterPreviewText(refs.detailPane);
    if(fitOrder.length)throw Error('board fit blocked caller');
   }''')
   page.wait_for_function('fitOrder.length>0')
   assert page.evaluate('fitOrder[0]')>=175, 'visible end of board must precede offscreen start'
   page.wait_for_function('!presenterThumbnailFitRaf')
   assert page.evaluate('presenterThumbnailFitQueue.size')>150, 'offscreen work should sleep'
   for index in range(0,180,4):
    page.evaluate("i=>{refs.detailPane.scrollTop=refs.detailPane.querySelector('[data-fit-index=\"'+i+'\"]').offsetTop}",index)
    page.wait_for_function("i=>fitOrder.includes(i)&&!presenterThumbnailFitRaf",arg=index)
   page.wait_for_function('presenterThumbnailFitQueue.size===0',timeout=30000)
   result=page.evaluate('''() => {
    clearInterval(tick);
    const boxes=[...refs.detailPane.querySelectorAll('.presenter-slide-text')];
    let clipped=0,mismatches=0;
    for(const box of boxes){
      const before=box.style.fontSize;
      fitPresenterLyricText(box.parentElement);
      if(before!==box.style.fontSize)mismatches++;
      const bounds=box.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(box);
      if([...range.getClientRects()].some(r=>r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1))clipped++;
    }
    return {fitted:fitOrder.length,clipped,mismatches,maxGap:Math.max(...gaps)};
   }''')
   assert result['clipped']==0 and result['mismatches']==0,result
   assert result['maxGap']<500,result
   # Font invalidation must enqueue rather than reintroduce an all-board task.
   page.evaluate("fitOrder=[];document.fonts.dispatchEvent(new Event('loadingdone'))")
   page.wait_for_function('fitOrder.length>0')
   assert page.evaluate('fitOrder[0]')>=175
   page.evaluate("refs.detailPane.replaceChildren();fitPresenterPreviewText(refs.detailPane)")
   page.wait_for_function('presenterThumbnailFitQueue.size===0')
   print('PASS',engine,result,'font invalidation and detached cleanup',flush=True)
   browser.close()
finally:server.shutdown()
