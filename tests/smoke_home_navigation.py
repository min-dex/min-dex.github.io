"""Offline home navigation, scroll reset and empty-day current-date cue."""
from smoke_app import launch_chromium,start_local_app_server,sync_playwright

server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1000,'height':600})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("typeof goHome==='function' && typeof renderServiceDashboard==='function'")
   page.evaluate('''async()=>{
    state.serviceTypes=[{id:'young-adult',name:'청년부 예배'}];state.services=[];
    state.serviceError='';state.connectionError='';
    document.body.classList.remove('ui-booting');
    await goHome();
   }''')
   page.locator('#detailPane [data-service-list]').click()
   assert page.evaluate("state.selectedServiceTypeId===SERVICE_LIST_PANEL_ID"),'home all-services button did not navigate'
   page.evaluate('goHome()')
   for width in [1440,1000,390,320]:
    page.set_viewport_size({'width':width,'height':600})
    page.evaluate('''()=>{
     document.body.classList.add('sidebar-collapsed');syncSidebarCollapsedState();
     refs.detailPane.scrollTop=300;
    }''')
    page.evaluate('goHome()');page.wait_for_timeout(100)
    result=page.evaluate('''()=>({scroll:refs.detailPane.scrollTop,
     overflow:document.documentElement.scrollWidth>innerWidth,
     paneOverflow:refs.detailPane.scrollWidth>refs.detailPane.clientWidth+1,
     weeks:document.querySelectorAll('.service-week-board').length,
     days:document.querySelectorAll('.service-week-day').length})''')
    assert result['scroll']==0 and not result['overflow'] and not result['paneOverflow'],(engine,width,result)
    assert result['weeks']==2 and result['days']==14,result
   result=page.evaluate('''()=>{
    const host=document.createElement('div');host.innerHTML=renderServiceWeekDay(new Date(),[]);document.body.append(host);
    const today=host.firstElementChild;
    return {current:today.getAttribute('aria-current'),label:today.innerText,bg:getComputedStyle(today).backgroundColor};
   }''')
   assert result['current']=='date' and '오늘' in result['label'] and result['bg'] not in ['transparent','rgba(0, 0, 0, 0)'],result
   print('PASS home list navigation, reset scroll, 14 days, current empty day, responsive layout',engine,flush=True)
   page.screenshot(path='/tmp/mindex-home-checked.png')
   browser.close()
finally:server.shutdown()
