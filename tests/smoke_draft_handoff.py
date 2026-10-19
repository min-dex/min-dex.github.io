"""Independent browser profiles: private handoff updates never replace editing state."""
import json
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server();origin=urlsplit(url).netloc
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   db={}
   def route(route):
    req=route.request
    if '/handoff-fixture/' in req.url:
     a=json.loads(req.post_data)
     if 'p_scope' not in a:route.fulfill(json={'data':None});return
     owner='shared' if a['p_scope']=='shared' else a['p_token'];scope=(owner,a['p_scope'])
     if req.url.endswith('mindex_state_read_v1'):data=[v for k,v in db.items() if k[:2]==scope]
     else:
      key=scope+(a['p_key'],);old=db.get(key)
      if old and old['requestId']==a['p_request_id']:data=old
      elif (old['revision'] if old else '0')!=a['p_revision']:route.fulfill(json={'error':'STATE_REVISION_CONFLICT'});return
      else:data={'key':a['p_key'],'value':a['p_value'],'revision':str(int(a['p_revision'])+1),'requestId':a['p_request_id']};db[key]=data
     route.fulfill(json={'data':data});return
    if urlsplit(req.url).netloc==origin:route.continue_()
    else:route.abort()
   try:
    pages=[]
    for profile_index in range(2):
     context=browser.new_context();context.route('**/*',route)
     context.add_init_script("Element.prototype.requestFullscreen=()=>Promise.reject(Error('fixture'));localStorage.setItem('mindex.handoff.identity:fixture','"+('a' if profile_index==0 else 'b')*64+"');")
     page=context.new_page();page.goto(url+'?mindexSmokeRaw=1',wait_until='domcontentloaded')
     page.wait_for_function('!!window.MINDEX_DRAFT_HANDOFF&&!document.body.classList.contains("ui-booting")')
     page.evaluate('''async()=>{
      state.config.url='fixture';state.client={rpc:async(name,args)=>{const r=await fetch('/handoff-fixture/'+name,{method:'POST',body:JSON.stringify(args)});const out=await r.json();if(out.error)throw Error(out.error);return out;}};
      state.module='scripture';state.selectedScriptureId='fixture';state.scriptures=[{id:'fixture',title:'Test document',body:'Original'}];
      cacheRefs();state.cleanFingerprints.scripture=dirtyModuleFingerprint('scripture');
      await MINDEX_SERVER_STORAGE.initialize(state.client,'fixture');
     }''')
     page.wait_for_selector('#draftHandoffButton');pages.append(page)
    a,b=pages
    a.evaluate("()=>{state.scriptures[0].body='Draft from A';state.dirty.scripture=true;MINDEX_EDITOR_DRAFTS.capture();}")
    a.wait_for_function("document.querySelector('#draftHandoffButton').textContent.includes('1')")
    b.evaluate('()=>MINDEX_DRAFT_HANDOFF.refresh()')
    assert '1' not in b.locator('#draftHandoffButton').inner_text()
    b.click('#draftHandoffButton');b.get_by_text('다른 기기 연결',exact=True).click()
    b.get_by_label('다른 기기 연결 코드').fill(json.dumps({'mindexDraft':1,'project':'wrong','token':'a'*64}))
    b.get_by_role('button',name='이 기기 연결',exact=True).click()
    b.wait_for_function("document.querySelector('[data-handoff-status]').textContent.includes('같은 프로젝트')")
    b.get_by_label('다른 기기 연결 코드').fill(json.dumps({'mindexDraft':1,'project':'fixture','token':'a'*64}))
    b.get_by_role('button',name='이 기기 연결',exact=True).click()
    b.wait_for_function("document.querySelector('[data-handoff-status]').textContent.includes('기기를 연결')")
    b.get_by_role('button',name='닫기',exact=True).click()
    b.wait_for_function("document.querySelector('#draftHandoffButton').textContent.includes('1')")
    assert b.evaluate('state.scriptures[0].body')=='Original'
    # Remote draft is offered explicitly; current edit must remain intact.
    b.evaluate("()=>{state.scriptures[0].body='B still typing';state.dirty.scripture=true;}")
    b.click('#draftHandoffButton');b.get_by_role('button',name='이 초안 이어쓰기',exact=True).click()
    assert b.evaluate('state.scriptures[0].body')=='B still typing'
    b.get_by_role('button',name='닫기',exact=True).click()
    b.evaluate("()=>{state.scriptures[0].body='Original';state.dirty.scripture=false;}")
    b.on('dialog',lambda d:d.accept());b.click('#draftHandoffButton');b.get_by_role('button',name='이 초안 이어쓰기',exact=True).click()
    b.wait_for_function("state.scriptures[0].body==='Draft from A'")
    assert b.evaluate('state.dirty.scripture')
    assert a.evaluate('state.scriptures[0].body')=='Draft from A'
    # Restoring only changes an editor; no committed document API is available.
    assert all(k[2].startswith(('mindex.handoff.','mindex.editor.')) for k in db)
    print('PASS',engine,'separate profiles, explicit recovery, dirty-edit preservation and no committed-row writes',flush=True)
   finally:browser.close()
finally:server.shutdown();server.server_close()
