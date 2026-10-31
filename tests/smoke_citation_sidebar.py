"""Offline live-scripture sidebar placement, focus, draft and scroll regression."""
from pathlib import Path
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page(viewport={'width':1440,'height':900})
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
            page.goto(url+'?mindexSmokeRaw=1', wait_until='load')
            page.wait_for_function("typeof renderPresenterDetail === 'function' && !document.body.classList.contains('ui-booting')")
            page.evaluate('''() => {
              const service={id:'citation-sidebar',type_id:'young-adult',date:'2026-10-11',title:'테스트'};
              state.client=state.client||{};state.auth.session={user:{id:'offline-fixture'}};state.connectionError='';
      state.module='presenter';state.selectedServiceId=service.id;state.loadedWorshipServiceIds=new Set([service.id]);
              state.services=[service];state.serviceTypes=[{id:'young-adult',name:'청년부 예배'}];
              state.serviceItems={[service.id]:[{id:'citation',service_id:service.id,label:'인용 구절',sort_order:0,memo:JSON.stringify({elementType:'scripture_body'})}]};
              state.serviceError='';state.connectionError='';
              document.body.classList.remove('ui-booting');document.body.dataset.module='presenter';
              renderServiceList();renderPresenterDetail();
            }''')
            # Flush and await actual registered rail transitions, which Linux WebKit may start after the fixture task.
            page.wait_for_function("document.body.getAnimations().every(a=>!a.pending&&a.playState!=='running')")
            for theme in ('dark','light'):
                page.evaluate('(theme)=>document.body.dataset.theme=theme',theme)
                for width,height in [(1440,900),(1000,600),(768,700),(390,700),(320,700)]:
                    page.set_viewport_size({'width':width,'height':height})
                    page.wait_for_function("document.body.getAnimations().every(a=>!a.pending&&a.playState!=='running')")
                    result=page.evaluate('''async () => {
                      const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const sidebar=refs.rightSidebar;
                      const toolbar=document.querySelector('.svc-presenter-toolbar');
                      const input=toolbar.querySelector('[data-presenter-citation-reference-input]');
                      assert(input,'toolbar input missing');
                      assert(document.querySelectorAll('[data-presenter-citation-reference-input]').length===1,'duplicate input');
                      const composer=input.closest('.svc-citation-composer');
                      const rail=refs.songList.querySelector('.svc-presenter-input-rail');
                      const preview=sidebar.querySelector('.svc-presenter-live-panel');
                      assert(!sidebar.querySelector('[data-presenter-citation-reference-input]'),'sidebar duplicate');
                      assert(toolbar.contains(composer)&&toolbar.scrollWidth<=toolbar.clientWidth+1,'toolbar overflow');
                      assert(composer.querySelector('.svc-citation-composer-heading > span').getClientRects().length,'label hidden');
                      assert(rail&&!sidebar.querySelector('.svc-presenter-input-rail'),'order input belongs to left rail '+JSON.stringify({rail:!!rail,side:!!sidebar.querySelector('.svc-presenter-input-rail'),list:refs.songList.innerHTML.slice(0,500)}));
                      assert(innerWidth<1000||sidebar.clientWidth>0,'desktop sidebar collapsed');
                      assert(sidebar.scrollWidth<=sidebar.clientWidth+1,'sidebar overflow');
                      input.value='요 15:9';input.focus({preventScroll:true});input.setSelectionRange(2,4);
                      const paneScroll=refs.detailPane.scrollTop,sideScroll=sidebar.scrollTop;
                      const append=appendPresenterCitationReference;let submissions=0;
                      appendPresenterCitationReference=()=>{submissions++};
                      input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
                      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true}));
                      renderPresenterDetail();
                      input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
                      assert(submissions===0,'IME submitted scripture');
                      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
                      assert(submissions===1,'toolbar Enter lost handler');appendPresenterCitationReference=append;
                      const retained=document.querySelector('.svc-presenter-toolbar [data-presenter-citation-reference-input]');
                      assert(retained===input&&retained.value==='요 15:9','DOM owner or draft lost');
                      assert(document.activeElement===retained && retained.selectionStart===2 && retained.selectionEnd===4,'focus/caret lost');
                      assert(refs.detailPane.scrollTop===paneScroll && sidebar.scrollTop===sideScroll,'scroll changed');
                      const checkbox=document.querySelector('.svc-presenter-toolbar [data-presenter-citation-auto-output]');
                      checkbox.focus({preventScroll:true});checkbox.click();
                      renderPresenterDetail();
                      assert(!document.querySelector('.svc-presenter-toolbar [data-presenter-citation-auto-output]').checked,'toggle lost');
                      assert(document.querySelector('.svc-presenter-toolbar [data-presenter-citation-reference-input]').value==='요 15:9','unfocused draft lost');
                      document.querySelector('[data-presenter-citation-focus]').click();
                      assert(document.activeElement===document.querySelector('.svc-presenter-toolbar [data-presenter-citation-reference-input]'),'shortcut focus');
                      if(!document.querySelector('.svc-presenter-toolbar [data-presenter-citation-auto-output]').checked) document.querySelector('.svc-presenter-toolbar [data-presenter-citation-auto-output]').click();
                      renderPresenterDetail();
                      if(innerWidth>=1000){
                        const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                        refs.detailPane.scrollTop=400;await frame();const top=toolbar.getBoundingClientRect().top;
                        refs.detailPane.scrollTop+=50;await frame();
                        assert(Math.abs(toolbar.getBoundingClientRect().top-top)<2,'toolbar unpinned while scrolling');
                        assert(presenterViewportStickyTopOffset(refs.detailPane)>=toolbar.getBoundingClientRect().height,'scroll offset omits composer');
                        renderPresenterDetail();assert(document.querySelector('[data-presenter-citation-reference-input]')===input&&input.value==='요 15:9','scroll refresh lost draft owner');
                        refs.detailPane.scrollTop=0;
                      }
                      return {width:innerWidth,composerHeight:composer.getBoundingClientRect().height};
                    }''')
                    print('PASS',engine,theme,result,flush=True)
                    if width==1440:
                        page.screenshot(path=f'/tmp/mindex-toolbar-{engine}-{theme}-desktop.png')
                page.screenshot(path=f'/tmp/mindex-toolbar-{engine}-{theme}-narrow.png')
            browser.close()
finally:
    server.shutdown()
