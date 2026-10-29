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
                    page.wait_for_function("typeof prepareWorshipSetlistArchiveCandidates === 'function' && !document.body.classList.contains('ui-booting')")
                    page.locator('.mindex-boot').wait_for(state='hidden')
                    result = page.evaluate('''() => {
                      const services=[{id:'fixture',service_date:'2026-10-07',service_type_id:'wed'}];
                      const sections=[{id:'p',service_id:'fixture',title:'찬양'}];
                      const elements=[1,2,3,4].map(n=>({id:'e'+n,section_id:'p',sort_order:n,
                        element_type:'praise',label:'찬양 '+n,title:n===1?'첫 곡':n===4?'넷째 곡':''}));
                      const before=JSON.stringify(elements);
                      const live=MindexSetlistLinks.fromServices({services,sections,elements});
                      const rows=prepareWorshipSetlistArchiveCandidates(live.candidates,live.sources[0]);
                      const labels=rows.map(r=>r.archive_display_label).join('|');
                      if(labels!=='찬양 1|찬양 4') throw Error(labels);
                      if(JSON.stringify(elements)!==before) throw Error('mutated elements');
                      state.client=null;state.module='setlists';state.selectedServiceId=null;state.search='';
                      state.worshipSetlistSongCatalog={status:'loaded',index:MindexSetlistLinks.buildIndex([])};
                      const sources=[{id:'old',source_kind:'setlist',service_date:'2026-10-07',service_type_id:'wed'},
                        {id:'archive-only',source_kind:'setlist',service_date:'2026-09-30',service_type_id:'wed'}];
                      const candidates=sources.map(source=>({id:source.id+'-song',import_source_id:source.id,
                        candidate_level:'element',candidate_key:'praise',suggested_type:'praise',raw_label:'찬양 1',
                        raw_title:source.id==='old'?'가려져야 할 옛 콘티':'독립 과거 콘티',review_status:'approved'}));
                      state.worshipSetlistArchive={loaded:true,loading:false,sources,candidates,live:{services,sections,elements}};
                      const original=JSON.stringify({sources,candidates});
                      const check=(value,message)=>{if(!value)throw Error(message)};
                      check(!worshipSetlistArchiveEntries().some(entry=>entry.source.id==='old'),'Import took precedence');
                      renderServiceSetlistArchiveDetail();
                      check(refs.detailPane.textContent.includes('첫 곡')&&!refs.detailPane.textContent.includes('가려져야 할 옛 콘티'),'Wrong visible source');
                      check(refs.detailPane.textContent.includes('독립 과거 콘티'),'Import-only record missing');
                      elements[0].title='수정한 첫 곡';renderServiceSetlistArchiveDetail();
                      check(refs.detailPane.textContent.includes('수정한 첫 곡'),'Latest worship edit hidden');
                      for(const element of elements)element.title='';
                      check(!worshipSetlistArchiveEntries().some(entry=>entry.source.id==='old'),'Empty actual worship resurrected old songs');
                      state.worshipSetlistArchive.live.services=[];
                      check(worshipSetlistArchiveEntries().some(entry=>entry.source.id==='old'),'Import fallback lost when actual worship absent');
                      check(JSON.stringify({sources,candidates})===original,'Stored import mutated');
                      return {labels,livePriority:true,visibleEdit:true,emptyLive:true,importFallback:true,immutableImports:true};
                    }''')
                    print(engine, 'PASS', result)
                    for width in (1440, 700, 420):
                        page.set_viewport_size({'width':width,'height':900})
                        layout = page.evaluate("""() => {
                          const root=refs.detailPane;
                          const slots=[...root.querySelectorAll('[data-setlist-slot]')].slice(0,9).map(n=>n.dataset.setlistSlot);
                          if(slots.join()!=='sunday-second,sunday-main,sunday-afternoon,wednesday,friday,nursery,children,youth,young-adult')throw Error('slot order');
                          if([...root.querySelectorAll('.svc-setlist-week-row')].some(n=>n.scrollWidth>n.clientWidth+1))throw Error('row overflow');
                          return slots;
                        }""")
                        if width==1440: page.screenshot(path='/private/tmp/setlist-fixed-'+engine+'.png')
                    print(engine, 'PASS fixed slots and narrow layout', flush=True)

                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
