import os
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ("chromium", "webkit"):
                browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
                page = browser.new_page()
                page.route("**/*supabase*/**", lambda r: r.abort())
                page.goto(os.environ.get("MINDEX_TEST_URL", url), wait_until="domcontentloaded")
                page.wait_for_function("typeof buildWorshipPersistenceRows === 'function'")
                print(engine, page.evaluate(r"""() => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const service={id:'11111111-1111-4111-8111-111111111111',type_id:'fixture',date:'2026-10-04'};
                  const section={id:'22222222-2222-4222-8222-222222222222',service_id:service.id,title:'설교',section_key:'sermon',sort_order:4};
                  const citation={id:'33333333-3333-4333-8333-333333333333',label:'인용 구절',
                    _worshipSectionId:section.id,_worshipSectionKey:'sermon',_worshipSectionTitle:'설교',
                    memo:serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',scriptureReferences:['마태복음 1:1']})};
                  const song={...citation,id:'44444444-4444-4444-8444-444444444444',label:'찬양',song_id:'not-loaded',
                    memo:serializeServiceItemMemo({elementType:'praise',inputMode:'praise_db'})};
                  state.songs=[];state.services=[service];state.serviceItems={[service.id]:[song,citation]};
                  const existing=Object.fromEntries([song,citation].map(item=>[item.id,{id:item.id,section_id:section.id}]));
                  let blocked=false;
                  try {buildWorshipPersistenceRows(service,[song,citation],{[section.id]:section},existing)}
                  catch(e){blocked=e.message.includes('연결된 찬양')}
                  check(blocked,'full save must still validate songs');
                  const rows=buildWorshipPersistenceRows(service,[song,citation],{[section.id]:section},existing,{targetElementId:citation.id});
                  check(rows.elements.length===1 && rows.elements[0].id===citation.id,'patch includes unrelated element');
                  check(rows.elements[0].sort_order===2,'patch reset positional order');
                  state.serviceItems[service.id]=[citation];
                  const block=serviceSourceItemLines(citation,service).join('\n');
                  const source='[[설교]]\n'+block+'\n\n[[설교]]\n'+block+'\n\n[[폐회]]\n마무리: 보존';
                  const next={...citation,raw_title:'요한복음 3:16',memo:serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',scriptureReferences:['요한복음 3:16']})};
                  const fixed=sundayEditSyncSourceText({sourceText:source},citation,next,service);
                  check(parseServiceSourceText(fixed).filter(r=>r.label==='인용 구절').length===1,'identical copies not collapsed');
                  check(fixed.includes('마무리: 보존') && fixed.includes('요한복음 3:16'),'other text lost or change missing');
                  const changed=source.replace(block,serviceSourceItemLines(next,service).join('\n'));
                  let rejected=false;
                  try{sundayEditSyncSourceText({sourceText:changed},citation,next,service)}catch{rejected=true}
                  check(rejected,'different source content silently collapsed');
                  state.serviceItems[service.id]=[citation,{...citation,id:'another'}];
                  rejected=false;
                  try{sundayEditSyncSourceText({sourceText:source},citation,next,service)}catch{rejected=true}
                  check(rejected,'two canonical items silently collapsed');
                  return 'PASS scoped patch, original order, full-save validation and conservative duplicate repair';
                }"""), flush=True)
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
