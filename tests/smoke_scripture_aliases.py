"""Offline rendered input + real parser/cache path; synthetic verse bodies only."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
import json
from pathlib import Path
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    supplements = json.loads((Path(__file__).resolve().parents[1] / 'docs/bible-supplement-books-20261016.json').read_text())['supplementBooks']
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1200, 'height': 850})
                page.on('pageerror', lambda e: print('PAGE ERROR', e, flush=True))
                page.set_default_timeout(7000)
                page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url.rsplit('/', 1)[0] + '/') else r.abort())
                page.goto(url, wait_until='load')
                page.wait_for_function("typeof parseLiveScriptureQuery==='function' && !document.body.classList.contains('ui-booting')")
                page.wait_for_function("getComputedStyle(document.querySelector('.mindex-boot')).visibility==='hidden'")
                page.evaluate('''supplements => {
                  const base=[{code:'GEN',koreanName:'창세기',englishName:'Genesis',chapterCount:50},
                    {code:'DAN',koreanName:'다니엘',englishName:'Daniel',chapterCount:12},
                    {code:'EST',koreanName:'에스더',englishName:'Esther',chapterCount:10}];
                  state.scriptureBooks=[...base,...supplements.map(b=>({code:b.id,koreanName:b.name,englishName:b.english,chapterCount:b.chapters,testament:'Deuterocanon / Apocrypha'}))];
                  state.bibleTranslations=[{id:'cog',name:'공동번역',metadata:{supplement_books:supplements}},
                    {id:'cognew',name:'공동번역 개정판',metadata:{supplement_books:supplements.filter(b=>!['GKE','DA1'].includes(b.id)),edition_books:base.map(b=>({id:b.code,name:b.koreanName,chapterOptions:Array.from({length:b.code==='DAN'?14:b.chapterCount},(_,i)=>({key:i+1,label:String(i+1)}))}))}},
                    {id:'gae',name:'개역개정',metadata:{}},
                    {id:'kjv',name:'King James Version (CrossWire 1769)',abbreviation:'KJV',metadata:{}}];
                  state.selectedBibleTranslationId='gae';state.presenter.serviceId='';
                  window.aliasReads=0;state.client={from(){aliasReads++;throw Error('Unexpected DB access')}};
                  state.bibleVerseCache=new Map();
                  for(const [id,book,ch,verse] of [['cog','TOB',1,1],['kjv','GEN',1,1],['cognew','DAN',14,1]]){
                    state.bibleVerseCache.set(bibleVerseCacheKey(id,book,ch),[{book_code:book,chapter:ch,verse,text:'검증용 본문 — 운영 성경 데이터가 아닙니다.'}]);
                  }
                  refs.detailPane.hidden=false;
                  refs.detailPane.innerHTML='<h2>성구 입력 검증 · 오프라인 fixture</h2>'+renderLiveScriptureControl('');
                }''', supplements)
                result = page.evaluate('''async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  for(const [name,code] of [['Tobit','TOB'],['Judith','JDT'],['Wisdom of Solomon','WSD'],['Sirach','SIR'],['Baruch','BAR'],['I Maccabees','1MA'],['Second Maccabees','2MA'],['Additions to Esther','GKE'],['다니엘 추가 본문','DA1']])check(findBibleBookByReferenceName(name)?.code===code,name);
                  check(findBibleTranslation('공동번역 개정')?.id==='cognew','revision alias');
                  check(findBibleTranslation('공동 번역')?.id==='cog','original identity');
                  check(findBibleTranslation('King James Version')?.id==='kjv','English edition');
                  check(parseLiveScriptureQuery('Genesis 1:1 King James Version (CrossWire 1769)').translation?.id==='kjv','full edition name over four words');
                  check(!findBibleTranslation('공동번역 2099'),'unknown revision');
                  for(const text of ['Tobit 99:1 공동번역','다니엘 추가 본문 1:1 공동번역','Tobit 1:1 개역개정','Additions to Esther 13`:8 개역개정','다니엘 14:1 개역개정','창세기 51:1'])check(!parseLiveScriptureQuery(text).reference,text);
                  check(parseLiveScriptureQuery('Additions to Esther 13`:8 공동번역').reference.chapter===1004,'literal chapter');
                  check(parseLiveScriptureQuery('다니엘 14:1 공동번역 개정').reference.chapter===14,'target edition chapter');
                  state.selectedBibleTranslationId='cognew';check(!parseLiveScriptureQuery('다니엘 14:1 개역개정').reference,'reader chapter count must not leak');state.selectedBibleTranslationId='gae';
                  check(!parseLiveScriptureQuery('다니엘 추가 본문 13:1 공동번역 개정').reference,'never map DA1 to DAN');
                  check(['창세기 1:1','창세기 2:1'].map(parseBibleReference).every(Boolean),'Array.map compatibility');
                  const saved=state.bibleTranslations;state.bibleTranslations=[...saved,{id:'other',name:'King James Version'}];
                  check(!findBibleTranslation('KJV other'),'unknown alias');
                  state.bibleTranslations=[...saved,{id:'duplicate',name:'공동번역 개정판'}];check(!findBibleTranslation('공동번역 개정'),'ambiguous identity');state.bibleTranslations=saved;
                  const invalid=parseBibleReference('Tobit 1:1');
                  check((await fetchServiceScriptureVerses(invalid,state.bibleTranslations[2])).length===0,'unsupported edition fetch');
                  check(aliasReads===0,'DB accessed');return 'PASS aliases, edition identity, literal chapters, no cross-book alignment, no DB access';
                }''')
                print(engine, result)
                field = page.locator('[data-live-scripture-input]')
                for query, expected in [('Tobit 1:1 공동번역','토비'),('Genesis 1:1 King James Version','창세기 1:1'),('다니엘 14:1 공동번역 개정','14:1')]:
                    field.fill(query)
                    field.press('Enter')
                    page.wait_for_function('(expected)=>state.presenter.liveScripture.active && state.presenter.liveScripture.slide.title.includes(expected)', arg=expected)
                    assert page.evaluate('aliasReads') == 0
                before = page.evaluate('JSON.stringify(state.presenter.liveScripture.slide)')
                field.fill('Tobit 99:1 공동번역');field.press('Enter')
                page.wait_for_function("document.body.innerText.includes('성구를 확인')")
                assert page.evaluate('JSON.stringify(state.presenter.liveScripture.slide)') == before
                page.screenshot(path=f'/tmp/mindex-scripture-aliases-{engine}.png')
                print(engine, 'PASS rendered input/Enter, invalid address preserves current output')
                browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
