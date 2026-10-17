"""Toolbar launcher and anchored native popover; isolated fixture, no DB writes."""
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page(viewport={'width':1440,'height':900});page.goto(url);page.wait_for_function("!document.body.classList.contains('ui-booting')")
   page.evaluate("state.module='presenter';document.body.dataset.module='presenter';renderGlobalPlaybackControls();applyTheme('dark')")
   trigger=page.locator('.global-playback-trigger');trigger.click()
   for width in (1440,1000,760,1440):
    page.set_viewport_size({'width':width,'height':900})
    page.wait_for_function('''()=>{const t=document.querySelector('.global-playback-trigger').getBoundingClientRect(),p=document.querySelector('#globalPlaybackPanel').getBoundingClientRect();return Math.abs(p.x-Math.max(8,Math.min(t.x,innerWidth-p.width-8)))<2 && Math.abs(p.y-t.bottom-8)<2}''')
    result=page.evaluate('''()=>{
     const t=document.querySelector('.global-playback-trigger').getBoundingClientRect(),p=document.querySelector('#globalPlaybackPanel').getBoundingClientRect(),n=document.querySelector('#themeBtn').getBoundingClientRect();
     if(Math.abs(t.y+t.height/2-n.y-n.height/2)>1)throw Error('button alignment');
     if(Math.abs(n.x-t.right-4)>1)throw Error('button spacing '+(n.x-t.right));
     if(p.right>innerWidth-7 || p.left<7 || p.width>321 || t.left<0 || t.right>innerWidth)throw Error('viewport overflow '+JSON.stringify({t:t.toJSON(),p:p.toJSON(),width:innerWidth}));
     if(document.querySelector('#globalPlaybackPanel').scrollWidth>p.width)throw Error('panel content overflow');
     return {width:innerWidth,buttonX:t.x,panelX:p.x,panelWidth:p.width};
    }''');print(engine,result)
    page.screenshot(path=f'/tmp/mindex-playback-layout-{engine}-{width}.png')
   page.evaluate("applyTheme('light')")
   page.screenshot(path=f'/tmp/mindex-playback-layout-{engine}-light.png')
   page.evaluate("state.services=[{id:'qa',title:'검증 예배'}];state.presenter.serviceId='qa';isPresenterOutputWindowOpen=()=>true;renderGlobalPlaybackControls()")
   assert page.locator('#globalPlaybackPanel').evaluate("e=>e.matches(':popover-open')")
   page.keyboard.press('Escape');assert trigger.evaluate('e=>e===document.activeElement')
   assert not page.locator('#globalPlaybackPanel').evaluate("e=>e.matches(':popover-open')")
   trigger.click();page.locator('[aria-label="송출·음악 제어 닫기"]').click()
   assert not page.locator('#globalPlaybackPanel').evaluate("e=>e.matches(':popover-open')")
   b.close()
finally:server.shutdown()
