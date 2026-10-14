from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_function("typeof getGlobalSearchResults==='function'")
            print(engine, page.evaluate('''() => {
              const check=(ok,msg)=>{if(!ok)throw Error(msg)};
              state.scriptureBooks=[];
              state.songs=[
                {id:'ps',title:'시편 찬양',scripture:['시편 100:1'],versions:[]},
                {id:'jn',title:'사랑',scripture:['요한복음 3:16'],versions:[]},
                {id:'1jn',title:'다른 사랑',scripture:['요한일서 3:16'],versions:[]},
                {id:'cor',title:'터',scripture:['고린도전서 3:11'],versions:[]},
                {id:'eph',title:'찬양',scripture:['에베소서 5:19'],versions:[]},
                {id:'range',title:'사랑 계명',scripture:['마태복음 22:37-39'],versions:[]},
                {id:'noise',title:'요 고전 엡 3:16 3:11 5:19',versions:[]}
              ];
              clearSearchCaches();
              const cases=[
                ['시 100:1',['ps']],['시편100:1',['ps']],['시편 100편 1절',['ps']],
                ['시100편1절',['ps']],['시편 100편',['ps']],
                ['요 3:16',['jn']],['요3장16절',['jn']],['John 3:16',['jn']],
                ['요일 3:16',['1jn']],['고전 3:11',['cor']],['엡 5:19',['eph']],
                ['마22:37-39',['range']],['마 22장 38절',['range']],
                ['마 22:36-37',['range']],['마 22:39–40',['range']],
                ['마 22:38~40',['range']],['마 22장',['range']],
                ['마 22:36',[]],['마 22:40',[]],['마 23:38',[]],['막 22:38',[]],
                ['요 999:999',[]]
              ];
              for(const [query,expected] of cases){
                state.search=query;
                const actual=getGlobalSearchResults().praise.map(x=>x.song.id).sort();
                check(JSON.stringify(actual)===JSON.stringify(expected.sort()),query+' '+JSON.stringify(actual));
              }
              const multi={id:'multi',scripture:['마태복음 22:37-39','마태복음 22:38'],versions:[]};
              check(getSongSearchMatch(multi,getSearchTokens('마 22:38')).score===500,'Exact reference outranks overlapping reference');
              state.songs[0].scripture=['시편 101:1'];clearSearchCaches();
              check(!getSongSearchMatch(state.songs[0],getSearchTokens('시 100:1')),'Stale reference cache');
              check(getSongSearchMatch(state.songs[0],getSearchTokens('시 101:1')),'Updated reference');
              return 'PASS '+cases.length+' scripture aliases, notation, overlap, boundaries, book isolation, cache update';
            }'''))
            browser.close()
finally:
    server.shutdown()
