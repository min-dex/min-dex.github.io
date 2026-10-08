"""Offline keyboard/focus regression; no production connection or writes."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def setup(page, url):
    page.route('**/*supabase*/**', lambda route: route.abort())
    page.goto(url + '?mindexSmokeRaw=1', wait_until='load')
    page.wait_for_function("typeof renderPresenterControlState === 'function'")
    page.evaluate('''() => {
      const service={id:'focus-fixture',type_id:'young-adult',date:'2026-10-11',title:'테스트 예배'};
      const items=Array.from({length:8},(_,i)=>({id:'item-'+i,service_id:service.id,
        label:'찬양 '+(i+1),raw_title:'곡 '+i,sort_order:i,
        memo:JSON.stringify({elementType:'praise',slides:['첫 줄','둘째 줄']})}));
      state.module='presenter'; state.selectedServiceId=service.id;
      state.services=[service]; state.serviceTypes=[{id:'young-adult',name:'청년부 예배'}];
      state.serviceItems={[service.id]:items}; state.serviceError=''; state.connectionError='';
      state.presenter.serviceId=service.id; state.presenter.index=1;
      state.presenter.slides=buildServicePresenterSlides(service.id);
      isPresenterOutputWindowOpen=()=>true; publishPresenterState=()=>{};
      document.body.dataset.module='presenter'; renderPresenterDetail();
      const input=document.createElement('input'); input.id='focus-other-control';
      document.body.append(input);
    }''')
    page.wait_for_timeout(200)
    page.locator('.svc-slide-thumb[data-presenter-index="1"]').focus()


def focus_state(page):
    return page.evaluate('''() => ({live:state.presenter.index,
      focused:Number(document.activeElement?.dataset.presenterIndex ?? -1),
      service:document.activeElement?.dataset.serviceId || '',
      other:document.activeElement?.id || ''})''')


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1440, 'height': 900})
                setup(page, url)
                for key in ('ArrowRight', 'ArrowLeft', 'End', 'Home', 'Space', '3', 'Enter'):
                    page.keyboard.press(key)
                    page.wait_for_timeout(100)
                    result = focus_state(page)
                    assert result['live'] == result['focused'], (key, result)
                    assert result['service'] == 'focus-fixture', result
                print('PASS real keyboard navigation retains live thumbnail focus', engine)

                # Exercise the real full renderer after navigation, as a late
                # data refresh can replace the board after the first rAF.
                for delay in (35, 120):
                    page.evaluate('''delay => {
                      window.addEventListener('keydown', () => {
                        window.setTimeout(() => {renderPresenterDetail(); window.focusRefreshDone=true;}, delay);
                      }, {once:true,capture:true}); window.focusRefreshDone=false;
                    }''', delay)
                    page.keyboard.press('ArrowRight')
                    page.wait_for_function('window.focusRefreshDone === true')
                    page.wait_for_timeout(100)
                    result = focus_state(page)
                    assert result['live'] == result['focused'], (delay, result)
                print('PASS focus survives delayed full board replacement', engine)

                # Move focus just before the shortcut's scheduled rAF executes.
                # A user's new control must retain ownership.
                page.evaluate('''() => window.addEventListener('keydown', () => {
                  requestAnimationFrame(() => document.getElementById('focus-other-control').focus());
                }, {once:true,capture:true})''')
                page.keyboard.press('ArrowRight')
                page.wait_for_timeout(100)
                assert focus_state(page)['other'] == 'focus-other-control', focus_state(page)
                page.evaluate('renderPresenterDetail()')
                assert focus_state(page)['other'] == 'focus-other-control', focus_state(page)
                print('PASS another control keeps focus through scheduled navigation and refresh', engine)

                # A stale callback cannot refocus a board after route changes.
                page.evaluate('''() => {
                  document.querySelector('.svc-slide-thumb[data-presenter-index="1"]').focus();
                  runPresenterAction('next','focus-fixture',{focusActiveSlide:true});
                  state.module='praise'; document.activeElement.blur();
                }''')
                page.wait_for_timeout(100)
                assert focus_state(page)['focused'] == -1, focus_state(page)
                print('PASS stale navigation cannot steal focus after module change', engine)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
