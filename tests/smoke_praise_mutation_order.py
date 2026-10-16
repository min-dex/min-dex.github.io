"""Praise edits keep sparse committed ordinals; structural saves preserve visible order."""
import json
import sys
import traceback
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    origin = urlsplit(url).netloc
    fixtures = []
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page()
                    page.route('**/*', lambda route: route.continue_()
                               if urlsplit(route.request.url).netloc == origin else route.abort())
                    page.goto(url + '?output=presenter&mindexSmokeRaw=1', wait_until='domcontentloaded')
                    page.wait_for_function("typeof saveWorshipServiceInstance==='function'")
                    fixtures.append(page.evaluate('''async () => {
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const sid=crypto.randomUUID();
                      const service={id:sid,type_id:'wednesday',date:'2026-10-12',title:'Fixture',_worshipSourceRef:{}};
                      state.services=[service]; state.selectedServiceId=sid;state.songs=[];
                      state.dirty.service=false;state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
                      state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();
                      state.serviceAliasSupported=true;
                      const items=['First','Second','Third'].map((title,i)=>normalizeServiceItem({
                        id:crypto.randomUUID(),service_id:sid,label:'찬양 '+(i+1),raw_title:title,
                        _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',
                        _worshipSlotKey:'praise.song.'+(i+1),_worshipElementTemplateModified:true,
                        memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})},i));
                      const typed={inputMode:true,contentState:true};
                      worshipElementTypedStateColumns=async()=>typed;
                      refreshPresenterForService=()=>{};renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};updateSaveState=()=>{};
                      const rows=buildWorshipPersistenceRows(service,items,{}, {},{elementTypedStateColumns:typed});
                      sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
                      rows.elements.forEach((row,i)=>{row.sort_order=(i+1)*10});
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
                      const expected=state.serviceItems[sid].map(x=>x.id);
                      const removed=[];
                      const assertOrder=()=>{
                        const allReopened=projectWorshipServiceItemsFromTemplate(service,groupWorshipElements(db.sections,db.elements)[sid]);
                        check(!allReopened.some(x=>removed.includes(x.id)&&!isTemplateSuppressedServiceItem(x)),'deleted song reappeared');
                        const reopened=allReopened.filter(x=>expected.includes(x.id)&&!isTemplateSuppressedServiceItem(x));
                        check(JSON.stringify(reopened.map(x=>x.id))===JSON.stringify(expected),'save/reopen changed order: '+reopened.map(x=>x.raw_title));
                        check(!reopened.some(x=>removed.includes(x.id)),'deleted song reappeared');
                        const visible=getServiceItems(sid).filter(x=>expected.includes(x.id)&&!isTemplateSuppressedServiceItem(x));
                        check(JSON.stringify(visible.map(x=>x.id))===JSON.stringify(expected),'editor changed order');
                        check(new Set(db.elements.map(x=>x.section_id+':'+x.sort_order)).size===db.elements.length,'duplicate element order');
                      };
                      const second=state.serviceItems[sid][1];second.raw_title='Edited second';
                      await saveWorshipServiceElementPatch(service,second.id);assertOrder();
                      check(db.elements.find(x=>x.id===second.id).sort_order===20,'content patch renumbered row');
                      state.serviceItems[sid]=groupWorshipElements(db.sections,db.elements)[sid];
                      const added=normalizeServiceItem({...state.serviceItems[sid].find(x=>x.id===second.id),id:crypto.randomUUID(),label:'찬양 4',raw_title:'Added',_worshipSlotKey:'praise.song.4',_worshipElementOrder:25},2);
                      const insertionItems=getServiceItems(sid);insertionItems.splice(insertionItems.findIndex(x=>x.id===second.id)+1,0,added);
                      normalizeMainPraiseSlots(service,insertionItems);
                      const inserted=await saveWorshipServiceInstance(service);
                      expected.splice(2,0,inserted.itemIds.get(added.id));assertOrder();
                      state.serviceItems[sid]=normalizeServiceItems(groupWorshipElements(db.sections,db.elements)[sid]);
                      removed.push(expected[0]);runServiceItemAction("delete",getServiceItems(sid).findIndex(x=>x.id===expected[0]));expected.splice(0,1);
                      await saveWorshipServiceInstance(service);assertOrder();
                      for(const id of expected.slice().reverse()){
                        state.serviceItems[sid].find(x=>x.id===id).raw_title+=' edited';
                        await saveWorshipServiceElementPatch(service,id);assertOrder();
                      }
                      return {initial,writes};
                    }'''))
                    print(f'PASS {engine}: spaced order content patch, middle insertion, deletion, repeated edits and reopen')
                finally:
                    browser.close()
    finally:
        server.shutdown()
        server.server_close()

if __name__ == '__main__':
    main()
