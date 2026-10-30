"""Initial calendar read failures provide a real keyboard retry, with no DB writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium, prepare_server_state_fixture

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page(viewport={'width': 390, 'height': 900})
            page.route('**/*', lambda r: r.continue_() if r.request.method == 'GET' and urlsplit(r.request.url).netloc == urlsplit(url).netloc else r.abort())
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("typeof renderCalendarView==='function'&&!document.body.classList.contains('ui-booting')")
            prepare_server_state_fixture(page)
            page.evaluate("""() => {
                state.module='calendar';state.calendarLoaded=false;state.calendarLoading=false;
                state.calendarError='';state.connectionError='';state.calendarData=[];state.calendarYear=2026;
                window.reads=[];window.completeRead=[];
                state.client={from(table){if(table!=='mindex_sunday_calendar')throw Error('Unexpected table');
                    const q={select(){return q},order(){return q},range(a,b){reads.push([a,b]);return new Promise(resolve=>completeRead.push(resolve))}};return q}};
                renderCalendarView();
            }""")
            page.wait_for_function('reads.length===1')
            assert page.locator('#detailPane [aria-busy=true]').count() == 1
            for n, error, phrase in [(0, {'code': '42501', 'message': 'permission denied secret-fixture'}, '권한'),
                                     (1, {'message': 'Failed to fetch https://private.invalid/secret-fixture'}, '서버 응답')]:
                page.evaluate('([n,error])=>completeRead[n]({data:null,error})', [n, error])
                page.wait_for_function('!!state.calendarError&&!state.calendarLoading')
                retry = page.locator('[data-calendar-retry]')
                assert retry.count() == 1, (engine, 'calendar failure has no retry action')
                assert phrase in page.locator('#detailPane').inner_text()
                assert 'secret-fixture' not in page.locator('body').inner_text()
                for theme in ('light', 'dark'):
                    page.evaluate("t=>{document.body.dataset.theme=t;document.documentElement.dataset.theme=t}", theme)
                    for width in (320, 390, 768, 1440):
                        page.set_viewport_size({'width': width, 'height': 900})
                        retry.focus();assert retry.evaluate('e=>getComputedStyle(e).outlineStyle') == 'solid'
                        assert retry.evaluate('e=>{const r=e.getBoundingClientRect(),p=e.closest(".empty-detail").getBoundingClientRect();return r.left>=p.left&&r.right<=p.right}')
                retry.press('Enter');page.wait_for_function('(n)=>reads.length===n+2', arg=n)
                assert page.locator('#detailPane [aria-busy=true]').count() == 1
                page.evaluate('void loadCalendarData({refresh:true,silent:true})')
                assert page.evaluate('reads.length') == n + 2
            page.evaluate('completeRead[2]({data:[],error:null})')
            page.wait_for_function('state.calendarLoaded&&!state.calendarLoading&&!state.calendarError')
            assert '2026년 교회력 데이터가 없습니다.' in page.locator('#detailPane').inner_text()
            assert page.get_by_role('combobox', name='연도', exact=True).count() == 1
            assert page.locator('[data-calendar-retry],iframe.bulletin-print-frame').count() == 0
            print('PASS', engine, 'initial read failure, safe permission/network errors, keyboard retry/loading/dedup, successful empty year; operational writes/print 0', flush=True)
            browser.close()
finally:
    server.shutdown()
