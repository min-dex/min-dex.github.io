"""Deterministic presence cadence, reload continuity and copied-tab isolation."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

HTML = '''<button id="monitorPanelBtn">현황</button><script>
window.clock=2000000000000; Date.now=()=>clock;
window.ticks={};window.setInterval=(fn,ms)=>{ticks[ms]=fn;return ms};
window.calls=[];window.isPresenterOutputRoute=()=>false;window.PRESENTER_OUTPUT_HEARTBEAT_TTL_MS=5000;
window.state={presenter:{outputConnectedAt:0},client:{rpc:(name,args)=>({abortSignal:()=>{
 calls.push({name,args});let data=true;
 if(name==='mindex_monitor_register')data=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 if(name==='mindex_monitor_ping')data=args.p_token!=='0'.repeat(64);
 if(name==='mindex_monitor_presence')data=[];
 return Promise.resolve({data,error:null});
}})}};
</script><script src="/mindex.monitor.js"></script>'''

def main():
    server,url=start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                context=browser.new_context()
                context.route('**/presence-fixture',lambda r:r.fulfill(content_type='text/html',body=HTML))
                page=context.new_page();page.goto(url.rsplit('/',1)[0]+'/presence-fixture')
                page.wait_for_function("calls.some(c=>c.name==='mindex_monitor_ping')")
                token=page.evaluate("sessionStorage.getItem('mindex.monitor.reporter')")
                assert len(token)==64
                page.evaluate('clock+=59000;ticks[2000]()')
                assert page.evaluate("calls.filter(c=>c.name==='mindex_monitor_ping').length")==1
                page.evaluate('clock+=1000;ticks[60000]()')
                page.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').length===2")
                page.evaluate('state.presenter.outputConnectedAt=clock;ticks[2000]()')
                page.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').length===3")
                assert page.evaluate("calls.at(-1).args.p_status.output") is True
                page.evaluate('state.presenter.outputConnectedAt=0;ticks[2000]()')
                page.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').length===4")
                assert page.evaluate("calls.at(-1).args.p_status.output") is False
                page.reload();page.wait_for_function("calls.some(c=>c.name==='mindex_monitor_ping')")
                assert page.evaluate("calls.filter(c=>c.name==='mindex_monitor_register').length")==0
                assert page.evaluate("sessionStorage.getItem('mindex.monitor.reporter')")==token
                copy=context.new_page()
                copy.add_init_script(f"sessionStorage.setItem('mindex.monitor.reporter','{token}')")
                copy.goto(url.rsplit('/',1)[0]+'/presence-fixture');copy.wait_for_function("calls.some(c=>c.name==='mindex_monitor_ping')")
                assert copy.evaluate("sessionStorage.getItem('mindex.monitor.reporter')")!=token
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'));ticks[60000]()")
                assert not page.evaluate("calls.some(c=>c.name==='mindex_monitor_leave')")
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
                page.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').length===2")
                expired=context.new_page();expired.add_init_script("sessionStorage.setItem('mindex.monitor.reporter','0'.repeat(64))")
                expired.goto(url.rsplit('/',1)[0]+'/presence-fixture');expired.wait_for_function("calls.filter(c=>c.name==='mindex_monitor_ping').length===2")
                assert expired.evaluate("calls.filter(c=>c.name==='mindex_monitor_register').length")==1
                context.close();browser.close()
                print(engine,'PASS 60-second cadence, immediate output changes, reload token reuse, copied-tab isolation, bfcache, expired-token renewal')
    finally:server.shutdown()

if __name__=='__main__':main()
