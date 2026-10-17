"""Offline real composer + shared button states; never invokes a save/output action."""
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from urllib.parse import urlsplit
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page(viewport={'width':900,'height':650})
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterCitationComposer==='function' && !document.body.classList.contains('ui-booting')")
    page.evaluate('''()=>{document.body.innerHTML='<main style="padding:20px"><section id="panel" style="width:260px;background:var(--panel);padding:10px 0">'+renderPresenterCitationComposer({slides:[{slide:{liveScriptureControl:true,elementId:'fixture'}}]},'offline')+'</section><section id="buttons" style="display:flex;flex-wrap:wrap;gap:10px;padding:20px;background:var(--panel);margin-top:20px">'+['btn','btn secondary','btn primary','btn danger','reference-new-btn','reference-new-btn secondary','svc-output-action'].map(c=>'<button class="'+c+'">긴 이름 저장</button>').join('')+'<button class="btn" disabled>사용 불가</button></section></main>';refreshIcons()}''')
    for theme in ['light','dark']:
     page.evaluate('(v)=>document.body.dataset.theme=v',theme)
     for width in [260,320,420]:
      page.locator('#panel').evaluate('(e,w)=>e.style.width=w+"px"',width)
      report=page.evaluate('''()=>{
       const box=document.querySelector('.svc-citation-composer'),h=box.querySelector('.svc-citation-composer-heading'),i=box.querySelector('input[type=text]'),c=box.querySelector('label');
       const b=box.getBoundingClientRect(),r=h.getBoundingClientRect(),v=i.getBoundingClientRect();
       if(r.height!==20||v.height!==35||Math.abs(r.top-b.top-11)>1||Math.abs(v.top-r.bottom-10)>1)throw Error('composer rhythm');
       if(c.getBoundingClientRect().left<h.firstElementChild.getBoundingClientRect().right)throw Error('heading collision');
       return {heading:r.height,input:v.height,top:r.top-b.top,gap:v.top-r.bottom};
      }''')
      print(engine,theme,width,report,flush=True)
     for button in page.locator('#buttons button:not(:disabled)').all():
      page.mouse.move(1,1);page.wait_for_timeout(180)
      before=button.evaluate('(e)=>{let s=getComputedStyle(e);return [s.backgroundColor,s.color,s.boxShadow]}')
      button.hover();page.wait_for_timeout(180)
      after=button.evaluate('(e)=>{let s=getComputedStyle(e);return [s.backgroundColor,s.color,s.boxShadow]}')
      contrast=button.evaluate("""e=>{
       const rgb=s=>s.match(/[\d.]+/g).map(Number),lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
       let node=e,bg;while(node){bg=rgb(getComputedStyle(node).backgroundColor);if(bg.length===3||bg[3]===1)break;node=node.parentElement}
       const a=lum(rgb(getComputedStyle(e).color)),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      }""")
      assert contrast>=4.5,(theme,button.get_attribute('class'),contrast)
      assert before!=after,(engine,theme,button.get_attribute('class'),'no hover feedback')
      assert button.evaluate('(e)=>parseFloat(getComputedStyle(e).paddingLeft)>=10')
      button.focus();assert button.evaluate('(e)=>getComputedStyle(e).outlineStyle')!='none'
     page.screenshot(path=f'/tmp/mindex-control-{engine}-{theme}.png')
    print(engine,'PASS hover, padding, focus, composer grid',flush=True)
   finally:browser.close()
finally:server.shutdown();server.server_close()
