"""Two real tabs, isolated fake DB, no native output or external requests."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context()
   context.add_init_script('window.open=()=>null;Element.prototype.requestFullscreen=async()=>{}')
   context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   a=context.new_page();b=context.new_page()
   for page in (a,b):
    page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
    page.wait_for_function("typeof publishDepartmentTabChange==='function'")
    prepare_server_state_fixture(page)
    page.evaluate('''()=>{
      state.config.url='offline-tab-fixture';state.module='calendar';state.loading=false;state.saving=false;
      state.presenter.outputPendingAt=0;isPresenterOutputWindowOpen=()=>false;
      state.services=[];state.calendarLoaded=true;
      window.row={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date:'2026-10-25',children_prayer:'A'};
      state.calendarData=[row];window.dbValue='A';window.reads=0;
      state.client={from:()=>({select:()=>({eq:async()=>{reads++;return {data:[{...row,children_prayer:dbValue}]}},in:async()=>({data:[{...row,children_prayer:dbValue}]})})}),rpc:async(name,{req})=>{
        if(name==='get_department_assignee_context_v1')return {data:{calendar:{...row},services:[]}};
        if(name==='save_calendar_assignee_v1')return {data:{calendar:{...row,children_prayer:req.value},services:[]}};
        throw Error('Unexpected write');
      }};
      document.body.innerHTML='<table><tbody><tr><td contenteditable="true" data-cal-id="'+row.id+'" data-cal-field="children_prayer">A</td></tr></tbody></table><button id="outside">Outside</button>';
      window.cell=document.querySelector('td');
    }''')
   b.evaluate("dbValue='B'")
   a.evaluate("departmentCalendarSave(row,'children_prayer','B','A')")
   b.wait_for_function("row.children_prayer==='B' && cell.textContent==='B'")
   # While focused, keep both the user's DOM text and stored baseline unchanged.
   b.evaluate("dbValue='C';cell.focus();cell.textContent='my draft'")
   a.evaluate("departmentCalendarSave(row,'children_prayer','C','B')")
   b.wait_for_function('departmentTabSync.pending.size===1')
   b.evaluate("if(cell.textContent!=='my draft'||row.children_prayer!=='B')throw Error('draft overwritten');cell.textContent='B';cell.blur();document.getElementById('outside').focus();scheduleDepartmentTabRefresh()")
   b.wait_for_function("row.children_prayer==='C' && cell.textContent==='C'")
   # Channel failure recovers through a server reconciliation, including explicit clear.
   a.evaluate("departmentTabSync.channel.close()")
   b.evaluate("dbValue=''")
   a.evaluate("departmentCalendarSave(row,'children_prayer','','C')")
   b.evaluate("reconcileDepartmentRealtime()")
   b.wait_for_function("row.children_prayer==='' && cell.textContent===''")
   a.evaluate('departmentTabSync.channel=new BroadcastChannel("mindex.department.assignees.v1")')
   # A blocked service editor keeps the event pending until it becomes safe.
   b.evaluate('''()=>{state.module='service';state.selectedServiceId='service-fixture';window.blocked=true;window.refreshes=0;
     MINDEX_SERVICE_ENTRY.check=async()=>{refreshes++;return !blocked};
     sundayEditSyncHasLocalDraft=()=>false;dbValue='D';}''')
   a.evaluate("publishDepartmentTabChange(row,['service-fixture'])")
   b.wait_for_function('refreshes>0 && departmentTabSync.pending.size===1')
   b.evaluate('blocked=false')
   b.wait_for_function('departmentTabSync.pending.size===0')
   # Other database projects must never trigger a fetch or change.
   count=b.evaluate('reads')
   a.evaluate("state.config.url='another-project';publishDepartmentTabChange(row,[])")
   b.wait_for_timeout(350)
   assert b.evaluate('reads')==count
   print('PASS',engine,'real tabs, confirmed save, focused draft deferral, clear, server reconciliation, deferred service refresh, project isolation',flush=True)
   context.close();browser.close()
finally:server.shutdown()
