import sys,os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
sys.path.insert(0,'tests')
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from urllib.parse import urlsplit
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page(viewport={'width':1440,'height':1000})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url);page.wait_for_function('typeof serviceNavigationName==="function" && !document.body.classList.contains("ui-booting")')
   print(engine,page.evaluate('''()=>{
    state.serviceTypes=[];
    const cases=[['sunday-main','','주일예배 [3부]'],['sunday-main','온세대 찬양예배','온세대 찬양예배'],['friday','','금요기도회'],['friday','문화예배','문화예배'],['monthly','','월삭예배'],['children','어린이부 예배','어린이부 예배'],['sunday-main','주일예배 [3부] (온세대 찬양예배)','주일예배 [3부] (온세대 찬양예배)']];
    for(const [type_id,alias,expected] of cases){const svc={id:'test-'+type_id,type_id,alias,date:'2026-10-25'};const before=JSON.stringify(svc);if(serviceNavigationName(svc)!==expected)throw Error(JSON.stringify({svc,actual:serviceNavigationName(svc),expected}));if(JSON.stringify(svc)!==before)throw Error('source changed');}
    if(serviceNavigationTypeName('sunday-main')!=='주일예배 [3부]')throw Error('type header invented alias');
    if(worshipSetlistNavigationName({service_type_id:'sun_3rd',aliases:[]})!=='주일예배 [3부]')throw Error('archive invented alias');
    if(worshipSetlistNavigationName({service_type_id:'fri',aliases:['문화예배','문화예배']})!=='문화예배')throw Error('explicit Friday archive alias changed');
    if(serviceNavigationName({type_id:'sunday-main',alias:'',title:'온세대 찬양예배'})!=='주일예배 [3부]')throw Error('title inferred as alias');
    const replacements=[['young-adult','청년부 야외예배','야외예배','청년부 예배 대체'],['young-adult','자율 셀 모임','자율 셀 모임','청년부 예배 대체'],['young-adult','연합 셀 모임','연합 셀 모임','청년부 예배 대체'],['wednesday','다니엘기도회 대체 · 정규 집회 없음','다니엘기도회','수요예배 대체'],['friday','다니엘기도회 대체 · 정규 집회 없음','다니엘기도회','금요기도회 대체'],['sunday-afternoon','','다니엘기도회','주일오후예배 대체']];
    for(const [type_id,alias,title,context] of replacements){
      const svc={id:'replace-'+type_id,type_id,alias,date:'2026-11-01',_worshipSourceRef:{no_gathering:true,no_gathering_reason:'다니엘기도회로 대체'}},source=JSON.stringify(svc);
      const details=serviceNavigationDetails(svc);if(details.name!==title||details.context!==context)throw Error(JSON.stringify(details));
      state.services=[svc];state.serviceItems={[svc.id]:[]};state.calendarData=[];state.worshipSetlistArchiveView='week';
      const entry={source:{...svc,service_type_id:type_id,service_date:svc.date,aliases:alias,source_ref:svc._worshipSourceRef},candidates:[],weeklyStatus:'집회 없음',weeklyReason:alias};
      for(const html of [renderServiceWeekCard(svc),renderServiceDateCard(svc,{showType:true}),renderWorshipWeekStatus(entry)])if(!html.includes(title)||!html.includes(context)||html.includes('정규 집회 없음')||html.includes('>집회 없음<'))throw Error(html);
      if(JSON.stringify(svc)!==source)throw Error('replacement mutated input');
    }
    if(serviceNavigationDetails({type_id:'sunday-main',alias:'온세대 찬양예배'}).context!=='주일예배 [3부]')throw Error('ordinary alias lost type');
    const regular={id:'regular',type_id:'sunday-main',alias:'',date:'2026-10-25'};state.services=[regular];state.serviceItems={regular:[]};state.calendarData=[];
    for(const html of [renderServiceDateCard(regular,{showType:true}),renderServiceWeekCard(regular),renderPresenterSidebarServiceSummary(regular),renderServiceListTypeBlock({id:'sunday-main'},[regular],'')])if(html.includes('온세대'))throw Error('regular service UI invented alias');
    const svc={id:'fixture',type_id:'sunday-main',alias:'온세대 찬양예배',date:'2026-10-25'};
    state.services=[svc];state.serviceItems={fixture:[]};state.calendarData=[];
    const expected=serviceNavigationName(svc);if(serviceDisplayTypeName(svc)!=='온세대 찬양예배')throw Error('output label changed');
    for(const markup of [renderServiceDateCard(svc,{showType:true}),renderServiceWeekCard(svc),renderPresenterSidebarServiceSummary(svc)])if(!markup.includes(expected)||markup.includes('주일예배 [3부] (온세대'))throw Error('UI label mismatch');
    state.worshipSetlistArchiveView='week';const html=renderWorshipSetlistArchiveEntry({source:{id:'offline',service_type_id:'sun_3rd',service_date:'2026-10-25',aliases:'온세대 찬양예배'},candidates:[]});if(!html.includes(expected)||html.includes('주일예배 [3부] (온세대'))throw Error('archive mismatch');
    refs.detailPane.innerHTML=renderServiceListTypeBlock({id:'sunday-main'},[svc],'')+html;
    return 'PASS aliases, Friday variants, duplicate suppression, list/week/sidebar/archive and source/output preservation';
   }'''),flush=True)
   page.locator('.mindex-boot').wait_for(state='hidden');page.screenshot(path='/private/tmp/service-label-'+engine+'.png');b.close()
finally:server.shutdown()
