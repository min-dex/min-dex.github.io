"""Service document history is stored slim and still restores the source text."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1200, 'height': 800})
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof withServiceDocumentSnapshot === 'function' && typeof restoreServiceSourceHistory === 'function'")
                print(engine, page.evaluate('''async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const slide=i=>({id:'s'+i,type:'lyrics',layout:'lower_bar_text',elementType:'praise',title:'t'+i,text:'가사 '.repeat(40)+i,sectionKey:'praise'});
                  const doc=(text,n)=>({kind:MINDEX_SERVICE_DOCUMENT_KIND,version:MINDEX_SERVICE_DOCUMENT_VERSION,serviceId:'hist-fixture',updatedAt:'2026-09-1'+n+'T01:00:00Z',
                    sourceText:text,sourceRecords:Array.from({length:4},(_,i)=>({index:i+1,label:'찬양'+(i+1),value:'곡'+i})),slides:Array.from({length:30},(_,i)=>slide(i)),exceptions:[]});
                  const legacy=[doc('이전 원문 2',2),doc('이전 원문 1',1)];               // full entries as stored before this change
                  const service={id:'hist-fixture',type_id:'sunday-main',service_date:'2026-09-20',title:'',
                    _worshipSourceRef:{mindexServiceDocument:doc('현재 원문',3),mindexServiceDocumentHistory:legacy}};
                  state.services=[service]; state.serviceItems['hist-fixture']=[];
                  const ref=withServiceDocumentSnapshot(service,[]);
                  const history=ref[MINDEX_SERVICE_DOCUMENT_HISTORY_SOURCE_REF_KEY]||[];
                  check(history.length===3,'previous document + two legacy entries: '+history.length);
                  check(history.every(e=>!('slides' in e)&&!('sourceRecords' in e)&&!('exceptions' in e)),'entries are slim');
                  check(history.map(e=>e.sourceText).join('|')==='현재 원문|이전 원문 2|이전 원문 1','newest first, text kept: '+history.map(e=>e.sourceText));
                  check(history.every(e=>e.slideCount===30&&e.sourceRecordCount===4),'counts kept');
                  const fullBytes=JSON.stringify(legacy).length, slimBytes=JSON.stringify(history).length;
                  check(slimBytes*10<fullBytes*1.5+1,'history much smaller: '+slimBytes+' vs '+fullBytes);
                  // New current documents keep only source text and signatures. Legacy
                  // documents remain readable above, but rendered slides are not saved again.
                  const current=ref[MINDEX_SERVICE_DOCUMENT_SOURCE_REF_KEY];
                  check(!('slides' in current)&&!('sourceRecords' in current)&&!('exceptions' in current),'current document is row-derived');
                  // History data remains available without the retired editor UI.
                  service._worshipSourceRef=ref;
                  check(serviceDocumentHistoryFromRef(service)[1].sourceText==='이전 원문 2','history text preserved');
                  check(typeof renderServiceSourceHistory==='undefined','retired history renderer removed');
                  // a second save with unchanged content adds no entry
                  const again=withServiceDocumentSnapshot(service,[]);
                  check((again[MINDEX_SERVICE_DOCUMENT_HISTORY_SOURCE_REF_KEY]||[]).length<=3,'bounded');
                  return 'PASS slim history: shape, size, counts, restore, bound';
                }'''), flush=True)
                browser.close()
    finally:
        server.shutdown()


main()
