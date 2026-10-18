"""Isolated browser profiles: remote signal, recovery and late-interaction protection."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   contexts=[browser.new_context() for _ in range(2)];pages=[];messages=[]
   for context in contexts:
    context.add_init_script('window.open=()=>null;Element.prototype.requestFullscreen=async()=>{}')
    context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page=context.new_page();pages.append(page)
    page.expose_function('remoteSend',lambda message:messages.append(message))
    page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
    page.wait_for_function("typeof connectDepartmentRealtime==='function'")
    page.evaluate('''()=>{
      state.config.url='remote-fixture';state.module='calendar';state.loading=false;state.saving=false;
      state.presenter.outputPendingAt=0;window.output=false;isPresenterOutputWindowOpen=()=>output;
      state.services=[];state.calendarLoaded=true;
      window.row={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date:'2026-10-25',children_prayer:'A'};
      state.calendarData=[row];window.dbValue='A';window.reads=0;window.removed=0;window.created=0;
      window.query=async()=>{reads++;if(window.delayRead)await new Promise(r=>window.releaseRead=r);return {data:[{...row,children_prayer:dbValue}]}};
      state.client={from:()=>({select:()=>({eq:query,in:query})}),removeChannel:async()=>{removed++},
        channel:()=>{created++;return {on(event,filter,fn){window.remoteReceive=fn;return this},subscribe(fn){window.remoteStatus=fn;return this},send:remoteSend}}};
      document.body.innerHTML='<table><tbody><tr><td contenteditable="true" data-cal-id="'+row.id+'" data-cal-field="children_prayer">A</td></tr></tbody></table><button id="outside">Outside</button>';
      window.cell=document.querySelector('td');connectDepartmentRealtime();
    }''')
   a,b=pages
   def send(value):
    b.evaluate('(v)=>dbValue=v',value)
    a.evaluate('publishDepartmentTabChange(row,[])')
    a.wait_for_timeout(20)
    message=messages.pop()['payload']
    assert set(message)=={'id','project','calendarId','serviceIds'}
    b.evaluate('(payload)=>remoteReceive({payload})',message)
   send('B');b.wait_for_function("row.children_prayer==='B'")
   b.evaluate("cell.focus();cell.textContent='draft'");send('C')
   b.wait_for_timeout(300)
   assert b.evaluate("cell.textContent==='draft'&&row.children_prayer==='B'")
   b.evaluate("cell.textContent='B';cell.blur();document.getElementById('outside').focus()")
   b.wait_for_function("row.children_prayer==='C'")
   b.evaluate('output=true');send('D');b.wait_for_timeout(300)
   assert b.evaluate("row.children_prayer==='C'")
   b.evaluate('output=false');b.wait_for_function("row.children_prayer==='D'")
   # Missed notification is recovered on re-subscription, including explicit clear.
   b.evaluate("dbValue='';remoteStatus('SUBSCRIBED')")
   b.wait_for_function("row.children_prayer===''&&cell.textContent===''")
   # Output starts while the DB request is in flight: do not adopt the result.
   b.evaluate('delayRead=true');send('E');b.wait_for_function("typeof releaseRead==='function'")
   b.evaluate('output=true;delayRead=false;releaseRead()');b.wait_for_timeout(100)
   assert b.evaluate("row.children_prayer===''&&departmentTabSync.pending.size===1")
   b.evaluate('output=false');b.wait_for_function("row.children_prayer==='E'")
   # Native inline media is not replaced while playing, even without output.
   b.evaluate("window.media=document.createElement('audio');window.mediaPlaying=true;Object.defineProperty(media,'paused',{get:()=>!mediaPlaying});document.body.append(media)")
   send('F');b.wait_for_timeout(300)
   assert b.evaluate("row.children_prayer==='E'")
   b.evaluate('mediaPlaying=false');b.wait_for_function("row.children_prayer==='F'")
   # Old client callbacks cannot affect a replacement connection.
   b.evaluate('''()=>{window.oldReceive=remoteReceive;state.client={...state.client};connectDepartmentRealtime();connectDepartmentRealtime();
     if(created!==2||removed!==1)throw Error('channel lifecycle');}''')
   b.evaluate("oldReceive({payload:{id:'old',project:'remote-fixture',calendarId:row.id,serviceIds:[]}})")
   assert b.evaluate('departmentTabSync.pending.size')==0
   count=b.evaluate('reads');b.evaluate('reconcileDepartmentRealtime()');b.wait_for_timeout(300)
   assert b.evaluate('reads')==count+1
   print('PASS',engine,'isolated profiles, identifier-only signal, draft/output protection, reconnect clear, in-flight guard, client replacement, unchanged projection',flush=True)
   for context in contexts:context.close()
   browser.close()
finally:server.shutdown()
