"""Real calendar focus/Enter handlers and REST/RPC adapters, delayed fixture responses."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context(viewport={'width':1400,'height':950});context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderCalendarView==='function'&&!document.body.classList.contains('ui-booting')");prepare_server_state_fixture(page)
   page.evaluate('''()=>{
    window.sent=[];window.serverRow={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',date:'2026-11-01',note:'원본 일정',nursery_prayer:'원본 담당',children_prayer:'원본 기도'};
    window.contextReads=[];window.pendingResponses=[];
    const send=(kind,field,value)=>new Promise(resolve=>{sent.push({kind,field,value});pendingResponses.push(ok=>{if(ok){serverRow[field]=value;resolve(kind==='REST'?{error:null}:{data:{calendar:structuredClone(serverRow)}})}else resolve({error:{code:'P0001',message:'fixture rejected'}})})});
    state.config.url='calendar-e2e-fixture';state.client={from(table){return {update(patch){const field=Object.keys(patch)[0];return {eq:()=>send('REST',field,patch[field])}}}},async rpc(name,args){
     if(name==='get_department_assignee_context_v1'){contextReads.push({field:args.field_name,value:serverRow[args.field_name]});return {data:{calendar:structuredClone(serverRow),services:[]}}}
     if(name==='save_calendar_assignee_v1'){if(args.req.expected!==serverRow[args.req.field])return {error:{code:'P0001',message:'Unexpected stale calendar baseline'}};return send('RPC',args.req.field,args.req.value)}
     return {data:null};}};
    publishDepartmentTabChange=()=>{};state.module='calendar';state.calendarLoaded=true;state.calendarYear=2026;state.calendarError='';state.calendarDetailTab='departments';state.calendarData=[structuredClone(serverRow)];renderCalendarView();
   }''')
   for field in ('note','nursery_prayer','children_prayer'):
    cell=page.locator('[data-cal-id="cccccccc-cccc-4ccc-8ccc-cccccccccccc"][data-cal-field="'+field+'"]')
    sent=page.evaluate('sent.length');cell.focus();cell.fill('첫 입력 '+field);cell.press('Enter');page.wait_for_function('(n)=>sent.length===n+1',arg=sent)
    cell.focus();cell.fill('두 번째 '+field);cell.press('Enter')
    # Only wire responses are mocked: the actual handlers and atomic-assignee path stay intact.
    assert page.evaluate('sent.length')==sent+1,(engine,field,'second save was sent before the first settled',page.evaluate('sent'))
    year=page.get_by_role('combobox',name='연도',exact=True);year.select_option('2027')
    assert year.input_value()=='2026' and page.evaluate('state.calendarCellSaves.size')==1
    page.evaluate('(n)=>pendingResponses[n](true)',sent);page.wait_for_function('(n)=>sent.length===n+2',arg=sent)
    page.evaluate('(n)=>pendingResponses[n+1](true)',sent);page.wait_for_function('([f,v])=>state.calendarData[0][f]===v',arg=[field,'두 번째 '+field])
    assert page.evaluate('(f)=>serverRow[f]',field)=='두 번째 '+field
    assert cell.inner_text()=='두 번째 '+field
   # First rejection must not make a queued linked-role edit compare against uncommitted UI text.
   field='children_prayer';cell=page.locator('[data-cal-field="'+field+'"][data-cal-id="cccccccc-cccc-4ccc-8ccc-cccccccccccc"]');sent=page.evaluate('sent.length')
   cell.focus();cell.fill('실패할 기도자');cell.press('Enter');page.wait_for_function('(n)=>sent.length===n+1',arg=sent)
   cell.focus();cell.fill('이후 기도자');cell.press('Tab');page.evaluate('(n)=>pendingResponses[n](false)',sent)
   page.wait_for_function('(n)=>sent.length===n+2',arg=sent);page.evaluate('(n)=>pendingResponses[n+1](true)',sent)
   page.wait_for_function("state.calendarData[0].children_prayer==='이후 기도자'")
   assert page.evaluate('serverRow.children_prayer')=='이후 기도자'
   # A newer, uncommitted edit retains its node and caret during an earlier reply.
   cell=page.locator('[data-cal-field=note][data-cal-id="cccccccc-cccc-4ccc-8ccc-cccccccccccc"]');sent=page.evaluate('sent.length')
   cell.focus();cell.fill('저장 요청');cell.press('Enter');page.wait_for_function('(n)=>sent.length===n+1',arg=sent)
   cell.focus();cell.fill('늦게 쓴 초안');cell.evaluate('e=>{const r=document.createRange();r.setStart(e.firstChild,3);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r)}')
   page.evaluate('(n)=>pendingResponses[n](true)',sent);page.wait_for_function("state.calendarData[0].note==='저장 요청'")
   assert cell.inner_text()=='늦게 쓴 초안' and cell.evaluate('e=>document.activeElement===e&&getSelection().anchorOffset===3')
   cell.press('Escape');assert cell.inner_text()=='저장 요청'
   assert page.evaluate('sent.length')==sent+1
   page.evaluate("state.module='home';renderHomeStart();state.module='calendar';renderCalendarView()")
   assert page.locator('[data-cal-field=note][data-cal-id="cccccccc-cccc-4ccc-8ccc-cccccccccccc"]').inner_text()=='저장 요청'
   assert page.evaluate('state.calendarCellSaves.size')==0
   year.select_option('2027');assert year.input_value()=='2027'
   year.select_option('2026');assert page.locator('[data-cal-field=note][data-cal-id="cccccccc-cccc-4ccc-8ccc-cccccccccccc"]').inner_text()=='저장 요청'
   print('PASS',engine,'actual calendar handlers: REST/RPC save ordering, failed first linked edit, authoritative retry baseline, late draft/caret, Escape and screen return; production writes 0',flush=True)
   context.close();browser.close()
finally:server.shutdown()
