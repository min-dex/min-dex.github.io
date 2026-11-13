"""Offline web/app presence and shell boundary regression checks."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    for desktop in [False, True]:
                        page = browser.new_page(viewport={'width': 1440, 'height': 960})
                        page.route('**/*supabase*/**', lambda r: r.abort())
                        if desktop:
                            page.add_init_script('window.mindexElectron={isDesktop:true,getUpdateState:async()=>({ok:false})}')
                        page.route('**/app.runtime.js*', lambda r: r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
                        page.goto(url, wait_until='networkidle')
                        page.wait_for_function("!!document.querySelector('.monitor-panel')")
                        page.evaluate('''() => {
                          window.presence=[];
                          state.client={rpc:(name,args)=>({abortSignal:()=>{
                            if(name==='mindex_monitor_ping')presence.push(args.p_status);
                            return Promise.resolve({data:name==='mindex_monitor_register'?'a'.repeat(64):true,error:null});
                          }})};
                          window.dispatchEvent(new Event('online'));
                        }''')
                        page.wait_for_function('presence.length>0')
                        label=page.evaluate('presence[0].browser')
                        assert label == '앱 · Mindex' if desktop else label.startswith('웹 · ')
                        for width in [1120,1440,1920]:
                            for theme in ['light','dark']:
                                page.set_viewport_size({'width':width,'height':960})
                                page.evaluate('''theme=>{
                                  document.body.dataset.theme=theme;
                                  document.body.classList.add('right-sidebar-open');
                                  document.querySelector('.right-sidebar').hidden=false;
                                }''',theme)
                                page.wait_for_timeout(150)
                                geometry=page.evaluate('''()=>{
                                  const b=s=>document.querySelector(s).getBoundingClientRect();
                                  const a=b('.topbar-actions'),r=b('.right-sidebar'),t=b('.topbar'),l=b('.nav-sidebar'),n=b('.primary-switcher');
                                  return {right:Math.abs(a.x-r.x),left:Math.abs(n.x-l.right),strokeHeight:Math.abs(a.height-t.height)};
                                }''')
                                assert all(v<1 for v in geometry.values()),geometry
                        page.close()
                    print(engine, 'PASS web/app presence and shared panel/header boundaries')
                finally:
                    browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
