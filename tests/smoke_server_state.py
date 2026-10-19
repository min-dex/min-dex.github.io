"""Headless server-state persistence/recovery; fixture HTTP only, no live writes."""
import json
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

INIT = """async () => {
 const client={rpc:async(name,args)=>{
  const response=await fetch('/state-fixture/'+name,{method:'POST',body:JSON.stringify(args)});
  const result=await response.json();if(result.error)throw Error(result.error);return result;
 }};
 await window.MINDEX_SERVER_STORAGE.initialize(client,'fixture');
 return window.MINDEX_SERVER_STORAGE.ready;
}"""

def main():
    server,url=start_local_app_server()
    origin=urlsplit(url).netloc
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                db={};control={'offline':False}
                def route_request(route):
                    request=route.request
                    if '/state-fixture/' in request.url:
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
                    context=browser.new_context()
                    context.add_init_script("window.open=()=>null;Element.prototype.requestFullscreen=()=>Promise.reject(Error('blocked fixture'));")
                    context.route('**/*',route_request)
                    page=context.new_page()
                    page.goto(url+'?mindexSmokeRaw=1',wait_until='domcontentloaded')
                    page.wait_for_function('!!window.MINDEX_SERVER_STORAGE && typeof persistServerValue === "function" && !document.body.classList.contains("ui-booting")')
                    assert page.evaluate(INIT)
                    page.wait_for_function('!!window.MINDEX_EDITOR_DRAFTS')
                    draft_result=page.evaluate("""async()=>{
                      cacheRefs();state.module='scripture';state.selectedScriptureId='fixture';
                      state.scriptures=[{id:'fixture',title:'Original',body:'Original text'}];
                      state.cleanFingerprints.scripture=dirtyModuleFingerprint('scripture');
                      state.scriptures[0].body='Unsaved draft';state.dirty.scripture=true;
                      window.MINDEX_EDITOR_DRAFTS.capture();await new Promise(queueMicrotask);
                      await window.MINDEX_SERVER_STORAGE.flush();
                      const saved=JSON.parse(window.MINDEX_SERVER_STORAGE.getItem('local','mindex.editor.draft.v1:scripture:fixture'));
                      return {body:saved.value.body,local:localStorage.getItem('mindex.editor.draft.v1:scripture:fixture')};
                    }""")
                    assert draft_result=={'body':'Unsaved draft','local':None}
                    page.evaluate("async()=>{await persistServerValue('local','mindex.worshipRecoverySnapshot.latest.v1.fixture','recovery');await persistServerValue('local','mindex.theme','dark')}")
                    assert page.evaluate("localStorage.getItem('mindex.worshipRecoverySnapshot.latest.v1.fixture')") is None
                    control['offline']=True
                    error=page.evaluate("async()=>{try{await persistServerValue('local','mindex.worshipRecoverySnapshot.latest.v1.fixture','newer');return ''}catch(e){return e.message}}")
                    assert error=='offline'
                    assert page.evaluate("safeStorageGet('local','mindex.worshipRecoverySnapshot.latest.v1.fixture')")=='recovery'
                    assert page.locator('#serverStorageStatus').is_visible()
                    control['offline']=False
                    assert page.evaluate('()=>window.MINDEX_SERVER_STORAGE.retry()')
                    assert page.evaluate("safeStorageGet('local','mindex.worshipRecoverySnapshot.latest.v1.fixture')")=='newer'
                    page.reload(wait_until='domcontentloaded')
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
                    page.once('dialog',lambda dialog:dialog.accept())
                    page.locator('#restoreServerEditorDraft').click()
                    page.wait_for_function("state.scriptures[0].body==='Unsaved draft' && state.dirty.scripture")
                    assert page.evaluate("localStorage.getItem('mindex.editor.draft.v1:scripture:fixture')") is None
                    # Another profile can see shared preferences, never the private recovery namespace.
                    other=browser.new_context();other.route('**/*',route_request)
                    other.add_init_script("window.open=()=>null;Element.prototype.requestFullscreen=()=>Promise.reject(Error('blocked fixture'));")
                    second=other.new_page();second.goto(url+'?mindexSmokeRaw=1',wait_until='domcontentloaded')
                    second.wait_for_function('!!window.MINDEX_SERVER_STORAGE');assert second.evaluate(INIT)
                    assert second.evaluate("safeStorageGet('local','mindex.theme')")=='dark'
                    assert second.evaluate("safeStorageGet('local','mindex.worshipRecoverySnapshot.latest.v1.fixture')")==''
                    print('PASS',engine,'server confirmed recovery, offline preservation/retry, reload and private/shared profile boundary')
                    other.close();context.close()
                finally:browser.close()
    finally:server.shutdown()

if __name__=='__main__':main()
