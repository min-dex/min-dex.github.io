from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            try:
                page = browser.new_page(viewport={"width": 1280, "height": 720})
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof rememberSetlistArchiveHistory === 'function'")
                page.evaluate('''() => {
                  state.client=null; state.connectionError=''; state.module='home';
                  state.serviceTypes=[{id:'sunday-main',name:'주일예배',sort_order:1}];
                  state.services=[{id:'fixture',type_id:'sunday-main',service_date:'2026-07-19'}];
                  state.selectedServiceId=null; state.selectedServiceTypeId=SERVICE_SETLIST_ARCHIVE_PANEL_ID;
                  state.search='fixture-song'; refs.searchInput.value=state.search;
                  state.worshipSetlistArchiveView='date'; state.worshipSetlistArchiveMonth='07';
                  state.worshipSetlistSongCatalog={status:'loaded',index:MindexSetlistLinks.buildIndex([])};
                  const sources=Array.from({length:28},(_,i)=>({id:'s'+i,service_date:'2026-07-'+String(i+1).padStart(2,'0'),service_type_id:'sun_3rd',source_kind:'worship'}));
                  state.worshipSetlistArchive={loaded:true,loading:false,error:'',sources,
                    candidates:sources.map(s=>({id:'c'+s.id,import_source_id:s.id,candidate_level:'element',suggested_type:'praise',raw_label:'찬양 1',raw_title:'fixture-song'})),live:{services:[],sections:[],elements:[]}};
                  serviceNavigationBlocked=()=>false; confirmDiscardServiceChanges=()=>true;
                  markWorshipServiceExplicitlyRequested=()=>{}; loadServiceItems=async()=>{};
                  const original=renderCurrentServiceModuleDetail;
                  renderCurrentServiceModuleDetail=()=>state.selectedServiceId ? (refs.detailPane.innerHTML='<h2>예배 fixture</h2>') : original();
                  render(); syncBrowserHistory({replace:true});
                }''')
                for view in ('date', 'service'):
                    expected = page.evaluate('''view => {
                      state.worshipSetlistArchiveView=view; renderServiceSetlistArchiveDetail();
                      refs.detailPane.scrollTop=500;
                      const top=refs.detailPane.scrollTop;
                      if(top<100) throw Error('fixture not scrollable');
                      selectService('fixture');
                      // Change state while away, to prove that Back uses the saved entry.
                      state.worshipSetlistArchiveView=view==='date'?'service':'date';
                      state.worshipSetlistArchiveMonth='09';
                      return top;
                    }''', view)
                    page.go_back()
                    page.wait_for_function("!state.applyingBrowserHistory && !state.selectedServiceId && !!document.querySelector('.svc-setlist-entry')")
                    page.wait_for_function("top => Math.abs(document.getElementById('detailPane').scrollTop-top)<2", arg=expected)
                    result = page.evaluate("() => ({view:state.worshipSetlistArchiveView,month:state.worshipSetlistArchiveMonth,search:state.search,title:document.querySelector('#detailPane h2')?.textContent})")
                    assert result == dict(view=view, month='07', search='fixture-song', title='역대 콘티'), result
                    print('PASS browser Back restores', result, 'scroll', expected)
                page.evaluate("""async () => {
                  const songs=[{id:'old',title:'문들아 머리 들어라',versions:[],metadata:{}},
                    {id:'kids',title:'문들아 머리 들어라',artist:'히즈쇼',metadata:{artist:'히즈쇼'},versions:[]}];
                  state.songs=songs; songCatalogLoaded=true; clearSearchCaches();
                  if(songListView(songs[1]).title!=='문들아 머리 들어라' || !songListView(songs[1]).meta.includes('히즈쇼')) throw Error('list metadata');
                  const idx=MindexSetlistLinks.buildIndex(songs); state.worshipSetlistSongCatalog.index=idx;
                  const html=renderWorshipSetlistCandidate({raw_label:'찬양 1',raw_title:songs[1].title,suggested_song_id:'kids'});
                  if(!html.includes('svc-setlist-song-detail') || !html.includes('히즈쇼')) throw Error('archive metadata');
                  await openGlobalSongResult('kids');
                }""")
                page.go_back()
                page.wait_for_function("!state.applyingBrowserHistory && isSetlistArchiveView() && !!document.querySelector('.svc-setlist-entry')")
                assert page.evaluate("state.search") == 'fixture-song'
                print('PASS song link returns in one Back; artist hint renders without changing title')
            finally:
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
