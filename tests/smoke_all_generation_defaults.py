"""Explicit all-generation services must not inherit regular third-service defaults."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright

SCRIPT='''()=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 state.calendarData=[];state.calendarLoaded=false;
 const regular={id:'regular',type_id:'sunday-main',date:'2026-10-18'};
 const service={...regular,id:'all-generation',alias:'온세대 찬양예배'};
 state.services=[regular,service];state.songs=[];
 const scaffold=buildWorshipServiceScaffold(regular.id,regular.type_id,{service:regular});
 const inherited=groupWorshipElements(scaffold.sections,scaffold.elements)[regular.id].map(row=>({...row,service_id:service.id}));
 check(inherited.some(row=>row.label==='입례찬양'&&row.raw_title==='내 한 가지 소원'),'regular entrance fixture missing');
 check(inherited.some(row=>row.assignee==='할렐루야 찬양대'),'regular choir fixture missing');
 const before=JSON.stringify(inherited);
 const projected=projectWorshipServiceItemsFromTemplate(service,inherited);
 check(!projected.some(row=>row.label==='입례찬양'),'inherited entrance survived');
 check(!projected.some(row=>row.assignee==='할렐루야 찬양대'),'inherited choir survived');
 check(!projected.some(row=>['참회기도','사도신경','공동체고백','봉헌찬송','폐회찬송'].includes(row.label)),'other regular-only default survived');
 check(JSON.stringify(inherited)===before,'projection mutated source records');
 check(projected.some(row=>row.label==='특송'),'special slot removed');
 const edited=inherited.map(row=>({...row,_worshipElementTemplateModified:true}));
 const preserved=projectWorshipServiceItemsFromTemplate(service,edited);
 check(preserved.some(row=>row.label==='입례찬양'&&row.raw_title==='내 한 가지 소원'),'explicit entrance lost');
 check(preserved.some(row=>row.assignee==='할렐루야 찬양대'),'explicit choir lost');
 const fresh=buildWorshipServiceScaffold(service.id,service.type_id,{service});
 check(!fresh.elements.some(row=>row.person==='할렐루야 찬양대'||row.title==='내 한 가지 소원'),'fresh defaults leaked');
 const persisted={...regular,source_ref:{sunday_main_variant:'all_generations'}};
 check(isAllGenerationsWorshipService(persisted),'persisted variant lost before calendar');
 check(!isAllGenerationsWorshipService({...regular,title:'온세대 찬양예배 참고',raw_text:'온세대 찬양예배'}),'free text inferred a variant');
 check(!isAllGenerationsWorshipService({...service,type_id:'sunday-first'}),'other service type changed');
 check(!isAllGenerationsWorshipDate('2026-10-18'),'alias changed automatic scheduling');
 check(isAllGenerationsWorshipService({...regular,_worshipSourceRef:{sunday_main_variant:'all_generations'}}),'hydrated source variant lost');
 check(!isAllGenerationsWorshipService({...regular,alias:'온세대 찬양예배 참고'}),'substring alias inferred variant');
 state.calendarLoaded=true;state.calendarData=[{date:'2026-10-18',church_schedule:'온세대 찬양예배'}];
 check(isAllGenerationsWorshipService(regular),'calendar-driven variant lost');
 const again=projectWorshipServiceItemsFromTemplate(service,projected);
 check(!again.some(row=>row.label==='입례찬양'||row.assignee==='할렐루야 찬양대'),'repeat projection restored defaults');
 return 'PASS explicit alias/persisted variant/calendar, inherited-default cleanup, edited-content preservation, source immutability and schedule isolation';
}'''

def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as p:
   for engine in ('chromium','webkit'):
    browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page()
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname in ('127.0.0.1','localhost') else r.abort())
    page.goto(url);page.wait_for_function("typeof state!=='undefined'&&typeof projectWorshipServiceItemsFromTemplate==='function'")
    print(engine,page.evaluate(SCRIPT),flush=True);browser.close()
 finally:server.shutdown()
if __name__=='__main__':main()
