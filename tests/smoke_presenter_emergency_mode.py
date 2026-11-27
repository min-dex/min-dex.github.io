from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1280, 'height': 720})
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof state!=='undefined' && typeof runPresenterAction==='function' && typeof normalizePresenterPayload==='function' && !document.body.classList.contains('ui-booting')")
                result = page.evaluate('''() => {
                  const check=(value,message)=>{if(!value)throw Error(message)};
                  const sid='retired-backgroundless';
                  const slide={id:'lyric',type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:'원래 화면',title:'찬양'};
                  state.services=[{id:sid,type_id:'friday',date:'2026-11-27'}];
                  state.presenter.serviceId=sid;state.presenter.slides=[slide];state.presenter.index=0;
                  state.presenter.outputWindow={closed:false};state.presenter.emergencyMode=false;
                  const before=JSON.stringify({index:state.presenter.index,slides:state.presenter.slides,music:state.serviceMusic.sourceKey});
                  const ui=document.createElement('div');ui.innerHTML=renderPresenterScreenManagement(sid,[slide]);
                  check(!ui.querySelector('[data-presenter-action="emergency"]'),'retired action button remains');
                  check(!ui.textContent.includes('배경 없이'),'retired action label remains');
                  runPresenterAction('emergency',sid);
                  check(state.presenter.emergencyMode===false,'retired action still changes state');
                  check(JSON.stringify({index:state.presenter.index,slides:state.presenter.slides,music:state.serviceMusic.sourceKey})===before,'retired action changed content');
                  const normalized=normalizePresenterPayload({serviceId:sid,slides:[slide],index:0,emergencyMode:true});
                  check(!('emergencyMode' in normalized),'legacy payload revived retired mode');
                  const published=presenterStatePayload(sid);
                  check(!('emergencyMode' in published),'new payload still publishes retired mode');
                  return 'PASS retired backgroundless UI/action/payload ignored without content or transport mutation';
                }''')
                print(engine, result, flush=True)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
