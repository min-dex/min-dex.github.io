"""Delayed calendar failures must not replace later focused text; offline only."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context();context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function("typeof renderCalendarView==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    window.requests=[];state.client={from(){return {update(patch){return {eq:()=>new Promise(resolve=>requests.push({patch,resolve}))}}}}};
    state.module='calendar';state.calendarLoaded=true;state.calendarError='';state.calendarDetailTab='departments';state.calendarData=[{id:'late-calendar',date:'2026-11-01',note:'서버 원본'}];
    publishDepartmentTabChange=()=>{};renderCalendarView();
   }''')
   cell=page.locator('.cal-cell[data-cal-id="late-calendar"][data-cal-field="note"]')
   cell.focus();cell.fill('첫 저장');cell.press('Enter');page.wait_for_function('requests.length===1')
   cell.focus();cell.fill('뒤에 입력한 초안')
   cell.evaluate('''e=>{const range=document.createRange();range.setStart(e.firstChild,3);range.collapse(true);const selection=getSelection();selection.removeAllRanges();selection.addRange(range)}''')
   page.evaluate("requests[0].resolve({error:{message:'late fixture failure'}})")
   page.wait_for_function("document.querySelector('[data-cal-id=late-calendar][data-cal-field=note]').classList.contains('is-save-error')")
   assert cell.inner_text()=='뒤에 입력한 초안',(engine,'late failure erased newer draft',cell.inner_text())
   assert cell.evaluate('e=>document.activeElement===e&&getSelection().anchorNode===e.firstChild&&getSelection().anchorOffset===3')
   assert cell.get_attribute('data-initial-value')=='서버 원본'
   assert page.evaluate("state.calendarData[0].note")=='서버 원본'
   # Explicit Escape still cancels the current draft to the last committed value.
   cell.press('Escape');assert cell.inner_text()=='서버 원본';assert page.evaluate('requests.length')==1
   # The original failure behavior is retained when no newer edit exists.
   cell.focus();cell.fill('실패할 값');cell.press('Enter');page.wait_for_function('requests.length===2')
   page.evaluate("requests[1].resolve({error:{message:'unchanged fixture failure'}})")
   page.wait_for_function("document.querySelector('[data-cal-id=late-calendar][data-cal-field=note]').textContent==='서버 원본'")
   cell.focus();cell.fill('성공 재시도');cell.press('Enter');page.wait_for_function('requests.length===3')
   page.evaluate('requests[2].resolve({error:null})');page.wait_for_function("state.calendarData[0].note==='성공 재시도'")
   assert cell.inner_text()=='성공 재시도'
   print('PASS',engine,'late failed save preserves newer text/focus/caret; committed baseline/Escape, unchanged rejection and retry; production writes 0',flush=True)
   context.close();browser.close()
finally:server.shutdown()
