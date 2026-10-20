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
   assert page.locator('.home-start-shortcuts').count()==0
   assert '등록된 다음 예배가 없습니다.' in page.locator('.home-start').inner_text()
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

   page.evaluate("""()=>{const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const d=toLocalDateStr(tomorrow);state.services=[{id:'next',type_id:'sunday-main',date:d,sort_order:0},{id:'other',type_id:'sunday-main',date:d,sort_order:1}];render()}""")
   assert page.locator('.home-next').count()==1
   assert page.locator('.home-schedule').count()==0
   assert page.locator('.home-next-actions button').count()==2
   assert '불러오는 중' in page.locator('.home-prep-content').inner_text()
   # Actual sidebar navigation remains independent of the preparation preview.
   page.locator('#songList [data-service-week]').click()
   assert page.locator('.service-week-board').count()==2
   page.locator('#songList [data-service-list]').click()
   assert page.evaluate('state.selectedServiceTypeId')=='__list'
   page.evaluate("()=>{window.homeOriginalLoadItems=loadServiceItems;loadServiceItems=()=>new Promise(()=>{});state.presenter.outputWindow=null}")
   page.locator('#songList [data-service-id="next"]').click()
   page.wait_for_function("state.module==='presenter' && state.selectedServiceId==='next'",timeout=3000)
   assert page.locator('[data-service-view-loading="next"]').count()==1
   assert not page.locator('.home-start').count()
   assert page.evaluate('!isPresenterOutputWindowOpen()')
   page.evaluate("()=>{loadServiceItems=window.homeOriginalLoadItems;state.module='home';state.selectedServiceId=null;state.selectedServiceTypeId=null;clearDirtyState();render()}")
   page.evaluate("()=>{openServiceInPresenter=async id=>{window.homeOpenedService=id}}")
   page.locator('.home-next [data-home-next-service-action="presenter"]').click()
   page.wait_for_function("window.homeOpenedService==='next'")
   # Preview actual registered content, excluding a nearer no-gathering record.
   page.evaluate("""()=>{
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const date=toLocalDateStr(tomorrow);
    state.serviceTypes=[{id:'fixture',name:'청년부 예배'}];
    state.services=[{id:'none',type_id:'fixture',date:toLocalDateStr(new Date()),_worshipSourceRef:{no_gathering:true}},{id:'preview',type_id:'fixture',date}];
    state.loadedWorshipServiceIds.add('preview');
    state.serviceItems.preview=[
     {id:'song',service_id:'preview',label:'찬양',raw_title:'하나님은 너를 만드신 분',sort_order:0},
     {id:'prayer',service_id:'preview',label:'대표기도',raw_title:'대표기도',assignee:'이예율 학생',sort_order:1},
     {id:'reading',service_id:'preview',label:'성경봉독',raw_title:'빌립보서 4:6–7',sort_order:2},
     {id:'sermon',service_id:'preview',label:'설교',raw_title:'염려 대신 기도',assignee:'김남영 목사',sort_order:3},
     {id:'notice',service_id:'preview',label:'광고',raw_title:'이번 주 소식과 기도 모임 안내',sort_order:4}
    ];render();
   }""")
   assert page.locator('.home-next [data-home-service-id="preview"]').count()==2
   assert '염려 대신 기도' in page.locator('.home-prep-content').inner_text()
   assert '이예율 학생' in page.locator('.home-prep-content').inner_text()
   for theme in ('light','dark'):
    page.evaluate('(t)=>applyTheme(t)',theme)
    for width in (1280,800,390):
     page.set_viewport_size({'width':width,'height':800})
     assert page.locator('.home-start').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
     page.locator('.home-next-actions button').first.focus()
     page.locator('#detailPane').screenshot(path=f'/tmp/mindex-home-{engine}-{theme}-{width}.png')
   # A delayed read must not steal navigation or mark unknown content ready.
   page.evaluate("""()=>{
    state.loadedWorshipServiceIds.delete('preview');
    state.client={from:()=>{throw Error('unexpected external read')}};
    loadServiceItems=()=>new Promise(resolve=>{window.finishHomePreview=resolve});
    renderHomeStart();
   }""")
   assert page.locator('.home-prep-content[aria-busy="true"]').count()==1
   page.evaluate("()=>{state.module='praise';render();window.finishHomePreview()}")
   page.wait_for_function("state.module==='praise'&&!document.querySelector('.home-start')")
   assert page.locator('.empty-verse').count()==1
   page.evaluate("()=>{loadServiceItems=window.homeOriginalLoadItems;state.client={};state.module='home';serviceViewLoadErrors.set('preview',true);render()}")
   assert '불러오지 못했습니다' in page.locator('.home-prep-content').inner_text()
   page.evaluate("()=>{state.module='home';state.serviceTypes=[];state.serviceError='Failed to fetch';state.uiVerses.home=[{text:'HOME VERSE MUST NOT APPEAR'}];state.selectedServiceTypeId=null;render()}")
   assert page.locator('.empty-verse').count()==0
   assert 'HOME VERSE MUST NOT APPEAR' not in page.locator('#detailPane').inner_text()
   assert '예배를 불러오지 못했습니다' in page.locator('#detailPane').inner_text()
   print('PASS home start',engine,flush=True)
   browser.close()
finally:server.shutdown()
