"""Controller slide size levels: applies to the board only, persists, and never reaches the output window."""
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
                page.wait_for_function("typeof setPresenterThumbLevel === 'function'")
                prepare_server_state_fixture(page)
                print(engine, page.evaluate('''async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const host=document.createElement('div'); host.id='scale-host';
                  const slide={layout:'blank',type:'blank'};
                  const slides=Array.from({length:5},(_,index)=>renderPresenterSlideThumb(slide,index,-1,'fixture')).join('');
                  host.innerHTML=renderPresenterThumbLevelControl()+'<div class="svc-board-grid" id="g">'+slides+'</div>';
                  document.body.append(host); bindDetailInteractionRoot(host);
                  const input=document.createElement('input');input.value='미저장 입력';host.append(input);input.focus();input.setSelectionRange(1,3);
                  const outputBefore=JSON.stringify(state.presenter);
                  const buttons=[...host.querySelectorAll('[data-presenter-thumb-level]')];
                  check(buttons.map(b=>b.textContent).join()==='1,2,3','level labels');
                  check(buttons[0].getAttribute('aria-pressed')==='true','default is level one');
                  buttons[1].click();await MINDEX_SERVER_STORAGE.flush();
                  check(document.documentElement.dataset.thumbLevel==='2','click applies');
                  check(safeStorageGet('local', STORAGE.presenterThumbScale)==='1.5','compatible device preference');
                  check(buttons.map(b=>b.getAttribute('aria-pressed')).join()==='false,true,false','pressed state follows');
                  for(const [old,level] of [['1','1'],['1.3','2'],['1.5','2'],['1.6','2'],['2','3'],['9','1']]) {
                    safeStorageSet('local', STORAGE.presenterThumbScale,old);await MINDEX_SERVER_STORAGE.flush();
                    check(readPresenterThumbLevel()===level,'legacy preference '+old);
                  }
                  check(applyPresenterThumbLevel('nope')==='1','invalid selection falls back');
                  const board=document.getElementById('g');
                  const focus=document.createElement('section');focus.id='servicePresenterControls';focus.dataset.focusView='true';
                  focus.innerHTML='<div class="svc-slide-board">'+slides+'</div>';host.append(focus);
                  const strip=focus.firstElementChild;
                  const rects=root=>[...root.querySelectorAll('.svc-slide-thumb-wrap')].map(node=>node.getBoundingClientRect());
                  for(const width of [900, 460, 220]) {
                    board.style.width=strip.style.width=width+'px';
                    for(const [level, columns] of [[1,3],[2,2],[3,1]]) {
                      buttons[level-1].click();
                      check(document.documentElement.dataset.thumbLevel===String(level),'selected level');
                      for(const [surface,gap] of [[board,12],[strip,10]]) {
                        const thumbs=rects(surface), first=thumbs.slice(0,columns);
                        const frame=surface.querySelector('.svc-slide-thumb-frame').getBoundingClientRect();
                        check(Math.abs(frame.width/frame.height-16/9)<0.02,'thumbnail aspect ratio');
                        check(Math.abs(first.at(-1).right-surface.getBoundingClientRect().right)<1,'row fills width');
                        check(thumbs.every(t=>Math.abs(t.width-first[0].width)<1),'equal slide widths');
                        check(first.slice(1).every((t,i)=>Math.abs(t.left-first[i].right-gap)<1),'fixed gap');
                        if(surface===board) {
                          check(thumbs[columns].top>first[0].top,'wrap at selected column count');
                          check(Math.abs(thumbs.at(-1).left-first[(thumbs.length-1)%columns].left)<1,'last row stays aligned');
                          check(surface.scrollWidth<=surface.clientWidth,'board overflows');
                        } else {
                          check(thumbs.every(t=>Math.abs(t.top-first[0].top)<1),'filmstrip stays on one row');
                          check(surface.scrollWidth>surface.clientWidth,'filmstrip remains scrollable');
                        }
                      }
                    }
                  }
                  check(input.isConnected && document.activeElement===input && input.value==='미저장 입력' && input.selectionStart===1 && input.selectionEnd===3,'editor focus/input changed');
                  check(JSON.stringify(state.presenter)===outputBefore,'output model changed');
                  return 'PASS';
                }'''), 'controls, equal columns, fixed gaps, persistence', flush=True)
                page.evaluate("setPresenterThumbLevel('2')")
                # A fresh controller load restores it; the output window never applies it.
                page.evaluate("MINDEX_SERVER_STORAGE.flush()")
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function("typeof readPresenterThumbLevel === 'function'")
                prepare_server_state_fixture(page)
                page.evaluate("applyPresenterThumbLevel(readPresenterThumbLevel())")
                assert page.evaluate("document.documentElement.dataset.thumbLevel") == '2', 'restored on reload'
                out = ctx.new_page()
                out.route('**/*supabase*/**', lambda r: r.abort())
                out.goto(url + '?output=presenter', wait_until='domcontentloaded')
                out.wait_for_function("typeof renderPresenterOutput === 'function'")
                out.wait_for_timeout(300)
                assert out.evaluate("document.documentElement.dataset.thumbLevel || ''") == '', 'output window must not get the controller columns'
                assert out.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--svc-thumb-columns').trim()") == '', 'output columns var'
                print(engine, 'PASS restore on reload, output window untouched', flush=True)
                browser.close()
    finally:
        server.shutdown()


main()
