"""Effective-date youth order and content-preserving projection."""
from smoke_app import start_local_app_server, sync_playwright, launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  browser=launch_chromium(p);page=browser.new_page()
  page.route('**/*supabase*/**',lambda route:route.abort())
  page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
  page.wait_for_function("typeof state!=='undefined'&&typeof serviceOrderTemplate==='function'")
  print(page.evaluate('''()=>{
   const check=(value,message)=>{if(!value)throw Error(message)};
   for(const date of ['2026-10-04','2026-10-10','2026-10-11','2026-11-01']) {
    const service={id:'youth-order',type_id:'youth',date};
    const steps=serviceOrderTemplate('youth',{service}),keys=steps.map(s=>s.sectionKey);
    check((keys.indexOf('lords_prayer')<keys.indexOf('announcements'))===(date>='2026-10-11'),'date boundary '+date);
    check(keys.indexOf('response_song')>keys.indexOf('sermon')&&keys.at(-1)==='fellowship','other order preserved');
    const rows=buildWorshipServiceScaffold(service.id,'youth',{service});
    const items=groupWorshipElements(rows.sections,rows.elements)[service.id];
    const authored=items.filter(item=>['광고','설교'].includes(item.label));
    for(const item of authored){item.raw_title='사용자 내용 '+item.id;item.assignee='사용자 담당';item._worshipElementTemplateModified=true;}
    const before=JSON.stringify(items),projected=projectWorshipServiceItemsFromTemplate(service,items);
    for(const item of authored){const after=projected.find(p=>p.id===item.id);check(after&&after.raw_title===item.raw_title&&after.assignee===item.assignee,'authored data changed');}
    check(JSON.stringify(items)===before,'input mutation');
   }
   return 'PASS youth effective date, historical order, future order, authored content and identities';
  }'''))
  browser.close()
finally:server.shutdown()
