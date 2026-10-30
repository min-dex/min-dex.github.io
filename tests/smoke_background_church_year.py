"""Read-only browser checks of seasonal naming, registration and fallback."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

server, url = start_local_app_server()
try:
    with sync_playwright() as pw:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(pw) if engine == 'chromium' else pw.webkit.launch()
            page = browser.new_page()
            page.route('**/*', lambda r: r.continue_() if urlsplit(r.request.url).netloc == urlsplit(url).netloc else r.abort())
            page.goto(url)
            page.wait_for_function("typeof worshipBackgroundTargets==='function' && !document.body.classList.contains('ui-booting')")
            result = page.evaluate('''() => {
              const check=(v,m)=>{if(!v)throw Error(m)};
              state.calendarData=[]; state.serviceTypes=[]; state.worshipBackgroundRegistry={};
              const cases=[['2026-11-28','대림','26-S1.png'],['2026-11-29','대림','27-S1.png'],['2026-12-25','성탄','27-S2.png'],['2027-01-06','주현','27-S3.png'],['2027-03-21','종려','27-S4.png'],['2027-03-28','부활','27-S5.png'],['2027-05-16','성령강림','27-S6.png'],['2026-07-05','맥추','26-SH.png'],['2026-11-15','추수','26-ST.png']];
              const services=cases.map(([date,alias])=>({type_id:'children',date,alias}));
              const before=JSON.stringify(services);
              cases.forEach(([date,alias,name],i)=>check(presenterSeasonBackgroundFileNameForService(services[i])===name, date+alias));
              const christmas=services[2];
              check(presenterBackgroundSourcesForService(christmas)[0]==='assets/worship-backgrounds/26-C6.png','missing season monthly fallback');
              const explicit={...christmas,presenter_background:'https://example.org/original.png'};
              check(presenterBackgroundSourcesForService(explicit)[0]===explicit.presenter_background,'missing season explicit fallback');
              state.worshipBackgroundRegistry={'27-S2.png':{dataUrl:'https://example.org/season.png'},'26-S2.png':{dataUrl:'https://example.org/old.png'}};
              const registryBefore=JSON.stringify(state.worshipBackgroundRegistry);
              check(presenterBackgroundSourcesForService(explicit)[0]==='https://example.org/season.png','new season priority');
              check(presenterBackgroundSourcesForService({type_id:'children',date:'2026-01-04',alias:'성탄'})[0]==='https://example.org/old.png','historical season retained');
              for(const date of ['2026-11-28','2026-11-29','2026-12-25','2027-01-06']){
                const names=worshipBackgroundTargets(date).map(t=>t.fileName);
                check(names.includes('27-S1.png')&&names.includes('27-S2.png'),'registration match '+date);
                check(names.includes(date.slice(2,4)+'-SH.png')&&names.includes(date.slice(2,4)+'-A6.png'),'civil targets '+date);
              }
              state.selectedWorshipBackgroundFile='27-S2.png';
              renderWorshipBackgroundsDetail();
              const select=refs.detailPane.querySelector('[data-background-target]');
              check(select.value==='27-S2.png','registration selected target');
              check(select.querySelector('option[value="27-S1.png"]'),'registration next Advent option');
              check(JSON.stringify(services)===before&&JSON.stringify(state.worshipBackgroundRegistry)===registryBefore,'original mutation');
              check(presenterBackgroundSourcesForService({type_id:'children',date:'2027-01-06',alias:'주현'}).length===0,'unavailable asset fabricated');
              return 'PASS Advent/Christmas/January/Easter and SH/ST boundaries, actual registration UI, fallback and originals unchanged';
            }''')
            print(engine, result, flush=True)
            browser.close()
finally:
    server.shutdown()
