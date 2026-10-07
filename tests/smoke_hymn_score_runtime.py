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
                    page.wait_for_function("typeof loadHymnScoreManifest==='function'")
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
