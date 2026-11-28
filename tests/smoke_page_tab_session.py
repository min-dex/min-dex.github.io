import os
from pathlib import Path

os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as playwright:
        for engine in ("chromium", "webkit"):
            browser = launch_chromium(playwright) if engine == "chromium" else playwright.webkit.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.route("**/app.runtime.js*", lambda route: route.fulfill(
                path=str(Path(__file__).resolve().parents[1] / "app.js"),
                content_type="text/javascript",
            ))
            page.goto(url + "?mindexSmokeRaw=1", wait_until="load")
            page.wait_for_function("!!window.MINDEX_PAGE_TAB_SESSION")
            result = page.evaluate("""async () => {
              const check=(value,message)=>{if(!value)throw Error(message)};
              const originalRender=render;
              const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
              const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
              state.pageTabs=[{id:'tab-a',snapshot:{module:'service',selectedServiceId:a}},{id:'tab-b',snapshot:{module:'service',selectedServiceId:b}}];
              state.pageTabIndex=0;state.module='service';state.selectedServiceId=a;
              state.services=[{id:a,title:'A saved',type_id:'test'},{id:b,title:'B saved',type_id:'test'}];
              state.serviceItems={[a]:[{id:'a-item',memo:'saved'}],[b]:[{id:'b-item',memo:'saved'}]};
              state.serviceTypes=[{id:'test'}];
              const mount=()=>{refs.detailPane.innerHTML='<div style="height:2000px"><textarea id="tabDraft" data-initial-value="saved"></textarea></div>';};
              document.body.classList.remove('ui-booting');document.documentElement.classList.remove('ui-booting');document.body.dataset.module='service';
              render=mount;mount();refs.detailPane.style.display='block';refs.detailPane.style.height='100px';refs.detailPane.style.overflow='auto';
              state.services[0].title='A unsaved';state.serviceItems[a][0].memo='A memo';state.dirty.service=true;
              const field=document.getElementById('tabDraft');field.value='A typing';field.focus();field.setSelectionRange(2,6);refs.detailPane.scrollTop=80;
              MINDEX_PAGE_TAB_SESSION.capture();

              clearDirtyState();state.pageTabIndex=1;state.selectedServiceId=b;mount();
              state.services[1].title='B unsaved';state.serviceItems[b][0].memo='B memo';state.dirty.service=true;
              document.getElementById('tabDraft').value='B typing';refs.detailPane.scrollTop=20;
              MINDEX_PAGE_TAB_SESSION.capture();

              clearDirtyState();state.pageTabIndex=0;state.selectedServiceId=a;MINDEX_PAGE_TAB_SESSION.restore(state.pageTabs[0]);
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const restored=document.getElementById('tabDraft');
              check(state.services.find(row=>row.id===a).title==='A unsaved','service draft');
              check(state.serviceItems[a][0].memo==='A memo'&&state.dirty.service,'item/dirty');
              check(restored.value==='A typing'&&restored.selectionStart===2&&restored.selectionEnd===6,'field/caret '+JSON.stringify({value:restored.value,start:restored.selectionStart,end:restored.selectionEnd,active:document.activeElement?.id}));
              check(refs.detailPane.scrollTop===80,'viewport');
              state.pageTabIndex=1;state.selectedServiceId=b;MINDEX_PAGE_TAB_SESSION.restore(state.pageTabs[1]);
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              check(state.services.find(row=>row.id===b).title==='B unsaved','second draft');
              check(document.getElementById('tabDraft').value==='B typing'&&refs.detailPane.scrollTop===20,'second view');
              const originalApply=applyPageTabSnapshot,originalConfirm=confirmSaveBeforeLeaving;
              let prompted=false;confirmSaveBeforeLeaving=async()=>{prompted=true;return false};
              applyPageTabSnapshot=async index=>MINDEX_PAGE_TAB_SESSION.restore(state.pageTabs[index]);
              state.pageTabIndex=0;state.selectedServiceId=a;MINDEX_PAGE_TAB_SESSION.restore(state.pageTabs[0]);
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              await activatePageTab(1);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              check(!prompted&&state.pageTabIndex===1&&document.getElementById('tabDraft').value==='B typing','tab switch requested save or lost target');
              applyPageTabSnapshot=originalApply;confirmSaveBeforeLeaving=originalConfirm;
              render=originalRender;return 'PASS';
            }""")
            print(engine, result, flush=True)
            browser.close()
finally:
    server.shutdown()
