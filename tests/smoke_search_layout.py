import os
os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chrome', 'webkit'):
            browser = launch_chromium(p) if engine == 'chrome' else p.webkit.launch()
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_function("typeof renderGlobalSearchSections === 'function' && !document.body.classList.contains('ui-booting')")
            print(engine, page.evaluate('''() => {
              const check=(v,m)=>{if(!v)throw Error(m)};
              songCatalogLoaded=true;state.search='많은 사람들';
              const results={praise:[{id:'song',title:'난 예수가 좋다오',versions:[]}],scripture:[{kind:'text',query:state.search}],service:[]};
              for(const module of ['calendar','home','scripture','praise','service','presenter','manuals']) {
                state.module=module;document.body.dataset.module=module;
                refs.songCount.textContent='1개 표시';refs.songList.innerHTML=renderGlobalSearchSections(results);
                const sections=refs.songList.querySelectorAll('.global-search-section');
                check(sections.length===1 && sections[0].textContent.includes('찬양'),'action mixed into scripture results '+module);
                check(refs.songList.lastElementChild.classList.contains('global-search-actions'),'action not last '+module);
                check(!refs.songList.querySelector('.global-search-result--primary'),'action overemphasized');
                if(['calendar','home'].includes(module)) check(getComputedStyle(refs.songCount.parentElement).display==='none','empty count space '+module);
              }
              state.module='manuals';document.body.dataset.module='manuals';
              state.search='많은 사람들';
              const originalGlobalList=renderGlobalSearchList;
              renderGlobalSearchList=()=>{refs.songList.innerHTML=renderGlobalSearchSections(results)};
              state.auth.session={user:{id:'search-fixture'}};
              renderModuleSwitcher();renderSongList();renderDetail();
              check(!refs.searchInput.disabled && refs.searchInput.placeholder==='검색...','manual search chrome changed');
              check(refs.songList.querySelector('.global-search-section'),'manual global search list missing');
              check(refs.detailPane.querySelector('.home-search-screen'),'manual global search detail missing');
              state.module='calendar';document.body.dataset.module='calendar';
              refs.detailPane.innerHTML='';renderSearchResultsForCurrentModule();
              check(refs.detailPane.querySelector('.home-search-screen'),'calendar global search detail missing');
              renderGlobalSearchList=originalGlobalList;
              state.module='scripture';
              check(getGlobalSearchSectionOrder()[0].id==='scripture','current tab priority changed');
              state.module='calendar';document.body.dataset.module='calendar';document.body.dataset.theme='dark';
              refs.searchInput.value=state.search;
              refs.songList.innerHTML=renderGlobalSearchSections(results);
              const originalResults=getGlobalSearchResults;
              getGlobalSearchResults=()=>({praise:[{id:'long-song',title:'아주 긴 찬양 제목이 좁은 화면에서도 잘리지 않고 자연스럽게 이어지는 검색 결과',subtitle:'검단우리교회 청년부와 다음세대를 위한 긴 설명',versions:[]}],scripture:[],service:[]});
              state.search='교회 공동체와 다음세대를 함께 세우기 위한 아주 긴 검색 문장';
              const layouts=[];
              for(const width of [390,760,1440]) {
                document.documentElement.style.width=width+'px';renderHomeSearchDetail();
                const head=refs.detailPane.querySelector('.home-search-head strong');
                const title=refs.detailPane.querySelector('.song-title-text');
                const meta=refs.detailPane.querySelector('.song-meta-line');
                layouts.push({width,head:head.scrollWidth<=head.clientWidth+1,title:title.scrollWidth<=title.clientWidth+1,meta:meta.scrollWidth<=meta.clientWidth+1,wrap:getComputedStyle(title).whiteSpace});
              }
              document.documentElement.style.width='';getGlobalSearchResults=originalResults;
              check(layouts.every(item=>item.head&&item.title&&item.meta&&item.wrap==='normal'),'long search content clipped '+JSON.stringify(layouts));
              return 'PASS hidden count space, real results first, separate action and tab priority';
            }'''), flush=True)
            page.locator('.sidebar').screenshot(path='/tmp/mindex-search-layout-'+engine+'.png')
            browser.close()
finally:
    server.shutdown()
