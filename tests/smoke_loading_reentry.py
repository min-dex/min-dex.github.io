"""Concurrent entry shares reads; completion belongs to the selected chapter."""
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
                    page.wait_for_function("typeof loadReferenceLinks==='function' && typeof state!=='undefined' && !document.body.classList.contains('ui-booting')")
                    result = page.evaluate('''async () => {
                      const check=(v,m)=>{if(!v)throw Error(m)};
                      const tick=()=>new Promise(r=>setTimeout(r,20));
                      state.auth.session={user:{id:'fixture'}};state.connectionError='';state.module='manuals';
                      state.bibleTranslations=[{id:'fixture',name:'fixture'}];
                      state.scriptureBooks=[{code:'GEN',koreanName:'창세기',chapterCount:50,testament:'old'}];
                      TABLE_COLUMN_SUPPORT_CACHE.delete('mindex_reference_links.group_name');
                      let reads=0,probes=0;const pending=[];
                      state.client={from(){const q={select(){return q},eq(){return q},order(){return q},limit(){probes++;return Promise.resolve({data:[],error:null})},range(){reads++;return new Promise(r=>pending.push(r))}};return q}};
                      for(const module of ['references','scripture']) {
                        const load=module==='references'?loadReferenceLinks:loadScriptures;
                        if(module==='references'){state.referenceLinksLoaded=false;state.referenceError='';}
                        else {state.scripturesLoaded=false;state.scriptureError='';}
                        const before=reads;
                        runModuleEntryLoads(module);await tick();runModuleEntryLoads(module);await tick();
                        check(reads===before+1 && pending.length===1,module+' duplicate entry read');
                        if(module==='scripture')check(state.loadingModules.has('scripture'),'Scripture stopped loading before response');
                        pending.shift()({data:[],error:null});await tick();
                        runModuleEntryLoads(module);await tick();check(reads===before+1,module+' empty result reloaded');
                        const refresh=load({silent:true});await tick();check(reads===before+2,module+' refresh skipped');
                        pending.shift()({data:[],error:new Error('fixture failure')});await refresh;
                        check(module==='references'?!!state.referenceError:!!state.scriptureError,module+' error lost');
                        const retry=load({silent:true});await tick();check(reads===before+3,module+' retry blocked');
                        pending.shift()({data:[],error:null});await retry;
                        check(module==='references'?!state.referenceError:!state.scriptureError,module+' retry error retained');
                      }
                      check(probes===1,'Concurrent reference capability probes');
                      check(!state.loadingModules.has('scripture'),'Scripture loading retained');
                      const chapters=[];
                      state.client={from(){let chapter;const q={select(){return q},eq(k,v){if(k==='chapter')chapter=v;return q},order(){return new Promise(resolve=>chapters.push({chapter,resolve}))}};return q}};
                      state.selectedBookCode='GEN';state.selectedBibleTranslationId='reentry-'+Date.now();
                      state.bibleTranslations=[{id:state.selectedBibleTranslationId,name:'fixture'}];state.module='scripture';
                      const select=n=>{state.selectedBibleChapter=n;return loadBibleBookVerses({silent:true})};
                      const a=select(1),b=select(2),again=select(1);
                      check(chapters.length===2,'A-B-A duplicated chapter A');
                      chapters[1].resolve({data:null,error:new Error('stale B')});await b;
                      check(state.bibleReaderLoading && !state.bibleReaderError,'Stale B changed A loading/error');
                      chapters[0].resolve({data:[{book_code:'GEN',chapter:1,verse:1,text:'A text'}],error:null});await Promise.all([a,again]);
                      check(!state.bibleReaderLoading && state.bibleBookVerses[0].text==='A text','A did not display');
                      await select(1);check(chapters.length===2 && !state.bibleReaderLoading,'Cached A reload');
                      const fail=select(3),failAgain=select(3);
                      check(chapters.length===3,'Failure request duplicated');chapters[2].resolve({data:null,error:new Error('current failure')});await Promise.all([fail,failAgain]);
                      check(!state.bibleReaderLoading && !!state.bibleReaderError,'Current failure retained loading');
                      const retry=select(3);check(chapters.length===4,'Failed chapter retry blocked');
                      chapters[3].resolve({data:[],error:null});await retry;
                      check(!state.bibleReaderLoading && !state.bibleReaderError,'Chapter retry retained error/loading');
                      check(bibleBookVerseLoadPromises.size===0,'Completed requests retained');
                      return {sharedEntries:true,emptyReuse:true,explicitRefresh:true,errorRetry:true,chapterReturn:true,staleFailure:true};
                    }''')
                    print('PASS', engine, result, flush=True)
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
