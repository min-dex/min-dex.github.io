"""Offline linked-calendar requests; no production connections, native windows or fullscreen."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.add_init_script("window.open=()=>null; Element.prototype.requestFullscreen=async()=>{}; Element.prototype.webkitRequestFullscreen=()=>{};")
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?output=presenter&mindexSmokeRaw=1',wait_until='domcontentloaded');page.wait_for_function("typeof departmentCalendarSave==='function'")
   result=page.evaluate('''async()=>{
    const row={id:crypto.randomUUID(),date:'2026-10-25',children_prayer:'A'};
    const dbRow=structuredClone(row);state.calendarData=[row];state.config={url:'offline-fixture'};state.calendarLoaded=true;
    let fail=false;const writes=[];let active=0,max=0;
    state.client={rpc:async(name,args)=>{
      if(name==='get_department_assignee_context_v1')return {data:{calendar:structuredClone(dbRow),services:[]}};
      if(name!=='save_calendar_assignee_v1')throw Error('unexpected RPC');
      writes.push(structuredClone(args.req));active++;max=Math.max(max,active);
      await new Promise(r=>setTimeout(r,10));active--;
      if(fail){fail=false;return {error:{message:'network disconnected'}};}
      dbRow.children_prayer=args.req.value;
      return {data:{calendar:structuredClone(dbRow),services:[]}};
    }};
    await departmentCalendarSave(row,'children_prayer','B','A');
    if(row.children_prayer!=='B')throw Error('calendar receipt not adopted');
    fail=true;await departmentCalendarSave(row,'children_prayer','C','B').then(()=>{throw Error('must fail')},()=>{});
    const frozen=JSON.stringify(writes.at(-1));
    await departmentCalendarSave(row,'children_prayer','NEW DRAFT','B').then(()=>{throw Error('must require reload')},e=>{if(!e.message.includes('이전 저장'))throw e;});
    if(JSON.stringify(writes.at(-1))!==frozen||row.children_prayer!=='C')throw Error('retry did not freeze request');
    await Promise.all([departmentCalendarSave(row,'children_prayer','D','C'),departmentCalendarSave(row,'children_prayer','E','D')]);
    if(max!==1||row.children_prayer!=='E')throw Error('overlapping writes');
    await departmentCalendarSave(row,'children_prayer','','E');
    if(row.children_prayer!=='')throw Error('clear not retained');
    return {writes:writes.length,maxConcurrent:max};
   }''')
   print('PASS',engine,'frozen retry, receipt adoption, ordered rapid edits, explicit clear',result,flush=True)
   browser.close()
finally:server.shutdown()
