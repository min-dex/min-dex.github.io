"""Generated Sunday reference rows are readonly; persisted rows retain editing."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium, prepare_server_state_fixture

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page()
            page.route('**/*', lambda r: r.continue_() if r.request.method == 'GET' and urlsplit(r.request.url).netloc == urlsplit(url).netloc else r.abort())
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("typeof renderCalendarView==='function'&&!document.body.classList.contains('ui-booting')")
            prepare_server_state_fixture(page)
            page.evaluate("""() => {
                state.module='calendar';state.calendarLoaded=true;state.calendarYear=2026;
                state.calendarDetailTab='departments';state.calendarError='';
                state.calendarData=[{id:'real-row',date:'2026-11-01',note:'원본'}];
                window.originalRows=JSON.stringify(state.calendarData);window.writes=0;
                state.client={from(){writes++;throw Error('Unexpected fixture write')}};
                renderCalendarView();
            }""")
            for tab in ('부서 일과', '성서일과'):
                page.get_by_role('tab', name=tab, exact=True).click()
                reference = page.locator('[data-calendar-date="2026-04-05"]')
                assert reference.count() == 1
                assert reference.locator('[contenteditable=true], [data-cal-id], input, textarea').count() == 0
                assert '부활주일' in reference.inner_text()
                real = page.locator('[data-cal-id=real-row][data-cal-field=note]')
                assert real.get_attribute('contenteditable') == 'true'
                real.focus(); real.fill('취소할 초안'); real.press('Escape')
                assert real.inner_text() == '원본'
                assert page.evaluate('writes===0&&JSON.stringify(state.calendarData)===originalRows')
            print('PASS', engine, 'generated Easter readonly in both views; actual row edit/Escape retained; production writes 0', flush=True)
            browser.close()
finally:
    server.shutdown()
