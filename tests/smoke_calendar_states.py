"""Calendar date status stays distinct from pointer and editing focus; no DB I/O."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for theme in ('light','dark'):
    page=browser.new_page(viewport={'width':1500,'height':900},color_scheme=theme)
    page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.goto(url,wait_until='load');page.wait_for_function("typeof renderCalendarView==='function'")
    page.wait_for_function("!document.body.classList.contains('ui-booting')")
    page.locator('#bootStatus').wait_for(state='hidden')
    for tab in ('departments','lectionary'):
     page.evaluate('''([theme,tab])=>{
      document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme;
      state.client={};state.calendarLoaded=true;state.calendarError='';state.calendarDetailTab=tab;
      const next=nextSundayDate(toLocalDateStr(new Date()));const later=parseLocalDate(next);later.setDate(later.getDate()+7);
      state.calendarData=[{id:'upcoming',date:next,liturgical:'돌아오는 예배'},{id:'later',date:toLocalDateStr(later),liturgical:'다음 예배'}];
      refs.detailPane.innerHTML='';renderCalendarView();
     }''',[theme,tab])
     row=page.locator('.cal-row.is-upcoming-sunday');other=page.locator('.cal-row').filter(has=page.locator('[data-cal-id="later"]'))
     row.scroll_into_view_if_needed();page.mouse.move(0,0)
     bg=lambda l:l.evaluate('e=>getComputedStyle(e).backgroundColor')
     base=bg(other.locator('.cal-lit'));assert bg(row.locator('.cal-lit'))==base
     marker=row.locator('.cal-date').evaluate('e=>getComputedStyle(e).boxShadow');assert marker!='none'
     other.hover();hover=bg(other.locator('.cal-lit'));assert hover!=base
     cell=other.locator('td.cal-cell').first;cell.focus();assert bg(cell)!=hover
     assert cell.evaluate('e=>getComputedStyle(e).outlineStyle')=='solid'
     row.hover();assert bg(row.locator('.cal-lit'))==hover
     assert row.locator('.cal-date').evaluate('e=>getComputedStyle(e).boxShadow')==marker
     row.locator('td.cal-cell').first.focus();assert bg(row.locator('td.cal-cell').first)!=hover
     page.screenshot(path=f'/private/tmp/calendar-states-{engine}-{theme}-{tab}.png')
     print('PASS',engine,theme,tab,'date marker / neutral hover / outlined cell focus',flush=True)
    page.close()
   browser.close()
finally:server.shutdown()
