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
                      captureWorshipRecoverySnapshot=async()=>{};syncSharedSundayContentAfterSave=async()=>{};
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
                      const {createWorshipAtomicClient}=await import('./mindex.worship-atomic-client.mjs');
                      const journal=new Map();
                      const isolatedClient=createWorshipAtomicClient({rpc:(...args)=>state.client.rpc(...args), journal:{getItem:k=>journal.get(k)||null,setItem:(k,v)=>journal.set(k,v),removeItem:k=>journal.delete(k)}});
                      worshipAtomicClient=async()=>isolatedClient;
                      const client=await worshipAtomicClient();await client.read(sid);

                      const ids=state.serviceItems[sid].map(i=>i.id);
                      const group={groupId:crypto.randomUUID(),primaryItemId:ids[0],itemIds:ids,title:'First + Second'};
                      state.serviceItems[sid].forEach((item,i)=>{
                        item.memo=serializeServiceItemMemo({...parseServiceItemMemo(item.memo),connectedPraise:{...group,role:i?'secondary':'primary'}});
                      });
                      await saveWorshipServiceInstance(service);
                      const checkGroup=()=>{
                        const live=getServiceItems(sid).filter(i=>ids.includes(i.id));
                        check(JSON.stringify(live.map(i=>i.id))===JSON.stringify(ids),'medley member order changed');
                        for(const item of live){const g=serviceItemConnectedPraise(item);
                          check(g.primaryItemId===ids[0]&&JSON.stringify(g.itemIds)===JSON.stringify(ids),'medley references changed');}
                      };
                      checkGroup();
                      for(const mode of ['score_db','lyrics_db','score_db','lyrics_db']){
                        for(const id of ids){
                          const index=getServiceItems(sid).findIndex(i=>i.id===id);
                          updateServiceItemField({value:mode,dataset:{serviceId:sid,serviceItemIndex:String(index),serviceItemField:'praise_input_mode'}});
                          checkGroup();
                          await saveWorshipServiceElementPatch(service,id);
                          checkGroup();
                          const row=db.elements.find(e=>e.id===id);
                          check(row.content_state.inputMode===mode,'mode not persisted');
                          for(const field of ['config','source_ref']){
                            const g=row[field].connectedPraise;
                            check(g.groupId===group.groupId&&g.primaryItemId===ids[0]
                              &&JSON.stringify(g.itemIds)===JSON.stringify(ids),'persisted medley changed');
                          }
                          const order=db.elements.filter(e=>e.section_id===row.section_id).map(e=>e.sort_order);
                          check(new Set(order).size===order.length,'duplicate persisted position');
                        }
                        state.serviceItems[sid]=groupWorshipElements(db.sections,db.elements)[sid];
                        checkGroup();
                      }
                      const before=getServiceItems(sid).map(item=>({id:item.id,song:item.song_id,version:item.version_id,title:item.raw_title,form:parseServiceItemMemo(item.memo).formHint,order:item.sort_order}));
                      renderCurrentServiceModuleDetail=()=>{};updateSaveState=()=>{};showToast=()=>{};
                      publishPresenterState=()=>{throw Error('Unexpected output publish')};
                      syncServiceMusicWithPresenterContext=()=>{throw Error('Unexpected music change')};
                      service._worshipSourceTextDraft='Unapplied source draft';
                      check(!unlinkServiceMedley(sid,ids[1]),'hidden source draft bypassed');
                      check(service._worshipSourceTextDraft==='Unapplied source draft','source draft lost');
                      delete service._worshipSourceTextDraft;
                      check(unlinkServiceMedley(sid,ids[1]),'unlink failed');
                      const after=getServiceItems(sid).map(item=>({id:item.id,song:item.song_id,version:item.version_id,title:item.raw_title,form:parseServiceItemMemo(item.memo).formHint,order:item.sort_order}));
                      check(JSON.stringify(before)===JSON.stringify(after),'unlink changed content or order');
                      check(getServiceItems(sid).every(item=>!serviceItemConnectedPraise(item)),'group remains');
                      check(state.dirtyServiceStructureIds.has(sid),'not marked for aggregate save');
                      failure=true;
                      try {await saveWorshipServiceInstance(service);} catch(_){}
                      check(getServiceItems(sid).every(item=>!serviceItemConnectedPraise(item)),'failure restored group');
                      failure=false;await saveWorshipServiceInstance(service);
                      state.serviceItems[sid]=groupWorshipElements(db.sections,db.elements)[sid];
                      check(getServiceItems(sid).every(item=>!serviceItemConnectedPraise(item)),'reload restored group');
                      check(JSON.stringify(getServiceItems(sid).filter(item=>ids.includes(item.id)).map(item=>item.id))===JSON.stringify(ids),'reload changed order '+JSON.stringify(getServiceItems(sid).map(item=>item.id))+' expected '+JSON.stringify(ids));
                      for(const row of db.elements)for(const field of ['config','source_ref']){
                        check(!row[field].connectedPraise&&!row[field].connected_praise,'persisted grouping remains');
                      }
                      return 'PASS medley unlink preserves content/order, failure/retry and save/reload';
    }"""))
   finally:browser.close()
finally:server.shutdown()
