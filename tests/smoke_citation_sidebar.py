"""Offline live-scripture sidebar placement, focus, draft and scroll regression."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page(viewport={'width':1440,'height':900})
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url+'?mindexSmokeRaw=1', wait_until='load')
            page.wait_for_function("typeof renderPresenterDetail === 'function'")
            page.evaluate('''() => {
              const service={id:'citation-sidebar',type_id:'young-adult',date:'2026-10-11',title:'테스트'};
              state.module='presenter';state.selectedServiceId=service.id;
              state.services=[service];state.serviceTypes=[{id:'young-adult',name:'청년부 예배'}];
              state.serviceItems={[service.id]:[{id:'citation',service_id:service.id,label:'인용 구절',sort_order:0,memo:JSON.stringify({elementType:'scripture_body'})}]};
              state.serviceError='';state.connectionError='';
              document.body.classList.remove('ui-booting');document.body.dataset.module='presenter';
              renderPresenterDetail();
            }''')
            page.wait_for_timeout(200)
            for width,height in [(1440,900),(1000,600),(390,700)]:
                page.set_viewport_size({'width':width,'height':height})
                result=page.evaluate('''() => {
                  const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
                  const sidebar=refs.rightSidebar;
                  const input=sidebar.querySelector('[data-presenter-citation-reference-input]');
                  assert(input,'sidebar input missing');
                  assert(document.querySelectorAll('[data-presenter-citation-reference-input]').length===1,'duplicate input');
                  const composer=input.closest('.svc-citation-composer');
                  const rail=sidebar.querySelector('.svc-presenter-input-rail');
                  assert(composer.getBoundingClientRect().bottom<=rail.getBoundingClientRect().top+1,'input order/overlap');
                  assert(sidebar.scrollWidth<=sidebar.clientWidth+1,'sidebar overflow');
                  input.value='요 15:9';input.focus({preventScroll:true});input.setSelectionRange(2,4);
                  const paneScroll=refs.detailPane.scrollTop,sideScroll=sidebar.scrollTop;
                  renderPresenterDetail();
                  const retained=sidebar.querySelector('[data-presenter-citation-reference-input]');
                  assert(retained.value==='요 15:9','draft lost');
                  assert(document.activeElement===retained && retained.selectionStart===2 && retained.selectionEnd===4,'focus/caret lost');
                  assert(refs.detailPane.scrollTop===paneScroll && sidebar.scrollTop===sideScroll,'scroll changed');
                  const checkbox=sidebar.querySelector('[data-presenter-citation-auto-output]');
                  checkbox.focus({preventScroll:true});checkbox.click();
                  renderPresenterDetail();
                  assert(!sidebar.querySelector('[data-presenter-citation-auto-output]').checked,'toggle lost');
                  assert(sidebar.querySelector('[data-presenter-citation-reference-input]').value==='요 15:9','unfocused draft lost');
                  document.querySelector('[data-presenter-citation-focus]').click();
                  assert(document.activeElement===sidebar.querySelector('[data-presenter-citation-reference-input]'),'shortcut focus');
                  if(!sidebar.querySelector('[data-presenter-citation-auto-output]').checked) sidebar.querySelector('[data-presenter-citation-auto-output]').click();
                  renderPresenterDetail();
                  return {width:innerWidth,composerHeight:composer.getBoundingClientRect().height};
                }''')
                print('PASS',engine,result,flush=True)
                if width==1440:
                    page.screenshot(path='/tmp/mindex-citation-sidebar-desktop.png')
            page.screenshot(path='/tmp/mindex-citation-sidebar.png')
            browser.close()
finally:
    server.shutdown()
