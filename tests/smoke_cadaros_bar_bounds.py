import argparse,json
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
server,url=(None,args.url) if args.url else start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.route('**/*',lambda r:r.continue_() if r.request.method in ('GET','HEAD','OPTIONS') and '.supabase.co/' not in r.request.url else r.abort())
   page.goto(url+'?output=presenter',wait_until='domcontentloaded')
   page.wait_for_function("typeof renderPresenterOutput==='function' && document.getElementById('presenterOutputRoot')")
   results=[]
   for w,h in [(1920,1080),(1366,768),(960,540),(900,900),(406,228),(320,180)]:
    page.set_viewport_size({'width':w,'height':h})
    page.evaluate('''()=>renderPresenterOutput({serviceId:'qa-memory-only',chromakey:true,slides:[{id:'qa',type:'lyrics',elementType:'praise',layout:'lower_bar_text',captionTheme:'cadaros',text:'우리에게 주신 사랑을 기억하며 찬양합니다\\n온 마음 다하여 주의 이름을 높여 드립니다',outputContext:'chromakey'}],index:0},{})''')
    page.evaluate('''async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}''')
    result=page.evaluate('''()=>{
     const el=document.querySelector('.is-active .presenter-slide'),box=el.querySelector('.presenter-slide-text'),stage=el.getBoundingClientRect();
     const bar=getComputedStyle(el,'::before'),barHeight=parseFloat(bar.height),top=stage.bottom-barHeight;
     const crestEnd=top+parseFloat(bar.backgroundPositionY.split(',')[0])+parseFloat(bar.backgroundSize.split(',')[0].trim().split(' ')[1]);
     const range=document.createRange();range.selectNodeContents(box);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
     return {ratio:getComputedStyle(el).getPropertyValue('--presenter-output-bar-height').trim(),crestInside:crestEnd<=stage.bottom,minCrestGap:Math.min(...rects.map(r=>r.top-crestEnd)),bottomGap:stage.bottom-Math.max(...rects.map(r=>r.bottom)),inside:rects.every(r=>r.left>=stage.left-1&&r.right<=stage.right+1&&r.top>=top-1&&r.bottom<=stage.bottom+1)};
    }''')
    assert result['ratio']=='20%' and result['crestInside'] and result['inside'] and result['minCrestGap']>=0,(engine,w,h,result)
    results.append({'size':[w,h],**result})
    if w==960:page.screenshot(path=f'/tmp/mindex-cadaros-20-{engine}.png')
   print(engine,json.dumps(results),flush=True);browser.close()
finally:
 if server:server.shutdown()
