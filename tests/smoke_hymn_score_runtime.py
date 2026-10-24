from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page()
                    page.route('**/*supabase*/**', lambda r: r.abort())
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_function("typeof loadHymnScoreManifest==='function' && !document.body.classList.contains('ui-booting')")
                    print(engine, page.evaluate('''async()=>{
                      const check=(v,m)=>{if(!v)throw Error(m)};
                      const id='score-entry-fixture',sid='11111111-1111-4111-8111-111111111111';
                      const vid='22222222-2222-4222-8222-222222222222';
                      const service={id,type_id:'special',date:toLocalDateStr(new Date())};
                      state.client={};state.serviceError='';state.loading=false;
                      state.serviceTypes=[{id:'special',name:'특별예배'}];state.services=[service];
                      state.selectedServiceId=id;state.presenter.viewServiceId=id;state.module='presenter';
                      state.loadedWorshipServiceIds.add(id);state.loadedWorshipPresenterServiceIds.add(id);
                      state.songs=[{id:sid,title:'만복의 근원 하나님',hymn_no:'1',_relationalVersionsLoaded:true,default_version_id:vid,versions:[{id:vid,name:'새찬송가',hymn_no:'1',forms:[]}]}];
                      state.serviceItems[id]=[normalizeServiceItem({id:'score-item',service_id:id,label:'찬양',song_id:sid,version_id:vid,song_version_id:vid,raw_title:'1 만복의 근원 하나님',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})},0)];
                      loadFullServiceSourceRefInBackground=()=>{};
                      state.hymnScoreManifestLoaded=false;state.hymnScoreManifest={};
                      const source=JSON.stringify(state.serviceItems),transport=JSON.stringify(state.presenter);
                      let calls=0,release;const oldFetch=window.fetch;
                      window.fetch=(url,options)=>{if(!String(url).includes('manifest.runtime.json'))return oldFetch(url,options);calls++;return new Promise(resolve=>release=()=>resolve(oldFetch(url,options)))};
                      try {
                        renderPresenterDetail();
                        check(!state.hymnScoreManifestLoaded,'render unexpectedly loaded manifest');
                        check(buildServicePresenterSlides(id).some(s=>s.warnings?.includes('불러오는 중')),'missing initial loading fixture '+JSON.stringify(getServiceOutputItems(id).map(i=>({label:i.label,mode:serviceItemOutputMode(i),song:i.song_id,choice:serviceItemNeedsVersionChoice(i)}))));
                        const first=loadServiceItems(id),second=loadServiceItems(id);
                        check(calls===1,'entry download must coalesce');
                        const input=document.querySelector('#servicePresenterControls input[type=text], #servicePresenterControls textarea');
                        if(input){input.value='draft';input.focus();if(input.type==='text')input.setSelectionRange(1,3);}
                        const value=input?.value,focus=document.activeElement,selection=input?.selectionStart;
                        release();await Promise.all([first,second]);
                        check(state.hymnScoreManifestLoaded,'cached entry missed manifest');
                        check(!buildServicePresenterSlides(id).some(s=>s.warnings?.includes('불러오는 중')),'loading stayed after score download');
                        check(JSON.stringify(state.serviceItems)===source,'entry changed service input');
                        check(JSON.stringify(state.presenter)===transport,'entry changed transport');
                        if(input){check(input.isConnected&&input.value===value&&document.activeElement===focus&&input.selectionStart===selection,'score update replaced focused draft');}
                        await loadServiceItems(id);check(calls===1,'reentry redownloaded manifest');
                        return 'PASS cached first entry, real score board, coalescing, draft/focus and transport retention';
                      }finally{window.fetch=oldFetch;}
                    }'''))
                    page.screenshot(path=str(__import__('pathlib').Path(__import__('tempfile').gettempdir()) / f'mindex-score-entry-{engine}.png'))
                    page.close()
                    page=browser.new_page()
                    page.route('**/*supabase*/**', lambda r:r.abort())
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_function("typeof loadHymnScoreManifest==='function' && !document.body.classList.contains('ui-booting')")
                    print(engine, page.evaluate('''async()=>{
                      const check=(v,m)=>{if(!v)throw Error(m)};
                      const oldFetch=window.fetch;let calls=0,full=0,patch=0,release;
                      state.module='presenter';state.hymnScoreManifestLoaded=false;state.hymnScoreManifest={};
                      render=()=>full++;renderPresenterControlState=()=>patch++;
                      window.fetch=(url,options)=>{calls++;check(url.includes('manifest.runtime.json?v='),'unversioned manifest');check(!options?.cache||options.cache!=='no-cache','cache bypass');return new Promise(resolve=>release=resolve)};
                      try{
                        const first=loadHymnScoreManifest({silent:true});const same=loadHymnScoreManifest({silent:true});
                        check(calls===1,'duplicate download');release({ok:false,status:503});await Promise.all([first,same]);
                        check(!state.hymnScoreManifestLoaded,'failure marked loaded');
                        const retry=loadHymnScoreManifest({silent:true});release({ok:true,json:async()=>({'1':{title:'Fixture',slides:[]}})});await retry;
                        check(calls===2&&state.hymnScoreManifestLoaded,'retry failed');check(patch===1&&full===0,'manifest rebuilt full screen');
                        await loadHymnScoreManifest();check(calls===2,'loaded manifest downloaded again');
                        return 'PASS versioned cache, in-flight deduplication, failure/retry, patch-only update';
                      }finally{window.fetch=oldFetch}
                    }'''))
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
