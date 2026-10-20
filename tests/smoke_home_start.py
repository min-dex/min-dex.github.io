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
   page.evaluate("""async()=>{
    const saved=[fetchCachedSupabasePaged,loadCalendarData,ensureUpcomingPublicWorshipServices];
    fetchCachedSupabasePaged=async()=>[];loadCalendarData=async()=>{};ensureUpcomingPublicWorshipServices=async()=>[];
    try {
     await new Promise(resolve=>setTimeout(resolve,25));
     await hydrateSupplementalWorshipDataAfterInitialRender();
    } finally {[fetchCachedSupabasePaged,loadCalendarData,ensureUpcomingPublicWorshipServices]=saved;}
   }""")
   assert page.locator('.home-start').count()==1, 'late supplemental load replaced home'
   assert page.locator('.empty-verse').count()==0

   page.evaluate("""()=>{const d=toLocalDateStr(new Date());state.services=[{id:'next',type_id:'sunday-main',date:d,sort_order:0},{id:'other',type_id:'sunday-main',date:d,sort_order:1}];render()}""")
   assert page.locator('.home-schedule-day button').count()==2
   assert page.locator('.home-schedule-day[aria-current="date"] h3 small').inner_text()=='오늘'
   # Exercise the actual sidebar delegates, including a stalled detail load.
   page.locator('#songList [data-service-week]').click()
   assert page.locator('.service-week-board').count()==2
   page.locator('#songList [data-service-list]').click()
   assert page.evaluate('state.selectedServiceTypeId')=='__list'
   assert not page.locator('.home-start').count()
   page.evaluate("()=>{window.homeOriginalLoadItems=loadServiceItems;loadServiceItems=()=>new Promise(()=>{});state.presenter.outputWindow=null}")
   page.locator('#songList [data-service-id="next"]').click()
   page.wait_for_function("state.module==='presenter' && state.selectedServiceId==='next'",timeout=3000)
   assert page.locator('[data-service-view-loading="next"]').count()==1
   assert not page.locator('.home-start').count()
   assert page.evaluate('!isPresenterOutputWindowOpen()')
   page.evaluate("()=>{loadServiceItems=window.homeOriginalLoadItems;state.module='home';state.selectedServiceId=null;state.selectedServiceTypeId=null;clearDirtyState();render()}")
   page.evaluate("()=>{openServiceInPresenter=async id=>{window.homeOpenedService=id}}")
   page.locator('.home-schedule-day button').first.click()
   assert page.evaluate('window.homeOpenedService')=='next'
   # Review a full week, not only the two-item navigation fixture.
   page.evaluate("""()=>{
    const week=recentServiceWeeks(new Date())[0];
    state.serviceTypes=[{id:'main',name:'주일예배 [1부]'},{id:'union',name:'온세대 찬양예배'},{id:'young',name:'청년부 예배'},{id:'wed',name:'수요예배'},{id:'fri',name:'금요기도회'}];
    const day=offset=>{const d=new Date(week.start);d.setDate(d.getDate()+offset);return toLocalDateStr(d)};
    state.services=[['main',0],['union',0],['young',0],['wed',3],['fri',5]].map(([type,offset],i)=>({id:'visual-'+i,type_id:type,date:day(offset),sort_order:i}));
    render();
   }""")
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
