"""Multi-year calendar selection/cycle boundaries and read paging, without production I/O."""
import os
import tempfile
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from datetime import datetime,timezone
from urllib.parse import urlsplit
from pathlib import Path
OUTPUT=Path(os.environ.get('MINDEX_CALENDAR_YEARS_OUTPUT', str(Path(tempfile.gettempdir()) / 'calendar-multi-year-20261030')));OUTPUT.mkdir(parents=True,exist_ok=True)
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context(viewport={'width':1400,'height':900});context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.clock.install(time=datetime(2026,11,1,3,0,tzinfo=timezone.utc));page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function("typeof renderCalendarView==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    window.writes=0;state.client={from(){return {update(){writes++;throw Error('No writes expected')}}}};state.module='calendar';state.calendarYear=2026;state.calendarLoaded=true;state.calendarError='';state.calendarDetailTab='departments';
    state.calendarData=['2025-01-05','2025-11-23','2025-11-30','2026-01-04','2026-11-01','2026-11-22','2026-11-29','2026-12-27','2027-01-03','2027-11-21','2027-11-28'].map(date=>({id:'fixture-'+date,date,liturgical:'실제 절기 '+date,note:'일정 '+date,children_prayer:'담당 '+date,first_reading:'창세기 1:1'}));
    window.originalCalendar=JSON.stringify(state.calendarData);renderCalendarView();
   }''')
   year=page.get_by_role('combobox',name='연도',exact=True)
   assert year.input_value()=='2026'
   assert page.locator('[data-calendar-date="2026-11-01"]').evaluate('e=>e.classList.contains("is-today")&&e.classList.contains("is-upcoming-sunday")')
   for y,cycle,boundary in [('2025','Year C → Year A','11/30'),('2026','Year A → Year B','11/29'),('2027','Year B → Year C','11/28')]:
    year.select_option(y)
    for tab in ('성서일과','부서 일과'):
     page.get_by_role('tab',name=tab,exact=True).click()
     assert page.locator('.cal-table').get_attribute('data-calendar-year')==y
     dates=page.locator('[data-calendar-date]').evaluate_all('es=>es.map(e=>e.dataset.calendarDate)')
     assert dates and all(d.startswith(y+'-') for d in dates),(engine,y,dates)
     assert page.locator('.cal-subtitle').inner_text()==f'{y}년 · 교회력 {cycle} · {boundary} 대림절부터'
    page.screenshot(path=str(OUTPUT/f'{engine}-{y}.png'))
    assert page.locator(f'[data-cal-id="fixture-{y}-01-0'+('5' if y=='2025' else '4' if y=='2026' else '3')+'"]').count()>0
   for date,church in [('2025-11-23','2025'),('2025-11-30','2026'),('2026-11-22','2026'),('2026-11-29','2027'),('2027-11-21','2027'),('2027-11-28','2028')]:
    year.select_option(date[:4]);assert page.locator('[data-calendar-date="'+date+'"]').get_attribute('data-church-year')==church
   year.select_option('2028');assert page.locator('.cal-table').count()==0
   assert '2028년 교회력 데이터가 없습니다.' in page.get_by_role('status').inner_text()
   page.get_by_role('tab',name='성서일과',exact=True).click();assert year.input_value()=='2028';assert page.locator('.cal-table').count()==0
   year.select_option('2025');assert page.locator('[data-calendar-date="2025-01-05"]').count()==1
   before=page.evaluate('currentCalendarViewportMonth()');year.select_option('2026');year.select_option('2025');assert page.evaluate('state.calendarYearScrollMonths[2025]')==before
   assert page.evaluate('JSON.stringify(state.calendarData)===originalCalendar')
   # Fresh read snapshots invalidate the same-year render cache, even with the same view.
   old_scroll=page.locator('.cal-table-wrap').evaluate('e=>{e.scrollTop+=37;e.scrollLeft=25;return [e.scrollTop,e.scrollLeft]}')
   page.evaluate("state.calendarData=state.calendarData.map(r=>({...r,note:'최신 '+r.date}));renderCalendarView()")
   assert page.locator('[data-cal-id="fixture-2025-01-05"][data-cal-field=note]').inner_text()=='최신 2025-01-05'
   assert page.locator('.cal-table-wrap').evaluate('e=>[e.scrollTop,e.scrollLeft]')==old_scroll
   assert page.evaluate('writes')==0
   year.select_option('2026');cell=page.locator('[data-cal-id="fixture-2026-11-01"][data-cal-field=note]');cell.focus();cell.fill('조합 중 초안')
   year.evaluate("e=>{e.value='2027';e.dispatchEvent(new Event('change',{bubbles:true}))}")
   assert year.input_value()=='2026' and cell.inner_text()=='조합 중 초안' and cell.evaluate('e=>document.activeElement===e')
   cell.press('Escape');page.evaluate("state.calendarCellSaves.set('fixture','pending')");year.select_option('2027');assert year.input_value()=='2026';page.evaluate('state.calendarCellSaves.clear()')
   # Initial and refresh reads cover old years and pages beyond Supabase's row cap.
   result=page.evaluate('''async()=>{
    window.readPages=[];window.failPage=false;const data=Array.from({length:1005},(_,i)=>{const date=new Date(2025,0,1);date.setDate(date.getDate()+i);return {id:'page-'+i,date:toLocalDateStr(date),note:'actual '+i}});
    state.client={from(table){const q={select(){return q},order(){return q},gte(){throw Error('Fixed lower-year filter forbidden')},range(a,b){readPages.push([a,b]);if(failPage&&a)return Promise.resolve({data:null,error:{message:'second page failed'}});return Promise.resolve({data:data.slice(a,b+1),error:null})}};return q}};
    await loadCalendarData({refresh:true,silent:true});return {pages:readPages.length,count:state.calendarData.length,first:state.calendarData[0].date,lastId:state.calendarData.at(-1).id,writes};
   }''')
   assert result['pages']>=2 and result['count']==1005 and result['first']=='2025-01-01' and result['lastId']=='page-1004' and result['writes']==0,result
   failed=page.evaluate("async()=>{const before=state.calendarData;failPage=true;await loadCalendarData({refresh:true,silent:true});return {kept:before===state.calendarData,error:state.calendarError}}")
   assert failed=={'kept':True,'error':'second page failed'}
   page.evaluate("async()=>{failPage=false;await loadCalendarData({refresh:true,silent:true})}")
   for width in (390,768,1400):
    page.set_viewport_size({'width':width,'height':900});year.focus();assert year.evaluate('e=>getComputedStyle(e).outlineWidth')=='2px'
   print('PASS',engine,'2025/2026/2027 views, Jan/Dec and Advent A/B/C, empty year, year scroll/cache, draft/pending guards, 1005-row read; production writes 0',flush=True)
   context.close();browser.close()
finally:server.shutdown()
