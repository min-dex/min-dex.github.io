from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url+'?mindexSmokeRaw=1', wait_until='domcontentloaded')
                page.wait_for_function("typeof handleSaveShortcut === 'function'")
                print(engine, page.evaluate('''async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const original=saveAll;
                  let calls=0;
                  saveAll=async()=>{calls++};
                  const field=document.createElement('textarea');
                  document.body.append(field);
                  field.addEventListener('keydown',e=>e.stopPropagation());
                  field.focus();
                  for(const options of [{key:'s',metaKey:true},{key:'s',ctrlKey:true},{key:'ㄴ',code:'KeyS',metaKey:true}]) {
                    const before=calls;
                    const e=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,...options});
                    field.dispatchEvent(e);
                    check(calls===before+1,'save shortcut lost or duplicated');
                    check(e.defaultPrevented,'browser save not prevented');
                  }
                  for(const options of [{key:'s'},{key:'s',metaKey:true,altKey:true},{key:'s',metaKey:true,shiftKey:true},{key:'s',metaKey:true,repeat:true},{key:'s',metaKey:true,isComposing:true},{key:'s',ctrlKey:true,keyCode:229}]) {
                    const before=calls;
                    field.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,...options}));
                    check(calls===before,'unintended save');
                  }
                  field.remove();
                  let liveCalls=0,jumpCalls=0;
                  runLiveScriptureAction=()=>{liveCalls++};jumpPresenterToSlideInput=()=>{jumpCalls++};clearPresenterJumpDraft=()=>{jumpCalls++};
                  for(const attr of ['data-live-scripture-input','data-presenter-jump-input','data-presenter-citation-reference-input']){
                    const input=document.createElement('input');input.setAttribute(attr,'');input.value='조합 초안';document.body.append(input);input.focus();input.setSelectionRange(1,3);
                    for(const options of [{key:'Enter',isComposing:true},{key:'Escape',isComposing:true},{key:'Enter',keyCode:229},{key:'Escape',keyCode:229}]){
                      const event=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,...options});
                      Object.defineProperty(event,'target',{value:input});handleDetailKeydown(event);
                      check(!event.defaultPrevented&&input.value==='조합 초안'&&input.selectionStart===1,'IME draft/caret changed');
                    }
                    check(liveCalls===0&&jumpCalls===0,'IME output/jump command');input.remove();
                  }
                  const query='조합검색';state.search=query;state.module='praise';let resolves,lookups=0,navigations=0;
                  getScriptureSearchShortcut=()=>{lookups++;return new Promise(r=>resolves=r)};runScriptureSearchShortcut=async()=>{navigations++};
                  await handleSearchKeydown({key:'Enter',isComposing:true});await handleSearchKeydown({key:'Enter',keyCode:229});check(!lookups,'IME search request');
                  const waiting=handleSearchKeydown({key:'Enter',preventDefault(){}});state.search='수정검색';resolves({type:'reference'});await waiting;check(!navigations,'stale query navigation');
                  saveAll=original;
                  state.module='presenter';
                  state.selectedServiceId='shortcut-fixture';
                  state.services=[{id:'shortcut-fixture'}];
                  state.dirty.service=false;
                  state.saving=false;
                  presenterViewServiceId=()=>state.selectedServiceId;
                  let saved='';
                  saveService=async id=>{saved=id;return true};
                  check(await saveAll()===true && saved==='shortcut-fixture','clean flag skipped pending input commit');
                  field.remove();
                  return 'PASS capture routing, Korean key, Ctrl/Cmd, repeat guard, pending-input save routing';
                }'''))
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
