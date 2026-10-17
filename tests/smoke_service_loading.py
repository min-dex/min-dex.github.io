"""Offline delayed worship reads: pending is never missing content."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
    server,url=start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                try:
                    page=browser.new_page(viewport={'width':1280,'height':800})
                    page.route('**/*supabase*/**',lambda r:r.abort())
                    page.goto(url+'?mindexSmokeRaw=1',wait_until='domcontentloaded')
                    page.wait_for_function("typeof renderServiceViewLoadingIfNeeded==='function'")
                    page.evaluate("""()=>{
                      window.loadTest={reads:0,queue:[],songs:[]};
                      state.client={};canUseClientData=()=>true;shouldDeferPastWorshipServiceLoad=()=>false;
                      loadFullServiceSourceRefInBackground=()=>{};
                      warmWorshipScriptureReferencesForService=()=>Promise.resolve(false);
                      warmServiceItemScriptureReferencesForService=()=>Promise.resolve(false);
                      preloadPresenterServiceAssetsBeforeOutput=()=>false;
                      preloadPresenterServiceScripturesBeforeOutput=()=>Promise.resolve(false);
                      presenterServiceNeedsHymnScoreManifest=()=>false;
                      state.module='presenter';state.serviceError='';state.connectionError='';state.loading=false;
                      state.serviceTypes=[{id:'sunday-main',name:'주일예배 [3부]'}];
                      state.services=['a','b','c'].map(id=>({id,date:'2026-10-18',type_id:'sunday-main',title:'검증 예배 '+id}));
                      state.serviceItems={a:[],b:[],c:[]};state.loadedWorshipServiceIds=new Set();
                      state.worshipSections=[];state.worshipElements=[];state.dirty.service=false;
                      state.dirtyServiceElementIds=new Map();state.dirtyServiceStructureIds=new Set();
                      fetchWorshipRowsForServiceIds=async ids=>{loadTest.reads++;return new Promise((resolve,reject)=>loadTest.queue.push({id:ids[0],resolve,reject}))};
                      loadSongsForIds=()=>new Promise(resolve=>loadTest.songs.push(resolve));
                      window.selectLoadingTest=id=>{state.selectedServiceId=id;state.presenter.viewServiceId=id;renderServiceList();renderPresenterDetail()};
                      selectLoadingTest('a');
                    }""")
                    page.wait_for_selector('[data-service-view-loading="a"]')
                    assert not page.locator('.service-outline-badge').count()
                    for theme in ('light','dark'):
                        page.evaluate('(theme)=>applyTheme(theme)',theme)
                        for width,height in ((1440,1000),(1280,800),(1000,600),(800,400),(390,640)):
                            page.set_viewport_size({'width':width,'height':height})
                            geometry=page.locator('.service-view-loading').evaluate("""el=>{
                              const pane=el.parentElement.getBoundingClientRect(),box=el.getBoundingClientRect();
                              const children=[...el.children].map(x=>{const r=x.getBoundingClientRect();return {top:r.top+(r.height-x.offsetHeight)/2,bottom:r.bottom-(r.height-x.offsetHeight)/2,height:x.offsetHeight}}).filter(x=>x.height);
                              const top=Math.min(...children.map(x=>x.top)),bottom=Math.max(...children.map(x=>x.bottom));
                              return {height:Math.abs(box.height-pane.height),center:Math.abs((top+bottom-pane.top-pane.bottom)/2),overflow:el.scrollWidth>el.clientWidth+1};
                            }""")
                            assert geometry['height']<2 and geometry['center']<2 and not geometry['overflow'],(engine,theme,width,height,geometry)
                            if width in (1280,800):page.screenshot(path=f'/tmp/mindex-loading-center-{engine}-{theme}-{width}.png')
                    page.set_viewport_size({'width':1280,'height':800})
                    page.evaluate("""()=>{
                      const item=normalizeServiceItem({id:'missing-prayer',service_id:'a',label:'대표기도',raw_title:'',assignee:'',_worshipSectionKey:'representative_prayer',memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text'})});
                      const rows=buildWorshipPersistenceRows(state.services[0],[item],{}, {},{elementTypedStateColumns:{inputMode:true,contentState:true}});
                      loadTest.queue.shift().resolve(rows);
                    }""")
                    page.wait_for_function('loadTest.songs.length===1')
                    assert page.locator('[data-service-view-loading="a"]').count()==1
                    assert not page.locator('.service-outline-badge').count()
                    page.evaluate('loadTest.songs.shift()()')
                    page.wait_for_function('loadTest.songs.length===1')
                    page.evaluate('loadTest.songs.shift()()')
                    page.wait_for_selector('#servicePresenterControls')
                    assert not page.locator('[data-service-view-loading]').count()
                    assert page.locator('.service-outline-badge').count()>0, 'real missing input not shown after readiness'
                    assert page.evaluate('loadTest.reads')==1
                    page.evaluate("selectLoadingTest('a')")
                    assert not page.locator('[data-service-view-loading]').count()
                    assert page.evaluate('loadTest.reads')==1
                    page.evaluate("""()=>{
                      const root=document.getElementById('servicePresenterControls');
                      state.presenter.serviceId='a';state.presenter.outputWindow={closed:false};
                      serviceViewLoadErrors.set('a',true);
                      serviceItemLoadPromises.set('a',Promise.resolve());
                      if(renderServiceViewLoadingIfNeeded(state.services[0]) || document.getElementById('servicePresenterControls')!==root)throw Error('live controls replaced');
                      serviceViewLoadErrors.delete('a');serviceItemLoadPromises.delete('a');state.presenter.outputWindow=null;state.presenter.serviceId=null;
                    }""")
                    page.evaluate("selectLoadingTest('b');loadTest.queue.shift().reject(Error('offline'))")
                    page.wait_for_selector('[data-service-load-retry="b"]')
                    assert page.locator('[data-service-view-loading]').get_attribute('aria-busy')=='false'
                    assert page.locator('.service-view-loading').evaluate("""el=>{
                      const p=el.parentElement.getBoundingClientRect(),first=el.firstElementChild.getBoundingClientRect(),last=el.lastElementChild.getBoundingClientRect();
                      return Math.abs((first.top+last.bottom-p.top-p.bottom)/2)<2 && el.scrollWidth<=el.clientWidth+1;
                    }"""), 'retry layout off center'
                    page.locator('[data-service-load-retry="b"]').click()
                    page.wait_for_function('loadTest.queue.length===1')
                    page.evaluate("selectLoadingTest('c');loadTest.queue.shift().resolve({sections:[],elements:[]})")
                    page.wait_for_function('loadTest.songs.length>=1')
                    assert page.locator('[data-service-view-loading="c"]').count()==1
                    assert page.evaluate('state.selectedServiceId')=='c'
                    print(engine,'PASS placeholders, delayed rows/songs, cached revisit, error/retry and stale completion isolation',flush=True)
                finally: browser.close()
    finally:server.shutdown()

if __name__=='__main__':main()
