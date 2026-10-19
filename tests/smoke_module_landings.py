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
   for theme in ('light','dark'):
    page.evaluate('(t)=>applyTheme(t)',theme)
    for module,title,reference in [('service','예배','Psalm 95:6'),('bulletin','주보','Psalm 133:1'),('praise','찬양','Psalm 96:1'),('scripture','말씀','Psalm 119:105'),('operations','운영','1 Corinthians 14:40')]:
     selector=f'.module-switcher [data-home-module="{module}"]'
     page.locator(selector).click()
     page.wait_for_function('(m)=>state.module===m',arg=module)
     assert page.evaluate('currentPageTabTitle()')==title,(engine,module,title,page.evaluate('currentPageTabTitle()'))
     assert page.locator('.empty-detail-inner > span').inner_text()==reference.upper(),(engine,module,reference,page.locator('.empty-detail-inner > span').inner_text())
     assert page.locator('.empty-verse').inner_text().strip()
     assert not page.locator('.service-dashboard,.calendar-table').count()
     snapshot=page.evaluate('currentBrowserHistorySnapshot()')
     assert not any(snapshot.get(k) for k in ['selectedServiceTypeId','selectedServiceId','selectedSongId','selectedVersionId','selectedBookCode','presenterBulletinServiceId','search'])
     page.evaluate('''()=>{state.search='changed';refs.searchInput.value='changed';state.selectedServiceTypeId='__week'}''')
     page.locator(selector).click()
     page.wait_for_function("!state.search&&!state.selectedServiceTypeId")
   # Explicit destinations keep their real title and content.
   page.locator('.module-switcher [data-home-module="service"]').click()
   page.locator('#songList [data-service-week]').click()
   assert page.evaluate('currentPageTabTitle()')=='최근 예배'
   assert page.locator('.service-dashboard').count()==1
   page.locator('[data-operations-nav]').click()
   page.locator('#songList [data-home-module="calendar"]').click()
   page.wait_for_function("state.module==='calendar'")
   assert page.evaluate('currentPageTabTitle()')=='교회력'
   assert page.locator('[data-operations-nav]').get_attribute('aria-current')=='page'
   page.locator('[data-operations-nav]').click()
   page.go_back();page.wait_for_function("state.module==='calendar'")
   assert page.evaluate('currentPageTabTitle()')=='교회력'
   page.go_forward();page.wait_for_function("state.module==='operations'")
   page.evaluate("async()=>{await applyBrowserHistorySnapshot({module:'operations'});syncBrowserHistory()}")
   assert page.evaluate('pageTabTitleForSnapshot(currentBrowserHistorySnapshot())')=='운영'
   assert page.evaluate("linkStateFromParams(new URLSearchParams('module=operations')).module")=='operations'
   # A real unsaved-edit cancellation must preserve the current editor.
   page.evaluate('''()=>{
    state.module='references';state.referenceLinks=[{id:'fixture',title:'Original',url:'https://example.com'}];
    state.cleanFingerprints.references=dirtyModuleFingerprint('references');state.referenceLinks[0].title='Still editing';state.dirty.references=true;render();
   }''')
   page.locator('[data-operations-nav]').click()
   page.get_by_role('button',name='계속 편집',exact=True).click()
   assert page.evaluate("state.module==='references'&&state.referenceLinks[0].title==='Still editing'&&state.dirty.references")
   page.evaluate('clearDirtyState()')
   result=page.evaluate('''()=>{
    const samples=[UI_VERSE_DEFAULTS.service.text,UI_VERSE_DEFAULTS.bulletin.text,UI_VERSE_DEFAULTS.praise.text,UI_VERSE_DEFAULTS.scripture.text,UI_VERSE_DEFAULTS.operations.text,
      'A short, complete phrase.', 'A long sentence that has no commas and must still wrap cleanly between whole words without losing anything.'];
    for(const text of samples){const lines=splitHomeVerseLines(text);if(lines.some(l=>l.length>45))throw Error('line exceeds 45');if(lines.join(' ')!==text)throw Error('text changed')}
    if(splitHomeVerseLines('One\\nline, then another.').join(' ')!=='One line, then another.')throw Error('manual newline mode');
    if(splitHomeVerseLines('A short, complete phrase.').length!==1)throw Error('comma forced');
    state.uiVerses.service=[{text:'Stored override',reference:'Fixture 1:1'}];if(moduleUiVerse('service').text!=='Stored override')throw Error('stored source ignored');
    if(JSON.stringify([state.services,state.scriptures,state.songs,state.calendarData])!==fixtureOriginalRecords)throw Error('records changed');
    if(JSON.stringify([state.presenter,state.serviceMusic])!==fixtureTransport)throw Error('transport changed');
    return {roots:5,limit:45,manualNewlines:false,sourceUnchanged:true,transportUnchanged:true};
   }''')
   print('PASS',engine,result,flush=True)
   browser.close()
finally:server.shutdown()
