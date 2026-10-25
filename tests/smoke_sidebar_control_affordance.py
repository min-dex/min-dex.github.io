"""Offline real sidebar controls; never opens a presenter window."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':900,'height':600})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof renderPresenterSidebarServiceSummary==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    state.module='praise';state.praiseFilter='review';state.songs=[];
    renderListFilter();
    const host=document.createElement('main');host.id='controlFixture';host.style.cssText='width:260px;padding:10px;box-sizing:border-box;background:var(--sidebar-bg)';
    host.append(refs.listFilter);
    const service={id:'isolated-sidebar',type_id:'fixture',title:'주일예배 [3부]',date:'2026-10-25'};
    window.sidebarFixtureService=service;isPresenterOutputWindowOpen=()=>false;
    host.insertAdjacentHTML('beforeend',renderPresenterSidebarServiceSummary(service));
    document.body.replaceChildren(host);refreshIcons();
   }''')
   for theme in ('light','dark'):
    page.evaluate('(t)=>document.body.dataset.theme=t',theme)
    for module in ('praise','scripture'):
     page.evaluate('(m)=>{state.module=m;renderListFilter()}',module)
     buttons=page.locator('.filter-tab:visible')
     assert buttons.count()==(6 if module=='praise' else 4)
     for i in range(buttons.count()):
      button=buttons.nth(i)
      button.focus()
      assert button.evaluate("e=>getComputedStyle(e).outlineStyle")!='none'
      assert button.evaluate("e=>parseFloat(getComputedStyle(e).paddingLeft)")>=5
      assert button.evaluate("e=>getComputedStyle(e).borderTopStyle")=='solid'
      assert button.evaluate("e=>getComputedStyle(e).backgroundColor")!='rgba(0, 0, 0, 0)'
      assert button.evaluate("e=>e.scrollWidth<=e.clientWidth+1")
     b=buttons.nth(1);page.mouse.move(800,500);page.wait_for_timeout(180)
     before=b.evaluate('e=>getComputedStyle(e).backgroundColor');b.hover();page.wait_for_timeout(180)
     assert b.evaluate('e=>getComputedStyle(e).backgroundColor')!=before
     page.screenshot(path=f'/tmp/mindex-sidebar-{engine}-{theme}-{module}.png')
   page.evaluate("state.module='praise';renderListFilter()")
   button=page.locator('[data-list-filter=all]');button.focus();button.press('Enter')
   assert page.evaluate('state.praiseFilter')=='all'
   button=page.locator('[data-list-filter=review]:visible');button.focus();button.press('Space')
   assert page.evaluate('state.praiseFilter')=='review'
   page.evaluate('''()=>{
    const root=document.querySelector('.service-sidebar-presenter-context');
    const button=root.querySelector('button');
    if(button.dataset.presenterAction!=='open'||!button.getAttribute('aria-label').includes('송출'))throw Error('start action/label');
    if(button.getBoundingClientRect().right>root.getBoundingClientRect().right)throw Error('card overflow');
    if(button.textContent.trim())throw Error('visible launch text remains');
    const copy=root.querySelector('.service-sidebar-presenter-meta');
    const children=[...copy.children];
    if(!children[0].matches('strong')||!children[1].matches('.service-sidebar-presenter-date')||!children[2].matches('.service-date-status'))throw Error('text order');
    const rect=copy.getBoundingClientRect(),btn=button.getBoundingClientRect();
    if(Math.abs(rect.top-btn.top)>1)throw Error('button not aligned to top');
    if(children.some((e,i)=>i&&e.getBoundingClientRect().top<children[i-1].getBoundingClientRect().bottom))throw Error('text not stacked');
    isPresenterOutputWindowOpen=()=>true;
    const html=renderPresenterSidebarServiceSummary(sidebarFixtureService);
    if(!html.includes('data-presenter-action="stop"')||!html.includes('is-stop'))throw Error('stop changed');
   }''')
   page.evaluate("""()=>{
    MindexRemote.codeFor=id=>id===sidebarFixtureService.id?'1234':'';
    document.querySelector('.service-sidebar-presenter-context').outerHTML=renderPresenterSidebarServiceSummary(sidebarFixtureService);
    refreshIcons();
   }""")
   code=page.locator('.service-sidebar-remote-code');assert code.is_visible()
   code.focus();assert code.evaluate("e=>getComputedStyle(e).outlineStyle")!='none'
   page.evaluate("""()=>{
    const card=document.querySelector('.service-sidebar-presenter-context');
    const code=card.querySelector('.service-sidebar-remote-code').getBoundingClientRect();
    const launch=card.querySelector('[data-presenter-action]').getBoundingClientRect();
    if(code.top<launch.bottom||Math.abs(code.right-launch.right)>2)throw Error('code not bottom right');
   }""")
   page.screenshot(path=f'/tmp/mindex-remote-card-{engine}.png')
   print(engine,'PASS visible filters, hover/focus, original grouping, Enter/Space, sidebar start/stop labels without opening output',flush=True)
   browser.close()
finally:server.shutdown()
