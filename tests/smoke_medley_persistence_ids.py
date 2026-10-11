"""Real save-row builder: medley references survive newly allocated element IDs."""
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
                    page.goto(url + '?mindexSmokeRaw=1', wait_until='domcontentloaded')
                    page.wait_for_function("typeof state !== 'undefined' && typeof serviceItemConnectedPraise === 'function'")
                    result = page.evaluate('''() => {
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const service={id:crypto.randomUUID(),type_id:'fixture',date:'2026-10-11'};
                      const group={groupId:'group',role:'primary',primaryItemId:'local-a',itemIds:['local-a','local-b'],title:'A + B'};
                      const items=['a','b','c'].map((key,i)=>({id:'local-'+key,service_id:service.id,label:'찬양 '+(i+1),raw_title:key,
                        _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',_worshipElementOrder:i+1,
                        memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',
                          ...(i<2?{connectedPraise:{...group,role:i?'secondary':'primary'}}:{})})}));
                      const before=JSON.stringify(items);
                      const rows=buildWorshipPersistenceRows(service,items);
                      check(JSON.stringify(items)===before,'draft mutated');
                      const ids=rows.elements.slice(0,2).map(e=>e.id);
                      check(ids[0]!==items[0].id,'fixture did not allocate IDs');
                      for(const row of rows.elements.slice(0,2)) for(const field of ['config','source_ref']) {
                        const g=row[field].connectedPraise;
                        check(g.primaryItemId===ids[0] && JSON.stringify(g.itemIds)===JSON.stringify(ids),'stale '+field+' reference');
                        check(g.groupId==='group' && g.title==='A + B','group changed');
                      }
                      check(!rows.elements[2].config.connectedPraise,'independent song joined');
                      const sections=Object.fromEntries(rows.sections.map(r=>[r.id,r]));
                      const elements=Object.fromEntries(rows.elements.map(r=>[r.id,r]));
                      const loaded=groupWorshipElements(rows.sections,rows.elements)[service.id];
                      const again=buildWorshipPersistenceRows(service,loaded,sections,elements);
                      check(JSON.stringify(again.elements.map(r=>r.id))===JSON.stringify(rows.elements.map(r=>r.id)),'resave IDs changed');
                      const patch=buildWorshipPersistenceRows(service,loaded,sections,elements,{targetElementId:ids[1]});
                      check(patch.elements.length===1,'patch included siblings');
                      check(JSON.stringify(patch.elements[0].config.connectedPraise.itemIds)===JSON.stringify(ids),'patch lost external member');
                      check(patch.elements[0].config.connectedPraise.primaryItemId===ids[0],'patch lost primary');
                      return 'PASS full save, config/source_ref IDs, reload/resave, isolated patch and immutable drafts';
                    }''')
                    print(engine, result)
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
