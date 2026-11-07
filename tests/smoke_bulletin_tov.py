"""Test the Tov layout, editable weekly notes, and preservation through a real save/reload."""
import os
from pathlib import Path
from urllib.parse import urlsplit

os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

server, url = start_local_app_server()
output = Path("output/tov-bulletin")
output.mkdir(parents=True, exist_ok=True)
try:
    with sync_playwright() as playwright:
        for engine in ("chromium", "webkit"):
            browser = launch_chromium(playwright) if engine == "chromium" else playwright.webkit.launch()
            page = browser.new_page(viewport={"width": 1400, "height": 1100})
            page.route("**/*", lambda route: route.continue_() if route.request.method == "GET" and urlsplit(route.request.url).netloc == urlsplit(url).netloc else route.abort())
            page.route("**/tov-fixture.html", lambda route: route.fulfill(
                content_type="text/html",
                body='<meta charset="utf-8"><link rel="stylesheet" href="/styles.bulletin.css"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin-forest.js"></script><script src="/mindex.bulletin.js"></script><div id="editor"></div>'))
            page.goto(url.rsplit("/", 1)[0] + "/tov-fixture.html")
            page.evaluate(r"""() => {
                const B = MindexBulletin;
                window.source = B.resolveSource({
                    service: {id:'youth-week', service_type_id:'youth', service_date:'2026-11-08'},
                    calendar: [{date:'2026-11-08', youth_prayer:'학생 담당'}]
                });
                const labels = ['사도신경','찬양','찬양','찬양','대표기도','봉헌','봉헌기도','성경봉독','설교','결단기도','주기도문','광고'];
                source.order = labels.map((label,i) => ({
                    id:String(i), label, content:label==='찬양'?'테스트 찬양 '+i:label==='성경봉독'?'로마서 1:17':label==='설교'?'믿음으로 살아가기':label==='사도신경'?'출력에서 생략할 전문':'',
                    person:label==='대표기도'?'학생 담당':label==='설교'?'교사 담당':'다 같이'
                }));
                const fields = {news:'① 함께 모여 예배합니다.\n② 예배 후 소그룹으로 모입니다.',
                    outline:'믿음으로 말씀을 읽어요.', leader:'인도 교사',
                    staff:'회장 가나다 · 부회장 라마바 · 서기 사아자'};
                const previous = {...B.normalizeSnapshot({fields,settings:{design:'simple',theme:''}}),source};
                window.row = {service_id:source.id,revision:3,...B.storedValue(previous)};
                window.documents = new Map();window.saved = [];
                window.editor=B.mount(document.querySelector('#editor'),{
                    serviceId:source.id,services:[{id:source.id,label:'11/8 청소년부'},{id:'youth-new',label:'11/15 청소년부'}],
                    scope:'offline-tov',documents,loadSource:async(id)=>({...structuredClone(source),id}),
                    loadDraft:async(id)=>id===source.id?structuredClone(row):null,
                    saveDraft:async(id,value,revision)=>{
                        if(id!==row.service_id||revision!==row.revision)throw Error('Invalid revision');
                        saved.push(structuredClone(value));row={service_id:id,revision:revision+1,...value};return structuredClone(row);
                    }
                });
            }""")
            page.get_by_role("button", name="토브 양식 적용", exact=True).click()
            page.wait_for_function("document.querySelector('[data-bulletin-design=youth-tov]')")
            assert page.locator("[data-bulletin-design=youth-tov]").count() == 2
            assert page.locator("[data-bulletin-field=news]").input_value().startswith("① 함께")
            assert page.locator("[data-frame-id=staff]").text_content() == "회장 가나다 · 부회장 라마바 · 서기 사아자"
            assert "출력에서 생략할 전문" not in page.locator("[data-frame-id=order]").text_content()
            page.locator("[data-bulletin-field=scriptureNote]").fill("본문 노트의 직접 입력")
            page.locator("[data-bulletin-field=worshipPoint]").fill("말씀에 귀를 기울여요.")
            page.locator("[data-bulletin-field=reflection]").fill("받은 은혜 기록")
            page.locator("[data-bulletin-field=nextPrayer]").fill("다음번 기도 · 학생 담당")
            page.wait_for_function("document.querySelector('[data-bulletin-print]').disabled===false")
            assert page.evaluate("""() => {
                const value=MindexBulletin.storedValue(documents.get(source.id));
                const title=value.layout.frames.find(frame=>frame.id==='tovTitle');
                delete title.family;
                const legacy={};MindexBulletin.applyStored(legacy,{revision:3,...value});
                title.family='MindexBulletin';
                const custom={};MindexBulletin.applyStored(custom,{revision:3,...value});
                const family=doc=>doc.frames.find(frame=>frame.id==='tovTitle').family;
                return family(legacy)==='Paperlogy'&&family(custom)==='MindexBulletin';
            }""")
            assert page.locator('[data-frame-id=tovTitle] tspan').first.get_attribute('font-family') == 'Paperlogy'
            assert page.locator('[data-frame-id=order] text').first.get_attribute('font-family') == 'MindexBulletin'
            assert page.evaluate("""[...document.fonts].some(f=>f.family==='Paperlogy'&&f.status==='loaded')""")
            page.evaluate("""() => {
                window.printCalls=0;
                const {get}=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');
                Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{get(){
                    const w=get.call(this);
                    if(w)w.print=()=>{printCalls++;w.dispatchEvent(new w.Event('afterprint'));};
                    return w;
                }});
            }""")
            page.locator('[data-bulletin-print]').click()
            page.wait_for_function('printCalls===1')
            assert page.evaluate("""() => {
                const print=document.querySelector('iframe.bulletin-print-frame').contentDocument;
                return [...print.fonts].some(f=>f.family==='Paperlogy'&&f.status==='loaded')
                    &&print.querySelector('[data-frame-id=tovTitle] tspan').getAttribute('font-family')==='Paperlogy'
                    &&print.querySelector('[data-frame-id=order] text').getAttribute('font-family')==='MindexBulletin';
            }""")
            for index, name in enumerate(("outside", "inside")):
                page.locator("[data-bulletin-design=youth-tov]").nth(index).screenshot(path=str(output / f"{engine}-{name}.png"))
            page.evaluate("""() => {
                const doc=documents.get(source.id);
                const before=JSON.stringify(doc.source);
                const print=MindexBulletin.renderPages(doc,'print');
                if(print.issues.size||print.pages.length!==2||print.pages.some(svg=>svg.getAttribute('viewBox')!=='0 0 297 210'))throw Error('Invalid print pages');
                if(JSON.stringify(doc.source)!==before)throw Error('Source mutated');
                const overflow=MindexBulletin.renderPages({...doc,fields:{...doc.fields,scriptureNote:'긴 본문 '.repeat(500)}},'print');
                if(!overflow.issues.has('scriptureNote'))throw Error('Long note must block printing');
            }""")
            page.locator("[data-bulletin-save]").click()
            page.wait_for_function("saved.length===1&&!documents.get(source.id).dirty")
            assert page.evaluate("""saved[0].layout.design==='youth-tov'
                && JSON.stringify(saved[0].content.sourceSnapshot.weekly.order)===JSON.stringify(source.order)
                && saved[0].content.fields.staff==='회장 가나다 · 부회장 라마바 · 서기 사아자'""")
            page.evaluate("editor.reload()")
            page.wait_for_function("document.querySelector('[data-bulletin-field=scriptureNote]')?.disabled===false")
            assert page.locator("[data-bulletin-field=scriptureNote]").input_value() == "본문 노트의 직접 입력"
            page.locator("[data-bulletin-service]").select_option("youth-new")
            page.wait_for_function("documents.get('youth-new')?.settings.design==='youth-tov'&&document.querySelector('[data-bulletin-field=scriptureNote]')?.disabled===false")
            assert page.locator("[data-bulletin-field=scriptureNote]").input_value() == ""
            print("PASS Tov default, layout-only adoption, editable notes, officers, print overflow and CAS reload", engine, flush=True)
            browser.close()
finally:
    server.shutdown()
