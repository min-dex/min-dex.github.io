"""Read-only monitor UI, isolation and privacy checks; no live DB traffic."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page(viewport={'width': 1280, 'height': 900})
                    page.route('**/*supabase*/**', lambda r: r.abort())
                    page.add_init_script("localStorage.setItem('mindex.monitor.share','false')")
                    page.goto(url, wait_until='networkidle')
                    page.wait_for_function("!!document.querySelector('.monitor-panel')")
                    page.evaluate('''() => {
                      window.monitorCalls=[]; window.monitorMode='ok';
                      state.services=[{id:'editing',date:'2026-09-13',type_id:'sunday-second'}, {id:'output',date:'2026-09-13',type_id:'sunday-main'}];
                      state.selectedServiceId='editing'; state.module='presenter';
                      state.presenter.serviceId='output';state.presenter.index=2;state.presenter.slides=[{},{},{}];
                      state.presenter.outputConnectedAt=Date.now();
                      state.client={rpc:(name,args)=>({abortSignal:signal=>{
                        monitorCalls.push({name,args});
                        if(name==='mindex_remote_outputs')return Promise.resolve({data:{ok:true,outputs:[{id:'s1',title:'주일예배 [3부]',device:'본당 PC',position:'93 / 224'},{id:'s2',title:'대기 예배',device:'교육관 PC · 송출 대기',position:'송출 대기'}]}});
                        if(name==='mindex_remote_admin_login')return Promise.resolve({data:{ok:true,token:'fixture-only'}});
                        if(name==='mindex_remote_admin')return Promise.resolve({data:{ok:true,outputs:[{id:'s1',title:'주일예배 [3부]',device:'본당 PC',position:'93 / 224',code:'0123'}]}});
                        if(monitorMode==='pending')return new Promise(resolve=>window.monitorRelease=resolve);
                        if(monitorMode==='missing')return Promise.resolve({error:{code:'PGRST202'}});
                        const data=name==='mindex_monitor_register'?'a'.repeat(64):name==='mindex_monitor_login'?(args.p_password==='test-secret'?'admin-token':null):name==='mindex_monitor_presence'?[{
                          id:'remote',last_seen:new Date(Date.now()-(monitorMode==='stale'?190000:0)).toISOString(),status:{name:'<img src=x onerror=alert(1)>',os:'Windows',browser:'Whale',version:'test',module:'praise',serviceId:'editing',outputServiceId:'output',output:true,slide:3,count:3,events:[{kind:'save_ok',at:new Date().toISOString()}]}
                        }]:true;
                        return Promise.resolve({data,error:null});
                      }})};
                    }''')
                    page.evaluate("window.dispatchEvent(new Event('online'))")
                    page.wait_for_function("monitorCalls.some(c=>c.name==='mindex_monitor_ping')")
                    assert not page.locator('.monitor-panel').is_visible()
                    page.locator('#monitorPanelBtn').click()
                    assert page.locator('.monitor-panel').is_visible()
                    page.locator('[data-outputs]').get_by_text('주일예배 [3부]').wait_for()
                    assert '0123' not in page.locator('[data-outputs]').inner_text()
                    assert '슬라이드 93 / 224' in page.locator('[data-outputs]').inner_text()
                    assert page.locator('[data-outputs]').inner_text().count('송출 대기') == 1
                    page.click('[data-show-codes]');page.fill('[data-pin]','1111');page.click('[data-check-pin]')
                    page.wait_for_function("document.querySelector('[data-outputs]').textContent.includes('송출 코드 0123')")
                    assert '슬라이드 93 / 224' in page.locator('[data-outputs]').inner_text()
                    page.click('[data-show-codes]');assert '0123' not in page.locator('[data-outputs]').inner_text()
                    page.set_viewport_size({'width':390,'height':430})
                    header=page.locator('.monitor-panel header')
                    y=header.bounding_box()['y']
                    assert page.locator('.monitor-scroll').evaluate('el=>{el.scrollTop=el.scrollHeight;return el.scrollTop>0}')
                    assert header.bounding_box()['y']==y
                    page.locator('.monitor-scroll').evaluate('el=>el.scrollTop=0')
                    assert page.locator('[data-share]').count() == 0
                    assert page.locator('[data-local]').count()==0
                    assert page.get_by_label('접속명').is_visible()
                    page.wait_for_function("monitorCalls.some(c=>c.name==='mindex_monitor_ping')")
                    page.evaluate("emitMonitorSaveEvent('save_start');emitMonitorSaveEvent('save_ok');emitMonitorSaveEvent('save_failed')")
                    page.locator('[data-refresh]').click()
                    page.wait_for_function("!!document.querySelector('[data-devices] strong')")
                    assert page.locator('#monitorPassword, [data-lock], .monitor-panel form').count() == 0
                    assert not page.evaluate("monitorCalls.some(c=>c.name==='mindex_monitor_login')")
                    assert page.locator('[data-devices] img').count() == 0
                    assert page.locator('.monitor-facts, [data-event-filter], [data-device-filter]').count() == 0
                    assert '송출 중' in page.locator('[data-devices]').inner_text()
                    page.evaluate("monitorMode='stale'")
                    page.locator('[data-refresh]').click()
                    page.wait_for_function("document.querySelector('[data-devices]').textContent.includes('현재 접속 중인 브라우저가 없습니다')")
                    page.evaluate("monitorMode='missing'")
                    page.locator('[data-refresh]').click()
                    page.wait_for_function("document.querySelector('.monitor-message').textContent.includes('서버 설정')")
                    assert page.locator('[data-devices] .monitor-device').count() == 0
                    assert '송출 중' not in page.locator('[data-devices]').inner_text()
                    page.evaluate("monitorMode='ok'")
                    page.locator('[data-refresh]').click()
                    page.wait_for_function("!!document.querySelector('[data-devices] strong')")
                    assert page.evaluate("Object.values(localStorage).every(v=>!v.includes('test-secret')&&!v.includes('admin-token'))")
                    for width, theme in [(1280, 'light'), (390, 'light'), (1280, 'dark'), (390, 'dark')]:
                        page.evaluate('(theme)=>{document.body.dataset.theme=theme;document.documentElement.dataset.theme=theme}', theme)
                        page.set_viewport_size({'width': width, 'height': 900})
                        assert page.locator('.monitor-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
                        page.screenshot(path=f'/tmp/mindex-monitor-{engine}-{width}-{theme}.png')
                    page.locator('[data-close]').click()
                    assert not page.evaluate("monitorCalls.some(c=>c.name==='mindex_monitor_login')")
                    page.wait_for_function("document.querySelector('[data-devices]').textContent === ''")
                    assert page.evaluate("state.presenter.index===2&&state.presenter.serviceId==='output'&&state.selectedServiceId==='editing'")
                    payload = page.evaluate("monitorCalls.find(c=>c.name==='mindex_monitor_ping').args.p_status")
                    assert set(payload) == {'name', 'os', 'browser', 'output'}
                    page.evaluate("monitorMode='missing'")
                    page.locator('#monitorPanelBtn').click()
                    page.evaluate("window.dispatchEvent(new Event('online'))")
                    page.wait_for_function("document.querySelector('.monitor-share-status').textContent.includes('서버 설정')")
                    page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))")
                    assert not page.evaluate("monitorCalls.some(c=>c.name==='mindex_monitor_leave')")
                    page.evaluate("monitorMode='ok';window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
                    page.wait_for_function("monitorCalls.filter(c=>c.name==='mindex_monitor_ping').length>=2")
                    assert page.evaluate("monitorCalls.filter(c=>c.name==='mindex_monitor_register').length") == 1
                    assert page.evaluate('state.presenter.index') == 2
                    print(engine, 'PASS automatic presence despite previous opt-out, minimal payload, page lifecycle, password-free read, active-only sessions, failed-read clearing, output status, privacy, XSS, responsive layout, revoke, missing server isolation')
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
