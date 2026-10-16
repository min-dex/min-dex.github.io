"""Controller sidebar box edges align independently of child-row text padding."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page(viewport={'width':900,'height':700})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url,wait_until='load');page.wait_for_function("typeof renderServiceOutlineChildRow==='function'")
   page.locator('#bootStatus').wait_for(state='hidden')
   page.evaluate('''()=>{
    const service={id:'alignment',type_id:'friday',date:'2026-10-16'};
    const host=document.createElement('div');host.id='alignment';host.style.cssText='width:260px;padding:10px;background:var(--sidebar-bg)';
    host.innerHTML=renderPresenterSidebarServiceSummary(service)+`<div class="service-outline-group"><button class="service-outline-row service-outline-row--section"><span class="service-outline-main"><strong>준비</strong></span><span>1</span></button><div class="service-outline-children">${renderServiceOutlineChildRow(service,{id:'ready',label:'대기 화면',title:'대기 화면'},0,0,[])}</div></div>`;
    document.body.replaceChildren(host);refreshIcons(host);
   }''')
   for theme in ('light','dark'):
    page.evaluate('(t)=>document.body.dataset.theme=t',theme)
    summary=page.locator('.service-sidebar-presenter-context').bounding_box()
    child=page.locator('.service-outline-row--child').bounding_box()
    assert abs(summary['x']-child['x'])<1 and abs(summary['width']-child['width'])<1,(summary,child)
    page.locator('#alignment').screenshot(path=f'/tmp/mindex-alignment-{engine}-{theme}.png')
   print('PASS sidebar box alignment',engine,flush=True);b.close()
finally:server.shutdown()
