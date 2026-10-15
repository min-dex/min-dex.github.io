"""Source actions retain usable width and panel spacing at narrow sizes."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1200,'height':600})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("typeof renderServiceSourcePanel==='function'")
   page.evaluate('''() => {
    document.body.classList.remove('ui-booting');
    const service={id:'source-layout',type_id:'fixture'};
    state.services=[service];state.serviceItems[service.id]=[];
    document.body.innerHTML='<main id="fixture" style="padding:20px">'+renderServiceSourcePanel(service)+'</main>';
    document.querySelector('details').open=true;
   }''')
   for width in [1200,760,390]:
    page.set_viewport_size({'width':width,'height':600})
    page.evaluate('''() => {
     const actions=document.querySelector('.svc-source-actions');
     const [a,b]=[...actions.children].map(e=>e.getBoundingClientRect());
     if(Math.abs(a.top-b.top)>1||a.right>b.left||a.width<60||b.width<60)throw Error('Action row cramped or wrapped');
     if(getComputedStyle(actions).gap!=='10px')throw Error('Action gap changed');
     if(a.left<actions.getBoundingClientRect().left||b.right>actions.getBoundingClientRect().right+1)throw Error('Actions overflow');
    }''')
   page.screenshot(path='/private/tmp/mindex-source-actions-'+engine+'.png')
   print('PASS',engine,'source actions at 1200/760/390px')
   browser.close()
finally:server.shutdown()
