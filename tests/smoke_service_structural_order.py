"""All service types preserve structural edits and explicit deletion through atomic save/reopen."""
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page()
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.goto(url+'?output=presenter&mindexSmokeRaw=1')
    page.wait_for_function("typeof saveWorshipServiceInstance==='function'")
    for service_type in ['sunday-first','sunday-second','sunday-main','sunday-afternoon','wednesday','friday','youth','young-adult','children','special']:
     print(engine,service_type,page.evaluate("""async(serviceType)=>{
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const sid=crypto.randomUUID();
                      const service={id:sid,type_id:serviceType,date:'2026-10-12',title:'Fixture',_worshipSourceRef:{}};
                      state.services=[service]; state.selectedServiceId=sid;state.songs=[];
                      state.dirty.service=false;state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
                      state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();
                      state.serviceAliasSupported=true;
                      const items=['Fourth','First','Second','Third','Fifth','Sixth','Seventh','Eighth'].map((title,i)=>normalizeServiceItem({
                        id:crypto.randomUUID(),service_id:sid,label:'찬양 '+[4,1,2,3,5,6,7,8][i],raw_title:title,
                        _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',
                        _worshipSlotKey:'praise.song.'+[4,1,2,3,5,6,7,8][i],_worshipElementTemplateModified:true,
                        memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})},i));
                      captureWorshipRecoverySnapshot=async()=>{};syncSharedSundayContentAfterSave=async()=>{};
                      const typed={inputMode:true,contentState:true};
                      worshipElementTypedStateColumns=async()=>typed;
                      refreshPresenterForService=()=>{};updateSaveState=()=>{};
                      const rows=buildWorshipPersistenceRows(service,items,{}, {},{elementTypedStateColumns:typed});
                      sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
                      state.worshipSections=structuredClone(rows.sections);state.worshipElements=structuredClone(rows.elements);
                      state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};
                      const initial={serviceId:sid,serviceTypeId:serviceType,serviceDate:service.date,
                        metadataPatch:{title:'Fixture'},
                        sections:rows.sections.map(({id,service_id,created_at,updated_at,...patch})=>({id,patch})),
                        elements:rows.elements.map(({id,section_id,created_at,updated_at,...patch})=>({id,sectionId:section_id,patch})),
                        document:buildServiceDocumentSnapshot(service,state.serviceItems[sid])};
                      let db={revision:'1',service:{id:sid,service_type_id:serviceType,service_date:service.date,title:'Fixture',source_ref:{mindexServiceDocument:initial.document}},
                        ...structuredClone(rows),slides:[]};
                      service._worshipSourceRef=structuredClone(db.service.source_ref);
                      const writes=[];let failure=false,duringSave=null;
                      state.client={from(){throw Error('Legacy table write attempted')},rpc:async(name,{sid:readId,req})=>{
                        if(name==='get_worship_service_v1')return {data:structuredClone(db)};
                        check(name==='save_worship_service_v1','wrong RPC');
                        if(failure)return {error:{code:'P0001',message:'INJECTED_FAILURE'}};
                        check(req.expectedRevision===db.revision,'stale token');writes.push(structuredClone(req));
                        for(const [key,patches] of [['sections',req.sectionPatches],['elements',req.elementPatches]]) {
                          for(const change of patches){const row=db[key].find(x=>x.id===change.id);Object.assign(row,change.patch);
                            for(const [field,keys] of Object.entries(change.removeKeys||{}))for(const key of keys)delete row[field][key];}
                        }
                        db.sections.push(...req.newSections.map(x=>({id:x.id,service_id:sid,...x.patch})));
                        db.elements.push(...req.newElements.map(x=>({id:x.id,section_id:x.sectionId,...x.patch})));
                        for(const move of req.elementMoves)db.elements.find(x=>x.id===move.id).section_id=move.sectionId;
                        db.elements=db.elements.filter(x=>!req.deleteElementIds.includes(x.id));
                        db.sections=db.sections.filter(x=>!req.deleteSectionIds.includes(x.id));
                        Object.assign(db.service,req.metadataPatch);
                        db.service.source_ref={...db.service.source_ref,mindexServiceDocument:req.document};
                        db.revision=String(Number(db.revision)+1);
                        if(duringSave){const callback=duringSave;duringSave=null;callback();}
                        return {data:{aggregate:structuredClone(db),committedRevision:db.revision,replayed:false}};
                      }};
                      const {createWorshipAtomicClient}=await import('./mindex.worship-atomic-client.mjs');
                      const journal=new Map();
                      const isolatedClient=createWorshipAtomicClient({rpc:(...args)=>state.client.rpc(...args), journal:{getItem:k=>journal.get(k)||null,setItem:(k,v)=>journal.set(k,v),removeItem:k=>journal.delete(k)}});
                      worshipAtomicClient=async()=>isolatedClient;
                      const client=await worshipAtomicClient();await client.read(sid);

                      state.serviceItems[sid]=normalizeServiceItems(state.serviceItems[sid]);
                      renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};
                      const originalIds=new Set(state.serviceItems[sid].map(i=>i.id));
                      const songs=()=>getServiceItems(sid).filter(i=>originalIds.has(i.id));
                      for(const action of ['up','down','add','delete']){
                        const beforeIds=new Set(getServiceItems(sid).map(i=>i.id));
                        const target=songs()[action==='up'?2:1];
                        runServiceItemAction(action,getServiceItems(sid).findIndex(i=>i.id===target.id),'찬양 9','Added fixture');
                        const added=getServiceItems(sid).find(i=>!beforeIds.has(i.id));
                        if(action==='add'){check(added,'addition missing');originalIds.add(added.id)}
                        const removed=action==='delete'?target.id:null;
                        if(removed)originalIds.delete(removed);
                        const wanted=songs().map(i=>i.id);
                        const result=await saveWorshipServiceInstance(service);
                        const expected=wanted.map(id=>result.itemIds.get(id)||id);
                        for(const id of expected)originalIds.add(id);
                        state.serviceItems[sid]=projectWorshipServiceItemsFromTemplate(service,groupWorshipElements([...db.sections].reverse(),[...db.elements].reverse())[sid]);
                        const visible=getServiceOutlineItems(service);
                        check(JSON.stringify(visible.filter(i=>originalIds.has(i.id)).map(i=>i.id))===JSON.stringify(expected),action+' saved/reloaded order changed');
                        if(removed)check(!visible.some(i=>i.id===removed),action+' resurrected removed row');
                      }
                      const last=songs().at(-1);
                      runServiceItemAction('delete',getServiceItems(sid).findIndex(i=>i.id===last.id));
                      failure=true;
                      try{await saveWorshipServiceInstance(service);throw Error('expected rejection')}catch(e){check(e.message==='INJECTED_FAILURE','unexpected failure: '+e.message)}
                      check(state.templateElementSuppressions.has(last.id),'failure discarded deletion intent');
                      failure=false;
                      await saveWorshipServiceInstance(service);
                      state.serviceItems[sid]=groupWorshipElements([...db.sections].reverse(),[...db.elements].reverse())[sid];
                      check(!getServiceItems(sid).some(i=>i.id===last.id),'last deletion marker visible after raw reload');
                      check(!getServiceOutlineItems(service).some(i=>i.id===last.id),'last deleted song visible');
                      const retained=songs()[0];
                      const editNote=value=>updateServiceItemField({value,dataset:{serviceId:sid,serviceItemIndex:String(getServiceItems(sid).findIndex(i=>i.id===retained.id)),serviceItemField:'memo_note'}});
                      editNote('saving');duringSave=()=>editNote('new unsaved input');
                      await saveWorshipServiceInstance(service);
                      check(!duringSave,'full save was not exercised');
                      check(parseServiceItemMemo(getServiceItems(sid).find(i=>i.id===retained.id).memo).note==='new unsaved input','full receipt overwrote newer input');
                      const preserved={sections:[],elements:[]};
                      const stored=db.elements.find(e=>e.id===retained.id);
                      preserveExistingWorshipContentRows(preserved,db.sections,[stored]);
                      check(preserved.elements.some(e=>e.id===retained.id),'accidental omission protection lost');
                      return 'PASS structural order, last deletion, failed-save retry, concurrent input and omission protection';
    }""",service_type))
   finally:browser.close()
finally:server.shutdown()
