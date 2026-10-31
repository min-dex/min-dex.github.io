from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        browser = launch_chromium(p)
        page = browser.new_page()
        page.route('**/*supabase*/**', lambda route: route.abort())
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function("typeof getGlobalSearchResults==='function'")
        print(page.evaluate("""async () => {
          const check=(value,message)=>{if(!value)throw Error(message)};
          const songs=[
            {id:'hymn',title:'구주의 십자가 보혈로',hymn_no:250,versions:[]},
            {id:'ccm',title:'주 은혜임을',original_title:'Your Grace',metadata:{artist:'테스트팀'},
              versions:[{id:'v',version_name:'기본',forms:[{lyrics:'상한 나의 맘 보시네'}]}]},
            {id:'other',title:'다른 찬양',versions:[]},
          ];
          state.songs=songs;state.services=[];clearSearchCaches();
          const cases=[['구주의십자가','hymn'],['ㄱㅈㅇ','hymn'],['250','hymn'],
            ['250장','hymn'],['찬 250','hymn'],['찬송가 250장','hymn'],
            ['250 구주의','hymn'],['Your Grace','ccm'],['주 은혜임을 테스트팀','ccm'],
            ['상한 나의 맘','ccm']];
          for(const moduleName of ['home','praise','service','presenter']){
            state.module=moduleName;
            for(const [query,id] of cases){
              state.search=query;
              check(getGlobalSearchResults().praise[0]?.song.id===id, moduleName+' '+query);
            }
          }
          const editions=['N','T'].map(book=>({id:'SONG-HYMN-'+book+'382-0001',
            title:'동명 찬송',hymn_no:book==='T'?'347':'382',versions:[],_singleSongRecord:true}));
          state.songs=editions;clearSearchCaches();
          for(const [q,index] of [['새382',0],['새찬송가 382장',0],['통382',1],['통일 찬송가 382장',1]]) {
            state.search=q;
            check(getGlobalPraiseResults(getSearchTokens(q))[0]?.song.id===editions[index].id,'전역 '+q);
            check(getFilteredSongs()[0]?.id===editions[index].id,'목록 '+q);
            const marker=(index?'통':'새')+'382';
            check(getGlobalPraiseResults(getSearchTokens(q))[0]?.song.hymn_no===marker && getFilteredSongs()[0]?.hymn_no===marker && serviceSongPickerResults(q)[0]?.hymn_no===marker,'판본 번호 표시 '+q);
            check(serviceSongPickerResults(q)[0]?.id===editions[index].id,'예배 곡 검색 '+q);
          }
          check(serviceSongPickerResults('382').map(song=>song.id).join()===editions[0].id,'번호 단독 선택기');
          check(resolveExistingPraiseSongForServiceInput('382').id===editions[0].id,'번호 단독 연결');
          const firstLines={id:'first-lines',title:'별개 제목',versions:[{forms:[
            {part_type:'Verse',lyrics:'1. 아침 햇살 아래'},
            {part_type:'Chorus',lyrics:'함께 손을 들고'}
          ]}]};
          state.songs=[firstLines];clearSearchCaches();
          for(const q of ['아침햇살','함께손을']) {
            check(getGlobalPraiseResults(getSearchTokens(q))[0]?.song.id===firstLines.id,'첫 소절 '+q);
            check(serviceSongPickerResults(q)[0]?.id===firstLines.id,'예배 첫 소절 '+q);
          }
          state.songs=songs;clearSearchCaches();
          state.search='zzznomatch';clearSearchCaches();
          check(getGlobalSearchResults().praise.length===0,'Unmatched praise');
          renderGlobalSearchList();check(refs.songCount.textContent==='0개 표시','Action counted as result');
          const query='요한복음 3:16-18';
          const range=getGlobalScriptureResults(query,getSearchTokens(query)).find(r=>r.kind==='reference');
          check(range.verseEnd===18,'Range dropped');
          check(renderGlobalScriptureResult(range).includes('data-global-verse-end="18"'),'Range markup dropped');
          const originalOpenBook=openGlobalBookResult;
          const selected=[];
          selectScriptureBook=async(book,options)=>selected.push({book,...options});
          state.module='scripture';
          refs.songList.innerHTML=renderGlobalScriptureResult(range);
          refs.songList.querySelector('[data-global-book-code]').click();
          await new Promise(resolve=>setTimeout(resolve,0));
          check(selected[0]?.verse===16 && selected[0]?.verseEnd===18,'Click range navigation');
          const calls=[];
          openGlobalSongResult=async id=>calls.push(['praise',id]);
          openGlobalServiceResult=async id=>calls.push(['service',id]);
          openGlobalBookResult=async(code,options)=>calls.push(['scripture',code,options]);
          getScriptureSearchShortcut=async()=>null;
          const resultFixture={praise:[{song:songs[1]}],scripture:[range],
            service:[{id:'service'}]};
          getGlobalSearchResults=()=>resultFixture;
          for(const [moduleName,kind,id] of [['praise','praise','ccm'],['service','service','service'],['home','praise','ccm']]){
            state.module=moduleName;state.search='fixture';
            await handleSearchKeydown({key:'Enter',preventDefault(){}});
            check(calls.at(-1)[0]===kind && calls.at(-1)[1]===id,'Enter target '+moduleName);
          }
          const count=calls.length;
          await handleSearchKeydown({key:'Enter',isComposing:true,preventDefault(){}});
          await handleSearchKeydown({key:'Enter',keyCode:229,preventDefault(){}});
          check(calls.length===count,'IME Enter navigated');
          getScriptureSearchShortcut=async()=>{state.search='new typing';return null;};
          await handleSearchKeydown({key:'Enter',preventDefault(){}});
          check(calls.length===count,'Stale query navigated');
          return 'PASS 40 praise queries, lyrics scope, hymn aliases, mixed fields, range click, Enter, IME, stale input';
        }"""))
        browser.close()
finally:
    server.shutdown()
