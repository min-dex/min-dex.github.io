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
   assert '교회력 fixture' in page.locator('.home-start-header').inner_text()
   assert '교회력 fixture' not in page.locator('.home-module--operations').inner_text()
   # Saved receipts and browsing history are independent; latest save wins.
   page.evaluate("""()=>{
    rememberRecentEdit({module:'praise',selectedSongId:'one',selectedVersionId:'v1'},'Test Song','2026-10-20T01:00:00Z');
    rememberRecentEdit({module:'praise',selectedSongId:'one',selectedVersionId:'v2'},'Test Song','2026-10-21T01:00:00Z');
    rememberRecentEdit({module:'scripture',selectedScriptureId:'fixture'},'Fixture','2026-10-20T02:00:00Z');
    rememberRecentEdit({module:'praise',selectedSongId:'two'},'Invalid','invalid');
   }""")
   page.locator('[data-home-recent-view="edits"]').click()
   assert page.locator('.home-recent-list button').count()==2
   assert page.locator('.home-recent-list time').count()==2
   assert page.evaluate("homeRecentEditEntries()[0].snapshot.selectedVersionId")=='v2'
   page.evaluate("""()=>{
    const get=safeStorageGet,set=safeStorageSet;
    try {
     let payload;
     safeStorageSet=(scope,key,value)=>{payload=value;return true};persistPageTabsState();
     state.homeRecentView='work';state.recentEdits=[];
     safeStorageGet=()=>payload;readPageTabsState();
    } finally {safeStorageGet=get;safeStorageSet=set;}
   }""")
   assert page.evaluate('state.homeRecentView')=='edits'
   assert page.evaluate('state.recentEdits.length')==2
   page.locator('[data-home-recent-view="work"]').click()
   assert page.locator('.home-recent-list time').count()==0
   # Every viewport reserves the same recent area in both views, even empty.
   for width in (1280,800,390):
    page.set_viewport_size({'width':width,'height':800})
    page.locator('[data-home-recent-view="work"]').click()
    top=page.locator('.home-module').first.bounding_box()['y']
    page.locator('[data-home-recent-view="edits"]').click()
    assert abs(page.locator('.home-module').first.bounding_box()['y']-top)<1
    assert page.locator('.home-recent-note').count()==0
    assert page.locator('.home-recent-list button').first.bounding_box()['height']==80
   page.set_viewport_size({'width':1280,'height':800})
   page.locator('[data-home-recent-view="work"]').click()
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
   # Home totals are independent of reader selection and full catalogue loads.
   result=page.evaluate("""async()=>{
    const check=(ok,message)=>{if(!ok)throw Error(message)};
    const originalClient=state.client, originalCanRead=canUseClientData;
    const before=JSON.stringify([state.songs,state.bibleTranslations,state.selectedBibleTranslationId,state.selectedBookCode,songCatalogLoaded]);
    const calls=[];let resolveSongs,resolveEditions;
    const responses={mindex_songs:new Promise(r=>resolveSongs=r),mindex_bible_translations:new Promise(r=>resolveEditions=r)};
    const client={from:table=>({select:(fields,options)=>{
     calls.push({table,fields,options});
     return {eq(){return this},abortSignal(){return responses[table]}};
    }})};
    try {
     state.client=client;canUseClientData=()=>true;homeOverviewStats=null;
     state.module='home';renderHomeStart();
     const pending=loadHomeOverviewStats();
     check(calls.length===2,'duplicate summary requests');
     state.module='praise';render();
     resolveSongs({count:1133,error:null});
     resolveEditions({data:[{id:'one',name:'개역개정',canonical_source:{}},{id:'two',name:'ASV',canonical_source:'source'},{id:'legacy',name:'legacy',canonical_source:null}],error:null});
     await pending;
     check(state.module==='praise'&&!document.querySelector('.home-start'),'late totals replaced navigation');
     check(homeOverviewStats.songs===1133&&homeOverviewStats.editions===2,'source-qualified totals');
     check(JSON.stringify([state.songs,state.bibleTranslations,state.selectedBibleTranslationId,state.selectedBookCode,songCatalogLoaded])===before,'summary changed reader/catalogue state');
     check(calls[0].fields==='id'&&calls[0].options.head&&calls[0].options.count==='exact','song count downloaded catalogue');
     check(!calls[1].fields.includes('*')&&!calls[1].fields.includes('text'),'edition query fetched bodies');
     state.module='home';renderHomeStart();
     check(calls.length===2,'summary ignored freshness window');
     responses.mindex_songs=Promise.resolve({error:{message:'offline'}});
     responses.mindex_bible_translations=Promise.resolve({error:{message:'offline'}});
     await loadHomeOverviewStats({force:true});
     check(document.querySelectorAll('[data-home-overview-retry]').length===2,'summary error has no retry');
     responses.mindex_songs=Promise.resolve({count:0,error:null});
     responses.mindex_bible_translations=Promise.resolve({data:[],error:null});
     await loadHomeOverviewStats({force:true});
     check(homeOverviewStats.songs===0&&homeOverviewStats.editions===0,'zero treated as unknown');
     return 'PASS lightweight independent catalogue totals, coalescing, read errors and zero';
    } finally {state.client=originalClient;canUseClientData=originalCanRead;homeOverviewStats=null;}
   }""")
   print(engine,result,flush=True)
   result=page.evaluate("""async()=>{
    const original=state.client,canRead=canUseClientData;
    const calls=[];
    let resolve;
    const pending=new Promise(r=>resolve=r);
    try {
     canUseClientData=()=>false;
     state.client={from(table){const call={table};calls.push(call);return {
      select(fields){call.fields=fields;return this},order(){return this},limit(n){call.limit=n;return this},abortSignal(){return pending}
     }}};
     state.homeRecentView='edits';state.module='home';
     const first=loadHomeRecentEdits();void loadHomeRecentEdits();
     state.module='praise';refs.detailPane.innerHTML='<div id="recent-navigation-sentinel"></div>';
     resolve({data:[{id:'next',service_id:'next',updated_at:'2026-10-21T02:00:00Z'}],error:null});await first;
     if(!document.querySelector('#recent-navigation-sentinel'))throw Error('late recent response replaced destination');
     if(calls.length!==2||calls.some(c=>c.limit!==12||/content|layout|text|\*/.test(c.fields)))throw Error('recent query unbounded or fetched bodies');
     if(!homeRecentEditEntries().some(e=>e.key==='presenter:next'))throw Error('server saves missing');
     state.client={from(){return {select(){return this},order(){return this},limit(){return this},abortSignal(){return Promise.resolve({error:{message:'offline'}})}}}};
     state.module='home';await loadHomeRecentEdits();
     if(!homeRecentEditsCache.error||!document.querySelector('[data-home-recent-retry]'))throw Error('read failure hidden');
     return 'PASS bounded recent save queries, coalescing, navigation guard and read failure';
    } finally {state.client=original;canUseClientData=canRead;homeRecentEditsCache=null;state.homeRecentView='work';}
   }""")
   print(engine,result,flush=True)
   print('PASS home overview, five routes, unknown/error states, sidebar navigation',engine,flush=True)
   browser.close()
finally:server.shutdown()
