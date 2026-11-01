"""Whole chapters retain meaning across inline input, atomic reload and slide plans."""
import os
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
# Reuse only the isolated fixture definitions, never run that broader audit.
fixture_source=Path(__file__).with_name('smoke_inline_scripture_audit.py').read_text()
exec(compile(fixture_source.split('\ndef exercise(')[0],str(Path(__file__).with_name('smoke_inline_scripture_audit.py')),'exec'))
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1440,'height':900})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
   page.add_init_script("window.forbiddenActions=[];window.open=()=>{forbiddenActions.push('open');return null};window.print=()=>forbiddenActions.push('print');HTMLMediaElement.prototype.play=()=>{forbiddenActions.push('play');return Promise.resolve()}")
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterInlineEditor==='function'&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(page);data=page.evaluate(FIXTURE)
   page.evaluate("state.scriptureBooks=[...state.scriptureBooks,{code:'MAT',koreanName:'마태복음',englishName:'Matthew',chapterCount:28,testament:'new'},{code:'JHN',koreanName:'요한복음',englishName:'John',chapterCount:21,testament:'new'}]")
   page.evaluate("""()=>{
    state.scriptureBooks.push({code:'1TH',koreanName:'데살로니가전서',shortName:'살전',englishName:'1 Thessalonians',chapterCount:5,testament:'new'});
    const check=(v,m)=>{if(!v)throw Error(m)};
    const refs=inspectScriptureReferences('살전 1:2-3, 6-8; 2');
    check(refs.valid&&refs.entries.length===3,'Thessalonians parse invalid');
    const [a,b,c]=refs.entries.map(e=>e.reference);
    check(a.chapter===1&&a.verse===2&&a.verseEnd===3&&b.chapter===1&&b.verse===6&&b.verseEnd===8&&c.chapter===2&&!c.verse,'separator context lost '+JSON.stringify(refs));
    const text=formatServiceScriptureReferenceList(refs.references,{abbreviated:true});
    check(text==='살전 1:2–3, 6–8; 2','unexpected display '+text);
    check(JSON.stringify(normalizeServiceScriptureReferenceList(text))===JSON.stringify(refs.references),'semicolon roundtrip lost');
    check(inspectScriptureReferences('살전 1:2, 3').entries[1].reference.verse===3,'comma no longer verse');
    check(!inspectScriptureReferences('살전 1:2; 2장').entries[1].reference.verse,'explicit chapter regressed');
   }""")
   cases=[['창세기 1:1','창세기 1'],['창세기 1','창세기 1:1'],['창세기 1:1','창세기 2'],['창세기 2','창세기 1:1'],['창세기 1:1–2','창세기 1'],['창세기 1:1','창세기 1:3'],['마태복음 1:1','마태복음 1'],['마태복음 1','마태복음 1:1'],['마태복음 1:1','요한복음 1']]
   cases += [['창세기 1:1–2','창세기 1:2–3'],['창세기 1','창세기 2','창세기 1:3']]
   for refs in cases:
    page.evaluate('''refs=>{const before=JSON.stringify(refs),expected=normalizeServiceScriptureReferenceList(refs);if(!expected.length)throw Error('fixture reference missing');for(const abbreviated of [false,true]){const text=formatServiceScriptureReferenceList(refs,{abbreviated});if(JSON.stringify(normalizeServiceScriptureReferenceList(text))!==JSON.stringify(expected))throw Error('roundtrip '+text)}if(JSON.stringify(refs)!==before)throw Error('source mutated')}''',refs)
   panel=page.locator(f'.svc-outline-editor[data-inline-item-id="{data["ids"][0]}"]')
   toggle=page.locator(f'[data-presenter-inline-toggle="{data["ids"][0]}"]');field=panel.locator('[data-presenter-preparation-field]')
   for refs in cases[:6]:
    if not panel.is_visible():toggle.click()
    display=page.evaluate('refs=>formatServiceScriptureReferenceList(refs)',refs)
    field.fill(display)
    if refs == cases[1]:
     # Exercise persistence after the loaded marker was invalidated while editing.
     page.evaluate('state.loadedWorshipServiceIds.delete(inlineFixture.sid)')
    panel.locator('[data-presenter-inline-apply]').click()
    page.wait_for_function('!presenterInlineInputSaves.size&&!state.saving&&!state.presenterPreparationApplyingServiceIds.size')
    plan=page.evaluate('''refs=>{const item=state.serviceItems[inlineFixture.sid].find(x=>x.id===inlineFixture.ids[0]);const actual=serviceItemScriptureReferences(item,parseServiceItemMemo(item.memo));if(JSON.stringify(actual)!==JSON.stringify(normalizeServiceScriptureReferenceList(refs)))throw Error('apply lost reference '+JSON.stringify({expected:refs,actual}));if(parseServiceItemMemo(item.memo).scriptureTranslationId!==state.selectedBibleTranslationId)throw Error('translation changed');inlineFixture.checkQuiet();return JSON.stringify(presenterSlidesForService(inlineFixture.sid))}''',refs)
    assert '합성 검증 본문' in plan,'missing fixture slide content'
    page.evaluate('async()=>{const id=inlineFixture.sid;state.loadedWorshipServiceIds.delete(id);await loadServiceItems(id);renderServiceList();renderPresenterDetail()}')
    if not panel.is_visible():toggle.click()
    assert field.input_value()==display,(engine,refs,field.input_value())
    assert page.evaluate('JSON.stringify(presenterSlidesForService(inlineFixture.sid))')==plan,'reload changed slide content/order'
    page.evaluate('inlineFixture.checkQuiet()')
   print('PASS',engine,'11 bidirectional/abbreviated roundtrips; 6 actual inline apply/atomic reload/slide-plan retention',flush=True)
   browser.close()
finally:server.shutdown()
