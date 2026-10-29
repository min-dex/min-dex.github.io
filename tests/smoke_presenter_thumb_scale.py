"""Controller slide size setting: applies to the board only, persists, and never reaches the output window."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright, prepare_server_state_fixture


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
                page = ctx.new_page()
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof setPresenterThumbScale === 'function'")
                prepare_server_state_fixture(page)
                print(engine, page.evaluate('''async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const host=document.createElement('div'); host.id='scale-host';
                  host.innerHTML=renderPresenterThumbScaleControl()+'<div class="svc-board-grid" id="g" style="display:block"><i id="probe" style="display:block;height:1px;width:var(--svc-thumb-width)"></i></div>';
                  document.body.append(host); bindDetailInteractionRoot(host);
                  const input=document.createElement('input');input.value='미저장 입력';host.append(input);input.focus();input.setSelectionRange(1,3);
                  const outputBefore=JSON.stringify(state.presenter);
                  const buttons=[...host.querySelectorAll('[data-presenter-thumb-scale]')];
                  check(buttons.length===3 && buttons[0].getAttribute('aria-pressed')==='true','default is 기본');
                  const width=()=>document.getElementById('probe').getBoundingClientRect().width;
                  check(width()===184,'base width '+width());
                  buttons[1].click();await MINDEX_SERVER_STORAGE.flush();
                  check(document.documentElement.dataset.thumbScale==='1.5','click applies');
                  check(Math.abs(width()-184*1.5)<0.01,'scaled width '+width());
                  check(safeStorageGet('local', STORAGE.presenterThumbScale)==='1.5','persisted '+JSON.stringify(safeStorageGet('local', STORAGE.presenterThumbScale)));
                  check(buttons.map(b=>b.getAttribute('aria-pressed')).join()==='false,true,false','pressed state follows');
                  check(readPresenterThumbScale()==='1.5','read back');
                  for(const old of ['1.3','1.6']) { safeStorageSet('local', STORAGE.presenterThumbScale,old); await MINDEX_SERVER_STORAGE.flush(); check(readPresenterThumbScale()==='1.5','legacy scale'); }
                  safeStorageSet('local', STORAGE.presenterThumbScale,'9');await MINDEX_SERVER_STORAGE.flush();
                  check(readPresenterThumbScale()==='1','invalid stored value falls back');
                  applyPresenterThumbScale('nope');
                  check(document.documentElement.dataset.thumbScale==='1','invalid key falls back');
                  const board=document.getElementById('g');board.style.display='grid';board.style.width='900px';
                  board.innerHTML='<div class="svc-slide-thumb-wrap"><div class="svc-slide-thumb" style="aspect-ratio:16/9"></div></div>';
                  for(const scale of ['1','1.5','2']) {
                    setPresenterThumbScale(scale);
                    const frame=board.querySelector('.svc-slide-thumb').getBoundingClientRect();
                    check(Math.abs(frame.width-184*Number(scale))<1,'actual frame width '+frame.width);
                    check(Math.abs(frame.width/frame.height-16/9)<0.02,'actual ratio');
                  }
                  board.style.width='160px';setPresenterThumbScale('2');
                  check(board.scrollWidth>board.clientWidth && board.querySelector('.svc-slide-thumb').getBoundingClientRect().width===368,'narrow board shrinks frame');
                  const probe=document.createElement('i');probe.id='probe';probe.style.cssText='display:block;height:1px;width:var(--svc-thumb-width)';board.append(probe);
                  const focus=document.createElement('section');focus.id='servicePresenterControls';focus.dataset.focusView='true';
                  focus.innerHTML='<div class="svc-slide-board"><div class="svc-slide-thumb-wrap"><div class="svc-slide-thumb" style="aspect-ratio:16/9"></div></div></div>';host.append(focus);
                  for(const scale of ['1','1.5','2']) { setPresenterThumbScale(scale);const frame=focus.querySelector('.svc-slide-thumb').getBoundingClientRect();check(Math.abs(frame.width-184*Number(scale))<1,'focus frame width');check(Math.abs(frame.width/frame.height-16/9)<0.02,'focus ratio'); }
                  check(input.isConnected && document.activeElement===input && input.value==='미저장 입력' && input.selectionStart===1 && input.selectionEnd===3,'editor focus/input changed');
                  check(JSON.stringify(state.presenter)===outputBefore,'output model changed');
                  return 'PASS';
                }'''), 'controls, scaling, persistence, fallback', flush=True)
                # narrow breakpoints keep the multiplier
                for w, base in [(1100, 168), (700, 148)]:
                    page.set_viewport_size({'width': w, 'height': 800})
                    got = page.evaluate('''() => { setPresenterThumbScale('1.5'); return document.getElementById('probe').getBoundingClientRect().width; }''')
                    assert abs(got - base * 1.5) < 0.01, (w, got)
                page.evaluate("setPresenterThumbScale('2')")
                # A fresh controller load restores it; the output window never applies it.
                page.evaluate("MINDEX_SERVER_STORAGE.flush()")
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function("typeof readPresenterThumbScale === 'function'")
                prepare_server_state_fixture(page)
                page.evaluate("applyPresenterThumbScale(readPresenterThumbScale())")
                assert page.evaluate("document.documentElement.dataset.thumbScale") == '2', 'restored on reload'
                out = ctx.new_page()
                out.route('**/*supabase*/**', lambda r: r.abort())
                out.goto(url + '?output=presenter', wait_until='domcontentloaded')
                out.wait_for_function("typeof renderPresenterOutput === 'function'")
                out.wait_for_timeout(300)
                assert out.evaluate("document.documentElement.dataset.thumbScale || ''") == '', 'output window must not get the controller scale'
                assert out.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--svc-thumb-scale').trim()") == '', 'output scale var'
                print(engine, 'PASS restore on reload, breakpoints, output window untouched', flush=True)
                browser.close()
    finally:
        server.shutdown()


main()
