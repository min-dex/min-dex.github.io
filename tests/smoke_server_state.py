"""Headless server-state persistence/recovery; fixture HTTP only, no live writes."""
import json
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

INIT = """async () => {
 const client={rpc:async(name,args)=>{
  if(!['mindex_state_read_v1','mindex_state_write_v1'].includes(name))return {data:[],error:null};
  const response=await fetch('/state-fixture/'+name,{method:'POST',body:JSON.stringify(args)});
  const result=await response.json();if(result.error)return {error:Error(result.error)};return result;
 }};
 state.client=client;state.auth.session={user:{id:'offline-fixture'}};state.connectionError='';
 await window.MINDEX_SERVER_STORAGE.initialize(client,'fixture');
 return window.MINDEX_SERVER_STORAGE.ready;
}"""

def choose_draft(page, text):
    select=page.get_by_label('복구할 임시 저장본',exact=True)
    for option in select.locator('option').all():
        select.select_option(option.get_attribute('value'))
        if text in page.get_by_label('복구할 내용',exact=True).input_value(): return
    raise AssertionError('Missing draft preview: '+text)

def main():
    server,url=start_local_app_server()
    origin=urlsplit(url).netloc
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                db={};control={'offline':False,'hold':False};held=[]
                def route_request(route):
                    request=route.request
                    if '/state-fixture/' in request.url:
                        if control['hold'] and request.url.endswith('mindex_state_write_v1'):
                            held.append(route);return
                        args=json.loads(request.post_data)
                        owner='shared' if args['p_scope']=='shared' else args['p_token']
                        scope=(owner,args['p_scope'])
                        if request.url.endswith('mindex_state_read_v1'):
                            data=[value for key,value in db.items() if key[:2]==scope]
                        elif control['offline']:
                            route.fulfill(json={'error':'offline'});return
                        else:
                            key=scope+(args['p_key'],);old=db.get(key)
                            if old and old['requestId']==args['p_request_id']: data=old
                            elif str(old['revision'] if old else '0')!=args['p_revision']:
                                route.fulfill(json={'error':'STATE_REVISION_CONFLICT'});return
                            else:
                                data={'key':args['p_key'],'value':args['p_value'],'revision':str(int(args['p_revision'])+1),'requestId':args['p_request_id']}
                                db[key]=data
                        route.fulfill(json={'data':data});return
                    if urlsplit(request.url).netloc==origin:route.continue_()
                    else:route.abort()
                try:
                    context=browser.new_context(reduced_motion="reduce")
                    context.add_init_script("window.open=()=>null;Element.prototype.requestFullscreen=()=>Promise.reject(Error('blocked fixture'));")
                    context.route('**/*',route_request)
                    page=context.new_page()
                    page.goto(url+'?mindexSmokeRaw=1&supabaseUrl=project_url&supabaseAnonKey=anon_key',wait_until='domcontentloaded')
                    page.wait_for_function('!!window.MINDEX_SERVER_STORAGE && typeof persistServerValue === "function" && !document.body.classList.contains("ui-booting")')
                    page.locator(".mindex-boot").wait_for(state="hidden")
                    page.evaluate("document.fonts.ready")
                    assert page.evaluate(INIT)
                    control['hold']=True
                    page.evaluate("()=>{window.quietSave=MINDEX_SERVER_STORAGE.setItem('session','mindex.quiet.fixture','pending')}")
                    page.wait_for_function('MINDEX_SERVER_STORAGE.pending')
                    page.wait_for_timeout(100)
                    assert page.locator('#serverStorageStatus').is_visible() is False
                    page.screenshot(path='/tmp/mindex-quiet-pending-'+engine+'.png')
                    control['hold']=False
                    for held_route in held: route_request(held_route)
                    held.clear()
                    page.evaluate('()=>window.quietSave')
                    page.wait_for_function('!!window.MINDEX_EDITOR_DRAFTS')
                    draft_result=page.evaluate("""async()=>{
                      cacheRefs();state.module='scripture';state.selectedScriptureId='fixture';
                      state.scriptures=[{id:'fixture',title:'Original',body:'Original text'}];
                      state.cleanFingerprints.scripture=dirtyModuleFingerprint('scripture');
                      state.scriptures[0].body='Unsaved draft';state.dirty.scripture=true;
                      window.MINDEX_EDITOR_DRAFTS.capture();await new Promise(queueMicrotask);
                      await window.MINDEX_SERVER_STORAGE.flush();
                      const key=MINDEX_SERVER_STORAGE.keys('local').find(k=>k.startsWith('mindex.editor.draft.v2:scripture:fixture:'));
                      const saved=JSON.parse(window.MINDEX_SERVER_STORAGE.getItem('local',key));
                      return {body:saved.value.body,local:localStorage.getItem('mindex.editor.draft.v1:scripture:fixture')};
                    }""")
                    assert draft_result=={'body':'Unsaved draft','local':None}
                    assert page.locator('#restoreServerEditorDraft').is_hidden()
                    # Slow acknowledgement must not advertise this session's older keystroke.
                    page.evaluate("""()=>{
                      const input=document.createElement('input');input.id='typingDraftFixture';
                      input.setAttribute('aria-label','임시본 입력 검사');input.style.cssText='position:fixed;top:150px;left:350px;width:240px;height:40px;z-index:999999;display:block';
                      input.value=state.scriptures[0].body;
                      input.oninput=()=>{state.scriptures[0].body=input.value;state.dirty.scripture=true;MINDEX_EDITOR_DRAFTS.capture()};
                      document.body.append(input);
                    }""")
                    control['hold']=True
                    for text in ('Typing A','Typing AB','Typing ABC'):
                        page.get_by_label('임시본 입력 검사',exact=True).fill(text)
                        assert page.locator('#restoreServerEditorDraft').evaluate('(e)=>e.hidden'), 'active draft flashed as recovery'
                    control['hold']=False
                    for held_route in held: route_request(held_route)
                    held.clear()
                    page.evaluate('()=>MINDEX_SERVER_STORAGE.flush()')
                    assert page.locator('#restoreServerEditorDraft').is_hidden()
                    page.get_by_label('임시본 입력 검사',exact=True).fill('Unsaved draft')
                    page.evaluate('()=>MINDEX_SERVER_STORAGE.flush()')
                    page.locator('#typingDraftFixture').evaluate('(e)=>e.remove()')
                    # A legacy recovery record is never rewritten by new-session typing.
                    page.evaluate("""async()=>{
                      const key=MINDEX_SERVER_STORAGE.keys('local').find(k=>k.startsWith('mindex.editor.draft.v2:scripture:fixture:'));
                      const draft=JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',key));draft.value.body='Legacy draft';
                      await MINDEX_SERVER_STORAGE.setItem('local','mindex.editor.draft.v1:scripture:fixture',JSON.stringify(draft));
                    }""")
                    page.evaluate("async()=>{await persistServerValue('local','mindex.worshipRecoverySnapshot.latest.v1.fixture','recovery');await persistServerValue('local','mindex.theme','dark')}")
                    assert page.evaluate("localStorage.getItem('mindex.worshipRecoverySnapshot.latest.v1.fixture')") is None
                    control['offline']=True
                    error=page.evaluate("async()=>{try{await persistServerValue('local','mindex.worshipRecoverySnapshot.latest.v1.fixture','newer');return ''}catch(e){return e.message}}")
                    assert error=='offline'
                    assert page.evaluate("safeStorageGet('local','mindex.worshipRecoverySnapshot.latest.v1.fixture')")=='recovery'
                    assert page.locator('#serverStorageStatus').is_visible()
                    assert page.get_by_role('button',name='다시 보관',exact=True).count()==1
                    page.screenshot(path='/tmp/mindex-quiet-failure-'+engine+'.png')
                    control['offline']=False
                    assert page.evaluate('()=>window.MINDEX_SERVER_STORAGE.retry()')
                    assert page.locator('#serverStorageStatus').is_visible() is False
                    assert page.evaluate("safeStorageGet('local','mindex.worshipRecoverySnapshot.latest.v1.fixture')")=='newer'
                    # A competing tab's confirmed value requires explicit choice, not blind retry.
                    conflict_key=next(key for key in db if key[2]=='mindex.worshipRecoverySnapshot.latest.v1.fixture')
                    db[conflict_key]={**db[conflict_key],'value':'other window','revision':str(int(db[conflict_key]['revision'])+1),'requestId':'other-window'}
                    error=page.evaluate("async()=>{try{await persistServerValue('local','mindex.worshipRecoverySnapshot.latest.v1.fixture','this window');return ''}catch(e){return e.message}}")
                    assert error=='STATE_REVISION_CONFLICT'
                    page.get_by_role('button',name='충돌 확인',exact=True).click()
                    page.get_by_role('dialog').wait_for()
                    assert page.get_by_label('이 창의 보관 요청',exact=True).input_value()=='this window'
                    assert page.get_by_label('서버 보관본',exact=True).input_value()=='other window'
                    page.screenshot(path='/tmp/mindex-state-conflict-'+engine+'.png')
                    control['offline']=True
                    page.get_by_role('button',name='이 창의 보관 요청 사용',exact=True).click()
                    page.wait_for_function("document.querySelector('.server-conflict-review [role=alert]').textContent.length>0")
                    assert db[conflict_key]['value']=='other window'
                    control['offline']=False
                    page.get_by_role('button',name='이 창의 보관 요청 사용',exact=True).click()
                    page.get_by_role('dialog').wait_for(state='detached')
                    assert db[conflict_key]['value']=='this window'
                    archives=[json.loads(value['value']) for key,value in db.items() if key[2].startswith('mindex.state.recovery.v1:')]
                    assert any(a['local']=='this window' and a['current']=='other window' for a in archives)
                    await_value=page.evaluate("async()=>{await persistServerValue('local','mindex.worshipRecoverySnapshot.latest.v1.fixture','newer');return true}")
                    assert await_value
                    page.goto(url+'?mindexSmokeRaw=1&supabaseUrl=project_url&supabaseAnonKey=anon_key',wait_until='domcontentloaded')
                    page.wait_for_function('!!window.MINDEX_SERVER_STORAGE && !document.body.classList.contains("ui-booting")')
                    assert page.evaluate(INIT)
                    assert page.evaluate("safeStorageGet('local','mindex.worshipRecoverySnapshot.latest.v1.fixture')")=='newer'
                    # Restore is an explicit editor action; the committed row is not saved.
                    page.wait_for_function('!!window.MINDEX_EDITOR_DRAFTS')
                    page.evaluate("""()=>{
                      cacheRefs();state.module='scripture';state.selectedScriptureId='fixture';
                      state.scriptures=[{id:'fixture',title:'Original',body:'Original text'}];
                      clearDirtyState();state.cleanFingerprints.scripture=dirtyModuleFingerprint('scripture');
                      render();MINDEX_EDITOR_DRAFTS.capture();
                    }""")
                    page.wait_for_function("document.getElementById('restoreServerEditorDraft')?.hidden===false")
                    preserved=page.evaluate("""async()=>{
                      const storage=MINDEX_SERVER_STORAGE,old=storage.getItem('local','mindex.editor.draft.v1:scripture:fixture');
                      state.scriptures[0].body='New edit before recovery';state.dirty.scripture=true;
                      MINDEX_EDITOR_DRAFTS.capture();await new Promise(queueMicrotask);await storage.flush();
                      return {legacy:old===storage.getItem('local','mindex.editor.draft.v1:scripture:fixture'),old:storage.keys('local').some(k=>k.startsWith('mindex.editor.draft.v2:')&&JSON.parse(storage.getItem('local',k)||'null')?.value?.body==='Unsaved draft')};
                    }""")
                    assert preserved=={'legacy':True,'old':True}

                    page.locator('#restoreServerEditorDraft').click()
                    choose_draft(page,'Unsaved draft')
                    page.once('dialog',lambda dialog:dialog.accept())
                    page.evaluate("""()=>{
                      window.originalArchiveWrite=MINDEX_SERVER_STORAGE.setItem;window.archiveFinished=false;let first=true;
                      MINDEX_SERVER_STORAGE.setItem=async(...args)=>{if(first){first=false;await new Promise(r=>window.releaseArchive=r)}const result=await originalArchiveWrite(...args);archiveFinished=true;return result};
                    }""")
                    page.get_by_role('button',name='편집창에 복구',exact=True).click()
                    page.wait_for_function('typeof releaseArchive==="function"')
                    page.get_by_role('button',name='닫기',exact=True).click()
                    page.locator('.editor-draft-review').wait_for(state='detached')
                    page.evaluate('releaseArchive()')
                    page.wait_for_function('archiveFinished')
                    assert page.evaluate("state.scriptures[0].body==='New edit before recovery'")
                    assert any(json.loads(v['value'] or '{}').get('value',{}).get('body')=='Unsaved draft' for k,v in db.items() if k[2].startswith('mindex.editor.draft.v2:'))
                    page.evaluate('()=>{MINDEX_SERVER_STORAGE.setItem=originalArchiveWrite}')
                    page.locator('#restoreServerEditorDraft').click()
                    choose_draft(page,'Unsaved draft')
                    page.once('dialog',lambda dialog:dialog.accept())
                    page.get_by_role('button',name='편집창에 복구',exact=True).click()
                    page.wait_for_function("state.scriptures[0].body==='Unsaved draft' && state.dirty.scripture")
                    assert page.evaluate("localStorage.getItem('mindex.editor.draft.v1:scripture:fixture')") is None
                    assert any(json.loads(value['value'] or '{}').get('value',{}).get('body')=='New edit before recovery' for key,value in db.items() if key[2].startswith('mindex.editor.draft.v2:'))
                    page.locator('#restoreServerEditorDraft').click()
                    choose_draft(page,'New edit before recovery')
                    for width in (1000,390):
                        page.set_viewport_size({'width':width,'height':900})
                        assert page.locator('.editor-draft-review').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
                        page.screenshot(path=f'/tmp/editor-draft-review-{engine}-{width}.png')
                    page.get_by_role('button',name='닫기',exact=True).click()
                    assert page.evaluate("state.scriptures[0].body==='Unsaved draft'")
                    # Changed originals no longer make recovery a dead end.
                    page.evaluate("""async()=>{
                      const key=MINDEX_SERVER_STORAGE.keys('local').find(k=>k.startsWith('mindex.editor.draft.v2:scripture:fixture:'));
                      const originalDraft=JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',key));
                      clearDirtyState();state.scriptures=[{id:'fixture',title:'New title',body:'Original text'}];
                      state.cleanFingerprints.scripture=dirtyModuleFingerprint('scripture');
                      render();MINDEX_EDITOR_DRAFTS.capture();await new Promise(queueMicrotask);
                      await MINDEX_SERVER_STORAGE.flush();
                      await MINDEX_SERVER_STORAGE.setItem('local','mindex.editor.draft.v1:scripture:fixture',JSON.stringify(originalDraft));
                    }""")
                    page.locator('#restoreServerEditorDraft').click()
                    choose_draft(page,'Unsaved draft')
                    page.once('dialog',lambda dialog:dialog.accept())
                    page.get_by_role('button',name='편집창에 복구',exact=True).click()
                    page.wait_for_function("state.scriptures[0].body==='Unsaved draft' && state.scriptures[0].title==='New title'")
                    assert any('mindex.editor.recovery.v1:' in key[2] for key in db)
                    # State is restored before the async caller closes/removes the dialog.
                    page.locator('.editor-draft-review').wait_for(state='detached')
                    assert page.locator('.editor-draft-review').count()==0
                    # Focus is one rounded container ring, not clipped inner edges.
                    page.locator('#searchInput').focus()
                    focus=page.locator('#searchInput').evaluate("e=>({inner:getComputedStyle(e).outlineStyle,ring:getComputedStyle(e.closest('.search-wrap')).outlineStyle})")
                    assert focus['inner']=='none' and focus['ring']=='solid',focus
                    page.screenshot(path='/tmp/mindex-recovery-search-'+engine+'.png')
                    # Another profile can see shared preferences, never the private recovery namespace.
                    other=browser.new_context();other.route('**/*',route_request)
                    other.add_init_script("window.open=()=>null;Element.prototype.requestFullscreen=()=>Promise.reject(Error('blocked fixture'));")
                    second=other.new_page();second.goto(url+'?mindexSmokeRaw=1&supabaseUrl=project_url&supabaseAnonKey=anon_key',wait_until='domcontentloaded')
                    second.wait_for_function('!!window.MINDEX_SERVER_STORAGE && typeof safeStorageGet === "function" && !document.body.classList.contains("ui-booting")');assert second.evaluate(INIT)
                    assert second.evaluate("safeStorageGet('local','mindex.theme')")=='dark'
                    assert second.evaluate("safeStorageGet('local','mindex.worshipRecoverySnapshot.latest.v1.fixture')")==''
                    print('PASS',engine,'server confirmed recovery, offline preservation/retry, reload and private/shared profile boundary')
                    other.close();context.close()
                finally:browser.close()
    finally:server.shutdown()

if __name__=='__main__':main()
