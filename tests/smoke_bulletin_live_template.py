"""Server-only presentation changes preserve authored fields and defer while editing."""
import os
from urllib.parse import urlsplit
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
from smoke_app import start_local_app_server, sync_playwright, launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ("chromium","webkit"):
   browser=launch_chromium(p) if engine=="chromium" else p.webkit.launch()
   page=browser.new_page(viewport={"width":1500,"height":1000})
   origin=urlsplit(url).netloc
   def route(r):
    if urlsplit(r.request.url).netloc==origin:r.continue_()
    else:r.abort()
   page.route("**/*",route)
   page.route("**/live-template-fixture.html",lambda r:r.fulfill(content_type="text/html",body='<meta charset=utf-8><link rel=stylesheet href="/styles.bulletin.css"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin-forest.js"></script><script src="/mindex.bulletin.js"></script><div id=host style="height:100vh"></div>'))
   page.goto(url.rsplit("/",1)[0]+"/live-template-fixture.html")
   for department,design,key,field in (("youth","youth-tov","youth-tov","outline"),("children","children-forest","children-forest","memoryVerse"),("young-adult","simple","young-adult-2027","outline")):
    page.evaluate("""({department,design,key,field})=>{
      window.editor?.destroy();
      const B=MindexBulletin;
      window.source=B.resolveSource({service:{id:'fixture',service_type_id:department==='young-adult'?'young_adult':department,service_date:'2026-11-22'}});
      source.order=[{id:'order',label:'설교',content:'테스트',person:'담당'}];
      const doc={...B.normalizeSnapshot({settings:{design,theme:''},fields:{news:'작성한 소식',welcome:'직접 쓴 환영',[field]:'**기존 내용**'}}),source};
      window.row={template_key:key,revision:1,...B.templateValue(doc)};
      window.savedRow={revision:4,...B.storedValue(doc)};
      window.docs=new Map();window.writes=0;window.blocked=false;window.holdTemplate=false;
      window.editor=B.mount(document.querySelector('#host'),{serviceId:'fixture',scope:'live-'+department,documents:docs,services:[{id:'fixture',label:'이번 주'}],
       loadSource:async()=>structuredClone(source),loadDraft:async()=>structuredClone(savedRow),
       loadTemplate:async()=>{const captured=structuredClone(row);if(holdTemplate)await new Promise(r=>window.releaseTemplate=r);return captured;},
       saveDraft:async(id,value,revision)=>{if(revision!==savedRow.revision)throw Error('revision');writes++;return savedRow={revision:revision+1,...structuredClone(value)};},
       saveTemplate:async(id,value,revision)=>{if(revision!==row.revision)throw Error('revision');return row={template_key:id,revision:revision+1,...structuredClone(value)};},
       remoteBlocked:()=>blocked});
    }""",dict(department=department,design=design,key=key,field=field))
    page.wait_for_function("docs.get('fixture')?.settings.templateRevision===1 && document.querySelector('[data-bulletin-template-edit]').disabled===false")
    # Controls persist metadata through the same server common-template save.
    page.locator("[data-bulletin-template-edit]").click()
    page.wait_for_function("document.querySelector('[data-bulletin-editor-key]')")
    page.get_by_text("입력칸 설정",exact=True).click()
    page.locator("[data-bulletin-editor-key]").select_option(field)
    page.locator("[data-bulletin-editor-label]").fill("말씀 정리")
    page.locator("[data-bulletin-editor-visible]").uncheck()
    page.locator("[data-bulletin-save]").click()
    page.wait_for_function("row.revision===2")
    assert page.evaluate("row.layout.editorFields",) == {field:{"label":"말씀 정리","visible":False}}
    page.locator("[data-bulletin-template-exit]").click()
    page.wait_for_function("docs.get('fixture')?.settings.templateRevision===2")
    assert page.locator("[data-bulletin-field="+field+"]").count()==0
    assert page.evaluate("writes")==0
    assert page.evaluate("(field)=>docs.get('fixture').fields[field]",field)=="**기존 내용**"
    # Re-show and rename without changing any stored field key/value.
    page.evaluate("""field=>{row.revision++;row.layout.editorFields[field].visible=true;}""",field)
    assert page.evaluate("(key)=>editor.refreshRemote('bulletin-template',key)",key)
    assert page.locator("[data-bulletin-field="+field+"]").input_value()=="**기존 내용**"
    assert "말씀 정리" in page.locator("[data-bulletin-field="+field+"]").locator("..").inner_text()
    # In-flight user input, dirty state and output/print guards delay adoption.
    page.evaluate("row.revision++;row.layout.editorFields.outline={label:'늦게 도착한 이름',visible:true};holdTemplate=true")
    page.evaluate("(key)=>{window.refreshing=editor.refreshRemote('bulletin-template',key)}",key)
    page.locator("[data-bulletin-field="+field+"]").fill("지금 작성 중")
    page.evaluate("releaseTemplate();holdTemplate=false")
    page.wait_for_function("docs.get('fixture').dirty")
    page.evaluate("""field=>{row.revision++;row.layout.editorFields[field].label='새 이름';}""",field)
    assert not page.evaluate("(key)=>editor.refreshRemote('bulletin-template',key)",key)
    assert page.locator("[data-bulletin-field="+field+"]").input_value()=="지금 작성 중"
    page.locator("[data-bulletin-save]").click()
    page.wait_for_function("writes===1&&!docs.get('fixture').dirty")
    page.evaluate("blocked=true")
    assert not page.evaluate("(key)=>editor.refreshRemote('bulletin-template',key)",key)
    page.evaluate("blocked=false")
    assert page.evaluate("(key)=>editor.refreshRemote('bulletin-template',key)",key)
    assert page.locator("[data-bulletin-field="+field+"]").input_value()=="지금 작성 중"
    assert "새 이름" in page.locator("[data-bulletin-field="+field+"]").locator("..").inner_text()
    assert page.evaluate("docs.get('fixture').fields.welcome")== "직접 쓴 환영"
    page.evaluate("editor.destroy()")
    print("PASS",engine,department,"server labels/visibility, common save, delayed live adoption and original text",flush=True)
   browser.close()
finally:
 server.shutdown()
