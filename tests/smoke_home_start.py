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
   assert page.locator('.home-module').count()==5
   assert page.locator('.home-next,.home-prep-outline,.service-week-board,.empty-verse').count()==0
   assert '전체 현황' in page.locator('.home-start').inner_text()
   # Deferred worship hydration cannot replace the whole-app overview.
   page.evaluate("""async()=>{
    const saved=[fetchCachedSupabasePaged,loadCalendarData,ensureUpcomingPublicWorshipServices];
    fetchCachedSupabasePaged=async()=>[];loadCalendarData=async()=>{};ensureUpcomingPublicWorshipServices=async()=>[];
    try {await hydrateSupplementalWorshipDataAfterInitialRender();}
    finally {[fetchCachedSupabasePaged,loadCalendarData,ensureUpcomingPublicWorshipServices]=saved;}
   }""")
   assert page.locator('.home-module').count()==5
   page.evaluate("""()=>{
    const d=toLocalDateStr(new Date());
    state.serviceTypes=[{id:'young-adult',name:'청년부 예배'},{id:'children',name:'어린이부 예배'}];
    state.services=[{id:'next',type_id:'young-adult',date:d},{id:'other',type_id:'children',date:d},
      {id:'none',type_id:'young-adult',date:d,_worshipSourceRef:{no_gathering:true}},
      {id:'expected',type_id:'young-adult',date:d,_expected:true}];
    state.songs=[{id:'one',title:'Test Song'},{id:'two',title:'Second Song'}];songCatalogLoaded=true;
    state.bibleTranslations=[{id:'GAE',name:'개역개정'},{id:'KRV',name:'개역한글'}];
    state.calendarData=[{date:d,liturgical:'교회력 fixture'}];state.calendarLoaded=true;
    render();
   }""")
   assert '2회' in page.locator('.home-module').nth(0).inner_text()
   assert '2개 부서' in page.locator('.home-module').nth(1).inner_text()
   assert '2곡' in page.locator('.home-module').nth(2).inner_text()
   assert '2개 역본' in page.locator('.home-module').nth(3).inner_text()
   assert '교회력 fixture' in page.locator('.home-module--operations').inner_text()
   # The original sidebar routes remain functional, including stalled data.
   page.locator('#songList [data-service-week]').click()
   assert page.locator('.service-week-board').count()==2
   page.locator('#songList [data-service-list]').click()
   assert page.evaluate('state.selectedServiceTypeId')=='__list'
   page.evaluate("()=>{window.homeOriginalLoadItems=loadServiceItems;loadServiceItems=()=>new Promise(()=>{});state.presenter.outputWindow=null}")
   page.locator('#songList [data-service-id="next"]').click()
   page.wait_for_function("state.module==='presenter'&&state.selectedServiceId==='next'",timeout=3000)
   assert page.locator('[data-service-view-loading="next"]').count()==1
   assert page.evaluate('!isPresenterOutputWindowOpen()')
   page.evaluate("()=>{loadServiceItems=window.homeOriginalLoadItems;state.module='home';state.selectedServiceId=null;state.selectedServiceTypeId=null;clearDirtyState();render()}")
   # Continuation is a bounded navigation record, not a draft/body copy.
   page.evaluate("""()=>{
    state.recentWork=[];
    rememberRecentWork({module:'home'});
    rememberRecentWork({module:'praise'});
    rememberRecentWork({module:'praise',selectedSongId:'one',selectedVersionId:'v1',draft:'DO NOT STORE',search:'private query'});
    rememberRecentWork({module:'praise',selectedSongId:'one',selectedVersionId:'v1'});
    rememberRecentWork({module:'bulletin',selectedServiceId:'next',presenterBulletinServiceId:'next'});
    rememberRecentWork({module:'scripture',selectedBookCode:'GEN',selectedBibleTranslationId:'GAE',selectedBibleChapter:3,selectedBibleVerse:16});
    rememberRecentWork({module:'presenter',selectedServiceId:'next',selectedServiceTypeId:'young-adult'});
    render();
   }""")
   assert page.locator('[data-home-recent]').count()==4
   assert page.evaluate("!JSON.stringify(state.recentWork).includes('DO NOT STORE')&&!JSON.stringify(state.recentWork).includes('private query')")
   assert '3:16' in page.locator('.home-recent').inner_text()
   page.evaluate("""()=>{
    const get=safeStorageGet,set=safeStorageSet;
    try {
     safeStorageSet=(scope,key,value)=>{if(key===MINDEX_TAB_STATE_STORAGE_KEY)window.recentTabsPayload=value;return true};
     persistPageTabsState();state.recentWork=[];
     safeStorageGet=(scope,key)=>key===MINDEX_TAB_STATE_STORAGE_KEY?window.recentTabsPayload:null;
     readPageTabsState();
    } finally {safeStorageGet=get;safeStorageSet=set;}
    render();
   }""")
   assert page.locator('[data-home-recent]').count()==4
   page.evaluate("()=>{window.homeConfirm=confirmSaveBeforeLeaving;confirmSaveBeforeLeaving=async()=>false}")
   page.locator('[data-home-recent="praise:one"]').click()
   assert page.evaluate("state.module==='home'")
   page.evaluate("()=>{confirmSaveBeforeLeaving=window.homeConfirm;window.homeForms=loadForms;loadForms=async()=>{}}")
   page.locator('[data-home-recent="praise:one"]').click()
   page.wait_for_function("state.module==='praise'&&state.selectedSongId==='one'&&state.selectedVersionId==='v1'")
   assert page.evaluate('!isPresenterOutputWindowOpen()')
   page.evaluate("()=>{loadForms=window.homeForms;state.module='home';state.selectedSongId=null;state.selectedVersionId=null;render()}")
   for theme in ('light','dark'):
    page.evaluate('(t)=>applyTheme(t)',theme)
    for width in (1280,800,390):
     page.set_viewport_size({'width':width,'height':800})
     assert page.locator('.home-start').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
     page.locator('.home-module h2 button').first.focus()
     page.locator('#detailPane').screenshot(path=f'/tmp/mindex-overview-{engine}-{theme}-{width}.png')
   page.set_viewport_size({'width':1280,'height':800})
   for module in ('service','bulletin','praise','scripture','operations'):
    page.evaluate("()=>{state.module='home';state.selectedServiceId=null;state.selectedServiceTypeId=null;state.search='';clearDirtyState();render()}")
    page.locator(f'.home-module h2 [data-home-module="{module}"]').click()
    page.wait_for_function('(m)=>state.module===m',arg=module)
   page.evaluate("()=>{state.module='home';state.serviceTypes=[];state.serviceError='Failed to fetch';songCatalogLoaded=false;state.bibleTranslations=[];state.selectedServiceTypeId=null;render()}")
   assert page.locator('.home-module').count()==5
   assert page.locator('.empty-verse,.home-next').count()==0
   assert '불러오지 못했습니다' in page.locator('.home-module').nth(0).inner_text()
   assert '0곡' not in page.locator('.home-module').nth(2).inner_text()
   assert '0개 역본' not in page.locator('.home-module').nth(3).inner_text()
   print('PASS home overview, five routes, unknown/error states, sidebar navigation',engine,flush=True)
   browser.close()
finally:server.shutdown()
