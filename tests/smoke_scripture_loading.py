"""Cached chapter returns must release loading; a successful empty list is loaded."""
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
                    page.goto(url+'?mindexSmokeRaw=1', wait_until='domcontentloaded')
                    page.wait_for_function("typeof loadBibleBookVerses==='function' && typeof state!=='undefined' && !document.body.classList.contains('ui-booting')")
                    print(engine, page.evaluate("""async () => {
                      const savedLoad=loadBibleTranslations,savedBooks=ensureBibleBookLookups;
                      const sid='edition-entry',id='00000000-0000-0000-0000-000000000001';
                      const memo={scriptureTranslationId:id,scriptureReferences:['창세기 1:1']};
                      const item={id:'reading',label:'성경봉독',raw_title:'창세기 1:1',memo:JSON.stringify(memo)};
                      const before=JSON.stringify(item);
                      try {
                        state.client={};state.auth.session={user:{id:'fixture'}};state.connectionError='';
                        state.scriptureBooks=[{code:'GEN',koreanName:'창세기',chapterCount:50,testament:'old'}];
                        state.bibleTranslations=[];state.bibleReaderError='';
                        ensureBibleBookLookups=async()=>{};
                        loadBibleTranslations=async()=>{await new Promise(r=>setTimeout(r,30));state.bibleTranslations=[{id,name:'개역개정',abbreviation:'개역개정'}]};
                        const pending=serviceItemBibleTranslation(item,memo);
                        state.bibleVerseCache.set(bibleVerseCacheKey(id,'GEN',1),[{book_code:'GEN',chapter:1,verse:1,text:'검증용 본문'}]);
                        const result=await validateScriptureReferences(item.raw_title,pending);
                        if(result.translation.id!==id||result.resolved[0].verses[0].text!=='검증용 본문')throw Error('Cold entry edition unresolved');
                        if(JSON.stringify(item)!==before)throw Error('Saved selection changed');
                        state.bibleTranslations=[];
                        const rows=await fetchServiceScriptureVerses(result.entries[0].reference,pending);
                        if(rows[0]?.text!=='검증용 본문')throw Error('Cold direct fetch unresolved');
                        return 'PASS delayed entry catalogue keeps explicit edition and scripture body';
                      } finally {loadBibleTranslations=savedLoad;ensureBibleBookLookups=savedBooks;}
                    }"""), flush=True)
                    result = page.evaluate('''async () => {
                      const check=(v,m)=>{if(!v)throw Error(m)};
                      state.auth.session={user:{id:'fixture'}};state.connectionError='';state.module='scripture';
                      state.scriptureBooks=[{code:'GEN',koreanName:'창세기',chapterCount:50,testament:'old'}];
                      state.selectedBookCode='GEN';state.selectedScriptureId=null;
                      state.bibleTranslations=['audit-memory','audit-persistent','audit-pending'].map(id=>({id,name:id}));
                      const waiters=[];
                      state.client={from(){const q={select(){return q},eq(){return q},order(){return new Promise(resolve=>waiters.push(resolve))}};return q}};
                      for(const persistent of [false,true]) {
                        const translation=persistent?'audit-persistent':'audit-memory';
                        state.selectedBibleTranslationId=translation;state.selectedBibleChapter=2;
                        const rows=[{book_code:'GEN',chapter:1,verse:1,text:'캐시 본문'}];
                        if(persistent)writePersistentBibleChapterCache(translation,'GEN',1,rows);
                        else state.bibleVerseCache.set(bibleVerseCacheKey(translation,'GEN',1),rows);
                        const slow=loadBibleBookVerses({silent:true});
                        check(waiters.length===1,'Expected delayed request');
                        state.selectedBibleChapter=1;await loadBibleBookVerses({silent:true});
                        check(!state.bibleReaderLoading,'Cached chapter retains loading');
                        check(document.querySelector('.bible-reader')?.textContent.includes('캐시 본문'),'Cached text hidden by skeleton');
                        waiters.shift()(persistent?{data:null,error:new Error('old failure')}:{data:[],error:null});await slow;
                        check(!state.bibleReaderLoading && !state.bibleReaderError && state.bibleBookVerses[0].text==='캐시 본문','Stale result replaced cache');
                      }
                      state.selectedBibleTranslationId='audit-pending';state.selectedBibleChapter=2;
                      const old=loadBibleBookVerses({silent:true});
                      state.selectedBibleChapter=3;const current=loadBibleBookVerses({silent:true});
                      waiters.shift()({data:[],error:null});await old;
                      check(state.bibleReaderLoading,'Old completion cleared new loading');
                      waiters.shift()({data:[],error:null});await current;
                      check(!state.bibleReaderLoading,'New completion stays loading');
                      state.selectedBookCode=null;state.bibleReaderLoading=true;
                      await loadBibleBookVerses({silent:true});check(!state.bibleReaderLoading,'Empty selection stays loading');

                      let requests=0,fail=false;
                      state.client={from(){const q={select(){return q},eq(){return q},order(){return q},range(){requests++;return Promise.resolve({data:[],error:fail?new Error('offline'):null})}};return q}};
                      state.scripturesLoaded=false;state.scriptureError='';
                      await loadScriptures({silent:true});
                      check(state.scripturesLoaded && state.scriptures.length===0 && requests===1,'Empty list not marked loaded');
                      for(let i=0;i<3;i++){runModuleEntryLoads('scripture');await new Promise(r=>setTimeout(r,10));}
                      check(requests===1,'Empty list refetched on reentry');
                      await loadScriptures({silent:true});check(requests===2,'Explicit refresh skipped');
                      state.scripturesLoaded=false;fail=true;await loadScriptures({silent:true});
                      check(!state.scripturesLoaded && state.scriptureError,'Failed load marked complete');
                      return {memoryCache:true,persistentCache:true,staleSuccessAndFailure:true,newerLoading:true,emptyList:true,explicitRefresh:true};
                    }''')
                    print('PASS', engine, result, flush=True)
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
