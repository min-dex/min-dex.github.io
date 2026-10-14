"""Medley order survives real partial-save acknowledgements and repeated mode switches."""
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
    print(engine,page.evaluate("""async()=>{
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const sid=crypto.randomUUID();
                      const service={id:sid,type_id:'wednesday',date:'2026-10-12',title:'Fixture',_worshipSourceRef:{}};
                      state.services=[service]; state.selectedServiceId=sid;state.songs=[];
                      state.dirty.service=false;state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
                      state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();
                      state.serviceAliasSupported=true;
                      const items=['First','Second'].map((title,i)=>normalizeServiceItem({
                        id:crypto.randomUUID(),service_id:sid,label:'찬양 '+(i+1),raw_title:title,
                        _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',
                        _worshipSlotKey:'praise.song.'+(i+1),_worshipElementTemplateModified:true,
                        memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})},i));
                      const typed={inputMode:true,contentState:true};
                      worshipElementTypedStateColumns=async()=>typed;
                      refreshPresenterForService=()=>{};updateSaveState=()=>{};
                      const rows=buildWorshipPersistenceRows(service,items,{}, {},{elementTypedStateColumns:typed});
                      sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
                      state.worshipSections=structuredClone(rows.sections);state.worshipElements=structuredClone(rows.elements);
                      state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};
                      const initial={serviceId:sid,serviceTypeId:'wednesday',serviceDate:service.date,
                        metadataPatch:{title:'Fixture'},
                        sections:rows.sections.map(({id,service_id,created_at,updated_at,...patch})=>({id,patch})),
                        elements:rows.elements.map(({id,section_id,created_at,updated_at,...patch})=>({id,sectionId:section_id,patch})),
                        document:buildServiceDocumentSnapshot(service,state.serviceItems[sid])};
                      let db={revision:'1',service:{id:sid,service_type_id:'wednesday',service_date:service.date,title:'Fixture',source_ref:{mindexServiceDocument:initial.document}},
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
                      const client=await worshipAtomicClient();await client.read(sid);

                      const first=state.serviceItems[sid][0];
                      state.songs=['Alpha','Beta','Gamma'].map(title=>({id:crypto.randomUUID(),title,versions:[{id:crypto.randomUUID(),name:'default',_worshipVersionPersisted:true,praise_types:['ccm']}]}));clearSearchCaches();
                      const index=getServiceItems(sid).findIndex(i=>i.id===first.id);
                      updateServiceItemField({value:'Alpha + Beta + Gamma',dataset:{serviceId:sid,serviceItemIndex:String(index),serviceItemField:'raw_title'}});
                      check(state.dirtyServiceStructureIds.has(sid),'saved row expanded to medley without marking structural save');
                      let fullSaves=0;
                      requireClient=()=>true;
                      saveService=async()=>{fullSaves++;await saveWorshipServiceInstance(service);return true};
                      await saveServiceItemPatch(sid,index);
                      check(fullSaves===1,'medley used partial save');
                      const members=db.elements.filter(e=>e.config.connectedPraise);
                      check(members.length===3,'medley secondary missing from database');
                      for(const row of members){
                        const g=row.config.connectedPraise;
                        check(g.itemIds.every(id=>members.some(e=>e.id===id)),'dangling medley member ID');
                      }
                      state.serviceItems[sid]=groupWorshipElements(db.sections,db.elements)[sid];
                      check(getServiceItems(sid).filter(i=>serviceItemConnectedPraise(i)).length===3,'reload lost medley');
                      renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};
                      const original=members[0].config.connectedPraise.itemIds;
                      const stages=[['up',original[2],[original[0],original[2],original[1]]],
                        ['down',original[0],[original[2],original[0],original[1]]],
                        ['delete',original[2],[original[0],original[1]]],
                        ['delete',original[1],[original[0]]]];
                      for(const [action,id,wanted] of stages){
                        runServiceItemAction(action,getServiceItems(sid).findIndex(i=>i.id===id));
                        await saveWorshipServiceInstance(service);
                        state.serviceItems[sid]=groupWorshipElements(db.sections,db.elements)[sid];
                        const live=getServiceItems(sid).filter(i=>original.includes(i.id));
                        check(JSON.stringify(live.map(i=>i.id))===JSON.stringify(wanted),action+' changed order');
                        for(const item of live){
                          const g=serviceItemConnectedPraise(item);
                          if(wanted.length===1)check(!g,'singleton retains medley');
                          else check(g.primaryItemId===wanted[0]&&JSON.stringify(g.itemIds)===JSON.stringify(wanted),'stale medley references');
                        }
                        const removed=original.filter(id=>!wanted.includes(id));
                        check(!db.elements.some(e=>removed.includes(e.id)),'deleted member resurrected');
                      }
                      return 'PASS saved medley reorder, primary/secondary deletion, singleton cleanup and reload';
    }"""))
   finally:browser.close()
finally:server.shutdown()
