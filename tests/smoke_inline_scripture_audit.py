"""Offline actual scripture inline handlers; synthetic cache and transport only."""
import ast
import os
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium, prepare_server_state_fixture

source = ast.parse(Path(__file__).with_name('smoke_presenter_inline_editor.py').read_text())
FIXTURE = next(n.value.value for n in source.body if isinstance(n, ast.Assign)
               and any(isinstance(t, ast.Name) and t.id == 'FIXTURE' for t in n.targets))
a = FIXTURE.index("const items=['First'")
z = FIXTURE.index('const typed=', a)
FIXTURE = FIXTURE[:a] + r"""
const translationId=crypto.randomUUID();
state.scriptureBooks=[{code:'GEN',koreanName:'창세기',englishName:'Genesis',chapterCount:50,testament:'old'}];
state.bibleTranslations=[{id:translationId,name:'개역개정',abbreviation:'개역개정',metadata:{}}];
state.selectedBibleTranslationId=translationId;
state.bibleVerseCache=new Map();
for(const chapter of [1,2,3,5])state.bibleVerseCache.set(bibleVerseCacheKey(translationId,'GEN',chapter),
  [1,2,3].map(verse=>({book_code:'GEN',chapter,verse,text:`합성 검증 본문 ${chapter}:${verse}`})));
const items=[normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,label:'성경봉독',raw_title:'창세기 1:1',
 _worshipSectionKey:'scripture_reading',_worshipSectionTitle:'성경봉독',_worshipSlotKey:'word.body',
 _worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',
 scriptureTranslationId:translationId,scriptureReference:'창세기 1:1',scriptureReferences:['창세기 1:1']})},0),
 normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,label:'광고',raw_title:'보존할 다른 행',
 _worshipSectionKey:'announcements',_worshipSectionTitle:'광고',_worshipSlotKey:'announcements.news',
 _worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'body',inputMode:'text',slides:['보존할 다른 행']})},1)];
""" + FIXTURE[z:]
FIXTURE = FIXTURE.replace("from(){throw Error('Legacy table write attempted')}", r"""from(table){
 check(table==='mindex_bible_verses','Unexpected table access '+table);
 const filters={};const query={select(){return query},eq(key,value){filters[key]=value;return query},
 async order(){
  inlineFixture.verseReads=(inlineFixture.verseReads||0)+1;
  check(filters.translation_id===translationId&&filters.book_code==='GEN'&&filters.is_active===true,'wrong verse query');
  if(inlineFixture.verseDelay)await new Promise(resolve=>inlineFixture.verseRelease=resolve);
  return {data:[1,2,3].map(verse=>({book_code:'GEN',chapter:filters.chapter,verse,text:`합성 검증 본문 ${filters.chapter}:${verse}`}))};
 }};return query;
}""")


def exercise(page, url, scenario):
    page.route('**/*', lambda route: route.continue_() if
               urlsplit(route.request.url).netloc == urlsplit(url).netloc and route.request.method in ('GET', 'HEAD') else route.abort())
    page.route('**/mindex-release.json*', lambda route: route.fulfill(json={'version': 'scripture-audit-source'}))
    page.add_init_script("""window.forbiddenActions=[];
      window.open=()=>{forbiddenActions.push('open');return null};window.print=()=>forbiddenActions.push('print');
      HTMLMediaElement.prototype.play=function(){forbiddenActions.push('play');return Promise.resolve()};
      HTMLMediaElement.prototype.pause=function(){forbiddenActions.push('pause')};""")
    page.goto(url+'?mindexSmokeRaw=1')
    page.wait_for_function("typeof renderPresenterInlineEditor==='function'&&!document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    fixture = FIXTURE
    if scenario.startswith('empty_') or scenario in ('clear_failure_retry', 'clear_background'):
        fixture = fixture.replace('state.worshipSections=structuredClone(rows.sections);', r"""
          rows.elements[0].scripture_id=crypto.randomUUID();
          rows.elements[0].body='합성 기존 본문';
          Object.assign(rows.elements[0].config,{scriptureReference:'창세기 1:1',scripture_reference:'창세기 1:1',
            scriptureReferencePayloads:[{reference:'창세기 1:1',scriptureTranslationId:translationId}],slides:['합성 기존 본문']});
          Object.assign(rows.elements[0].source_ref,{scriptureReference:'창세기 1:1',scripture_references:['창세기 1:1']});
          state.worshipSections=structuredClone(rows.sections);
        """)
    if scenario == 'empty_citation':
        fixture = fixture.replace("label:'성경봉독'", "label:'인용 구절'").replace("_worshipSlotKey:'word.body'", "_worshipSlotKey:'sermon.citation'")
    if scenario == 'untouched_blank':
        fixture = fixture.replace("raw_title:'창세기 1:1'", "raw_title:''").replace("scriptureReference:'창세기 1:1',scriptureReferences:['창세기 1:1']", "scriptureReference:'',scriptureReferences:[]")
    if scenario == 'empty_fallback':
        fixture = fixture.replace('const typed=', r"""items.push(normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,
          label:'설교 본문',raw_title:'창세기 2:1',_worshipSectionKey:'sermon',_worshipSectionTitle:'설교',_worshipSlotKey:'sermon.body',
          _worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',
          scriptureTranslationId:translationId,scriptureReference:'창세기 2:1',scriptureReferences:['창세기 2:1']})},2));const typed=""")
    data = page.evaluate(fixture)
    before = page.evaluate('inlineFixture.db().elements')
    item_id = data['ids'][0]
    panel = page.locator(f'.svc-outline-editor[data-inline-item-id="{item_id}"]')
    toggle = page.locator(f'[data-presenter-inline-toggle="{item_id}"]')
    field = panel.locator('[data-presenter-preparation-field]')

    def opened():
        if not panel.is_visible():
            toggle.click()

    def settled():
        page.wait_for_function('!presenterInlineInputSaves.size&&!state.saving&&!state.presenterPreparationApplyingServiceIds.size')

    def report():
        return page.evaluate("""()=>({writes:inlineFixture.writes.length,attempts:inlineFixture.attempts,
          row:inlineFixture.db().elements.find(e=>e.id===inlineFixture.ids[0]),
          toasts:[...document.querySelectorAll('.toast')].map(e=>e.textContent),
          value:document.querySelector('[data-presenter-preparation-field]')?.value})""")

    def save(value):
        opened()
        field.fill(value)
        panel.locator('[data-presenter-inline-apply]').click()
        settled()

    def reload_expect(value):
        page.evaluate("async()=>{const id=inlineFixture.sid;state.loadedWorshipServiceIds.delete(id);await loadServiceItems(id);renderServiceList();renderPresenterDetail()}")
        opened()
        assert field.input_value() == value, ('real reload mismatch', report())
        page.evaluate('inlineFixture.checkQuiet()')

    opened()
    if scenario in ('untouched_blank', 'ime_blank'):
        if scenario == 'ime_blank':
            field.fill('')
            field.dispatch_event('compositionstart')
            field.dispatch_event('keydown', {'key':'Enter','code':'Enter','isComposing':True})
            page.wait_for_timeout(80)
            assert report()['attempts'] == 0 and panel.is_visible(), report()
            field.dispatch_event('compositionend')
            assert page.evaluate('inlineFixture.db().elements') == before
        else:
            save('')
            assert not report()['row']['config'].get('scriptureInputCleared'), report()
            assert page.evaluate('inlineFixture.db().elements') == before
    elif scenario == 'abbreviation':
        save('창 1:2')
        assert report()['writes'] == 1, report()
        assert report()['row']['scripture_reference'] == '창세기 1:2', report()
        reload_expect('창세기 1:2')
    elif scenario in ('invalid_parse_retry', 'invalid_verse_retry'):
        value = '없는책 1:1' if scenario == 'invalid_parse_retry' else '창세기 1:99'
        save(value)
        assert report()['writes'] == 0 and report()['attempts'] == 0, report()
        assert panel.is_visible() and field.input_value() == value, ('invalid input lost', report())
        assert report()['row']['scripture_reference'] == '창세기 1:1', report()
        save('창 1:2')
        assert report()['writes'] == 1, report()
        reload_expect('창세기 1:2')
    elif scenario in ('empty_delete', 'empty_fallback', 'empty_citation', 'clear_failure_retry', 'clear_background'):
        if scenario == 'clear_failure_retry':
            page.evaluate('inlineFixture.failure=true')
            save('')
            assert panel.is_visible() and field.input_value() == '', report()
            assert page.evaluate('inlineFixture.db().elements') == before, 'failed clear changed committed aggregate'
            page.evaluate('inlineFixture.failure=false')
        if scenario == 'clear_background':
            page.evaluate('inlineFixture.verseDelay=true')
            field.fill('창 4:1')
            panel.locator('[data-presenter-inline-apply]').click()
            page.wait_for_function('typeof inlineFixture.verseRelease==="function"')
            field.fill('')
            page.evaluate('inlineFixture.verseDelay=false;inlineFixture.verseRelease()')
            settled()
            assert panel.is_visible() and field.input_value() == '', report()
            assert report()['row']['scripture_reference'] == '창세기 4:1', report()
        prior_writes = report()['writes']
        save('')
        assert report()['writes'] == prior_writes + 1, ('empty scripture deletion did not persist', report())
        assert not report()['row']['scripture_reference'], report()
        row = report()['row']
        assert not row['title'] and not row['body'] and row['scripture_id'] is None, row
        assert row['config'].get('scriptureInputCleared') is True, row
        for key in ('scriptureReference','scripture_reference','scriptureReferences','scripture_references','scriptureReferencePayloads','manualScripture','slides'):
            assert not row['config'].get(key) and not row['source_ref'].get(key), (key,row)
        reload_expect('')
        if scenario == 'empty_fallback':
            assert page.evaluate('()=>serviceItemScriptureReferences(state.serviceItems[inlineFixture.sid][0],undefined,state.services.find(s=>s.id===inlineFixture.sid))') == ['창세기 2:1'], 'display fallback lost'
            assert page.evaluate('inlineFixture.db().elements[2]') == before[2], 'fallback source row changed'
            page.evaluate('async()=>{await resolveServiceScriptureBodyReference(inlineFixture.sid,0)}')
            assert page.evaluate('state.serviceItems[inlineFixture.sid][0].raw_title') == '', 'resolver copied display fallback into cleared source'
        page.evaluate('async()=>{await saveService(inlineFixture.sid,{silent:true,renderAfterSave:false})}')
        reload_expect('')
        save('창 1:2')
        assert not report()['row']['config'].get('scriptureInputCleared'), report()
        reload_expect('창세기 1:2')
    elif scenario == 'late_lookup':
        page.evaluate('inlineFixture.verseDelay=true')
        field.fill('창 4:1')
        panel.locator('[data-presenter-inline-apply]').click()
        page.wait_for_function('typeof inlineFixture.verseRelease===\"function\"')
        field.fill('창 5:1')
        page.evaluate('inlineFixture.verseDelay=false;inlineFixture.verseRelease()')
        settled()
        assert panel.is_visible() and field.input_value() == '창 5:1', ('late verse lookup replaced newer draft', report())
        assert report()['writes'] == 1 and report()['row']['scripture_reference'] == '창세기 4:1', report()
        save('창 5:1')
        assert report()['writes'] == 2, report()
        reload_expect('창세기 5:1')
    elif scenario == 'late_atomic':
        page.evaluate('inlineFixture.delay=true')
        field.fill('창 2:1')
        panel.locator('[data-presenter-inline-apply]').click()
        page.wait_for_function('typeof inlineFixture.release===\"function\"')
        field.fill('창 3:1')
        page.evaluate('inlineFixture.delay=false;inlineFixture.release()')
        settled()
        assert panel.is_visible() and field.input_value() == '창 3:1', ('late atomic receipt replaced newer draft', report())
        assert report()['row']['scripture_reference'] == '창세기 2:1', report()
        save('창 3:1')
        assert report()['writes'] == 2, report()
        reload_expect('창세기 3:1')
    after = page.evaluate('inlineFixture.db().elements')
    assert after[1] == before[1], 'saving scripture changed another row'
    page.evaluate('inlineFixture.checkQuiet()')
    page.unroute_all(behavior='wait')


server, url = start_local_app_server()
failures = []
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            try:
                for scenario in ('abbreviation', 'invalid_parse_retry', 'invalid_verse_retry', 'empty_delete', 'empty_fallback', 'empty_citation', 'clear_failure_retry', 'clear_background', 'untouched_blank', 'ime_blank', 'late_lookup', 'late_atomic'):
                    page = browser.new_page(viewport={'width': 1440, 'height': 900})
                    try:
                        exercise(page, url, scenario)
                        print(engine, scenario, 'PASS actual scripture input/apply/atomic/reload', flush=True)
                    except Exception as error:
                        failures.append((engine, scenario, str(error)))
                        print(engine, scenario, 'FAIL', str(error), flush=True)
                    finally:
                        page.unroute_all(behavior='wait')
                        page.close()
            finally:
                browser.close()
finally:
    server.shutdown()
if failures:
    raise AssertionError(failures)
