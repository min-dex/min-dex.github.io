"""Same-profile device presence, shared names, OR output and independent profiles."""
from smoke_app import prepare_server_state_fixture,launch_chromium,start_local_app_server,sync_playwright
HTML='''<meta charset="utf-8"><button id="monitorPanelBtn">현황</button><script>
window.clock=2000000000000;Date.now=()=>clock;
window.ticks={};window.setInterval=(fn,ms)=>{ticks[ms]=fn;return ms};
window.calls=[];window.isPresenterOutputRoute=()=>false;window.PRESENTER_OUTPUT_HEARTBEAT_TTL_MS=5000;
window.state={presenter:{outputConnectedAt:0},client:{rpc:(name,args)=>({abortSignal:()=>{
 calls.push({name,args});let data=true;
 if(name==='mindex_monitor_register')data=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 if(name==='mindex_monitor_ping')data=args.p_token!=='0'.repeat(64);
 if(name==='mindex_monitor_presence')data=[{id:'12345678-abcd',last_seen:new Date(clock).toISOString(),status:{name:'본당 송출 PC',os:'Windows',browser:'Chrome',output:true}}];
 return Promise.resolve({data,error:null});
}})}};</script><script src="/mindex.server-storage.js"></script><script src="/mindex.monitor.js"></script>'''
def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as p:
   for engine in ('chromium','webkit'):
    browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
    context=browser.new_context();context.route('**/presence-fixture',lambda r:r.fulfill(content_type='text/html',body=HTML))
    def new(ctx):
     page=ctx.new_page();page.goto(url.rsplit('/',1)[0]+'/presence-fixture');page.wait_for_function("calls.some(c=>c.name==='mindex_monitor_ping')");prepare_server_state_fixture(page);return page
    page=new(context);token=page.evaluate("localStorage.getItem('mindex.monitor.deviceReporter')");assert len(token)==64
    copy=new(context);assert copy.evaluate("calls.filter(c=>c.name==='mindex_monitor_register').length")==0
    assert copy.evaluate("calls.find(c=>c.name==='mindex_monitor_ping').args.p_token")==token
    page.locator('#monitorPanelBtn').click();page.get_by_label('기기 이름').fill('본당 송출 PC');page.get_by_label('기기 이름').press('Tab')
    copy.wait_for_function("document.querySelector('#monitorName').value==='본당 송출 PC'")
    assert '12345678' not in page.locator('[data-devices]').inner_text()
    assert page.locator('[data-devices] .monitor-device').count()==1
    page.evaluate('state.presenter.outputConnectedAt=clock;ticks[2000]()')
    copy.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').at(-1).args.p_status.output===true")
    copy.evaluate('ticks[60000]()')
    copy.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').at(-1).args.p_status.output===true")
    page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))")
    copy.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').at(-1).args.p_status.output===false")
    copy.reload();copy.wait_for_function("calls.some(c=>c.name==='mindex_monitor_ping')")
    assert copy.evaluate("calls.filter(c=>c.name==='mindex_monitor_register').length")==0
    other=browser.new_context();other.route('**/presence-fixture',lambda r:r.fulfill(content_type='text/html',body=HTML));separate=new(other)
    assert separate.evaluate("localStorage.getItem('mindex.monitor.deviceReporter')")!=token
    copy.evaluate("localStorage.setItem('mindex.monitor.deviceReporter','0'.repeat(64));ticks[60000]()")
    copy.wait_for_function("calls.some(c=>c.name==='mindex_monitor_register')")
    assert copy.evaluate("localStorage.getItem('mindex.monitor.deviceReporter')") not in (token,'0'*64)
    other.close();context.close();browser.close();print(engine,'PASS one reporter per profile, shared name, OR output, closed tab, reload, separate profile and expired token')
 finally:server.shutdown()
if __name__=='__main__':main()
