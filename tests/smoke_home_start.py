"""Offline root navigation, shared verse wrapping and explicit detail destinations."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':800})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof handleNavigationRailClick==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    state.client={};state.connectionError='';state.serviceError='';state.serviceTypes=[{id:'sunday-main',name:'주일예배 [3부]'}];state.services=[];
    state.scriptures=[{id:'fixture',title:'Fixture',text:'Original'}];state.scripturesLoaded=true;state.scriptureBooks=[{code:'GEN',koreanName:'창세기',englishName:'Genesis'}];
    state.bibleTranslations=[{id:'fixture',name:'개역개정'}];state.selectedBibleTranslationId='fixture';
    state.songs=[];songCatalogLoaded=true;state.calendarLoaded=true;state.calendarData=[{date:'2026-10-25',liturgical:'Fixture'}];
    state.referenceLinksLoaded=true;state.referenceLinks=[];state.uiVerses={};
    window.fixtureOriginalRecords=JSON.stringify([state.services,state.scriptures,state.songs,state.calendarData]);
    window.fixtureTransport=JSON.stringify([state.presenter,state.serviceMusic]);
    clearDirtyState();render();
   }''')
   page.evaluate("()=>{state.module='home';state.selectedServiceTypeId=null;state.search='';render()}")
   assert page.locator('.home-start').count()==1
   assert not page.locator('.service-week-board').count()
   assert not page.locator('.home-start .empty-verse').count()
   assert page.locator('.home-start-shortcuts button').count()==3
   page.evaluate("""()=>{const d=toLocalDateStr(new Date());state.services=[{id:'next',type_id:'sunday-main',date:d,sort_order:0},{id:'other',type_id:'sunday-main',date:d,sort_order:1}];render()}""")
   assert page.locator('.home-schedule-day button').count()==2
   assert page.locator('.home-schedule-day[aria-current="date"] h3 small').inner_text()=='오늘'
   page.evaluate("()=>{openServiceInPresenter=async id=>{window.homeOpenedService=id}}")
   page.locator('.home-schedule-day button').first.click()
   assert page.evaluate('window.homeOpenedService')=='next'
   for theme in ('light','dark'):
    page.evaluate('(t)=>applyTheme(t)',theme)
    for width in (1280,800,390):
     page.set_viewport_size({'width':width,'height':800})
     assert page.locator('.home-start').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
     page.locator('.home-schedule-day button').first.focus()
     page.locator('#detailPane').screenshot(path=f'/tmp/mindex-home-{engine}-{theme}-{width}.png')
   page.set_viewport_size({'width':1280,'height':800})
   page.locator('.home-start [data-service-week]').click()
   assert page.locator('.service-week-board').count()==2
   today=page.locator('.service-week-day[aria-current="date"]')
   assert today.locator('.service-week-today').inner_text()=='오늘'
   assert '2px' in today.evaluate('e=>getComputedStyle(e).boxShadow')
   assert page.locator('.service-week-today').count()==1
   page.evaluate("()=>{state.selectedServiceTypeId=null;state.search='';render()}")
   page.locator('.home-start [data-home-module="praise"]').click()
   page.wait_for_function("state.module==='praise'")
   assert page.locator('.empty-verse').count()==1
   page.evaluate("()=>{state.module='home';state.serviceTypes=[];state.serviceError='Failed to fetch';state.uiVerses.home=[{text:'HOME VERSE MUST NOT APPEAR'}];state.selectedServiceTypeId=null;render()}")
   assert page.locator('.empty-verse').count()==0
   assert 'HOME VERSE MUST NOT APPEAR' not in page.locator('#detailPane').inner_text()
   assert '예배를 불러오지 못했습니다' in page.locator('#detailPane').inner_text()
   print('PASS home start',engine,flush=True)
   browser.close()
finally:server.shutdown()
