"""Full-save rollback and lost-response retries through the real RPC client."""
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page()
                    page.route('**/*', lambda route: route.continue_()
                               if urlsplit(route.request.url).netloc == urlsplit(url).netloc else route.abort())
                    page.goto(url + '?output=presenter&mindexSmokeRaw=1', wait_until='domcontentloaded')
                    page.wait_for_function("typeof saveWorshipServiceInstance==='function'")
                    result = page.evaluate('''async () => {
                      const check=(ok,message)=>{if(!ok)throw Error(message)};
                      const clone=structuredClone;
                      const typed={inputMode:true,contentState:true};
                      worshipElementTypedStateColumns=async()=>typed;
                      ensureWorshipServiceRowsLoadedForPersistence=async()=>{};
                      captureWorshipRecoverySnapshot=()=>{};
                      refreshPresenterForService=()=>{};
                      syncSharedSundayContentAfterSave=async()=>{};
                      const results=[];
                      for(const timing of ['rollback','lost-response']) {
                        const sid=crypto.randomUUID();
                        const service={id:sid,type_id:'fixture',date:'2026-10-12',_worshipSourceRef:{}};
                        const items=[normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,
                          label:'Test',raw_title:'Original',_worshipSectionKey:'test',
                          _worshipSlotKey:'test.1',_worshipElementTemplateModified:true,
                          memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'title_person'})})];
                        const rows=buildWorshipPersistenceRows(service,items,{},{},{elementTypedStateColumns:typed});
                        sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
                        state.services=[service];state.selectedServiceId=sid;
                        state.worshipSections=clone(rows.sections);state.worshipElements=clone(rows.elements);
                        state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};
                        state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();
                        state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
                        state.dirty.service=true;state.serviceAliasSupported=true;
                        service._worshipSourceRef=withServiceDocumentSnapshot(service,state.serviceItems[sid]);
                        let db={revision:'1',service:{id:sid,service_type_id:'fixture',service_date:service.date,
                          source_ref:clone(service._worshipSourceRef)},...clone(rows),slides:[]};
                        const before=JSON.stringify(db),attempts=[],receipts=new Map();let inject=true,commits=0;
                        state.client={from(){throw Error('Direct table access attempted')},rpc:async(name,{req})=>{
                          if(name==='get_worship_service_v1')return {data:clone(db)};
                          check(name==='save_worship_service_v1','wrong RPC');attempts.push(clone(req));
                          if(receipts.has(req.requestId))return {data:{...clone(receipts.get(req.requestId)),replayed:true}};
                          if(inject&&timing==='rollback')return {error:{code:'P0001',message:'INJECTED_ROLLBACK'}};
                          check(req.expectedRevision===db.revision,'stale revision');
                          for(const patch of req.elementPatches)Object.assign(db.elements.find(row=>row.id===patch.id),patch.patch);
                          Object.assign(db.service,req.metadataPatch);
                          db.service.source_ref.mindexServiceDocument=clone(req.document);db.revision='2';commits++;
                          const receipt={aggregate:clone(db),committedRevision:'2',replayed:false};
                          receipts.set(req.requestId,receipt);
                          if(inject&&timing==='lost-response')throw Error('Failed to fetch');
                          return {data:receipt};
                        }};
                        const client=await worshipAtomicClient();await client.read(sid);
                        const localBefore=JSON.stringify([state.worshipSections,state.worshipElements,service._worshipSourceRef]);
                        state.serviceItems[sid][0].raw_title='Edited';
                        let failed=false;try{await saveWorshipServiceInstance(service)}catch{failed=true}
                        check(failed,'failed request acknowledged');
                        check(JSON.stringify([state.worshipSections,state.worshipElements,service._worshipSourceRef])===localBefore,'failed save advanced local baseline');
                        check(state.serviceItems[sid][0].raw_title==='Edited','failed save lost draft');
                        check(client.baseline(sid).revision==='1','failure adopted revision');
                        check(Boolean(client.pending(sid))===(timing==='lost-response'),'pending journal mismatch');
                        if(timing==='rollback')check(JSON.stringify(db)===before,'rollback partially committed');
                        inject=false;
                        if(timing==='lost-response') {
                          let retryError='';
                          try{await saveWorshipServiceInstance(service)}catch(error){retryError=error.message}
                          check(retryError==='ATOMIC_RETRY_COMMITTED_RELOAD_REQUIRED','uncertain retry acknowledged current draft');
                          check(state.serviceItems[sid][0].raw_title==='Edited','retry discarded draft');
                          check(JSON.stringify([state.worshipSections,state.worshipElements,service._worshipSourceRef])===localBefore,'uncertain retry replaced editable baseline');
                        } else await saveWorshipServiceInstance(service);
                        check(commits===1&&attempts.length===2,'retry duplicated commit');
                        if(timing==='lost-response')check(JSON.stringify(attempts[0])===JSON.stringify(attempts[1]),'retry changed frozen request');
                        check(!client.pending(sid)&&client.baseline(sid).revision==='2','retry not acknowledged');
                        check(db.elements[0].title==='Edited','saved row missing');
                        check(db.service.source_ref.mindexServiceDocument.sourceText.includes('Edited'),'saved source missing');
                        results.push(timing);
                      }
                      return results;
                    }''')
                    print(f'PASS {engine}: {result}', flush=True)
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
