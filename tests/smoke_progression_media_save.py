"""Media placement survives atomic saves; uncertain outcomes retain uploaded media."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
from smoke_progression_media import SCRIPT
ATOMIC=r'''async()=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 const service=state.services[0],sid=service.id,typed={inputMode:true,contentState:true};
 worshipElementTypedStateColumns=async()=>typed;
 renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};refreshPresenterForService=()=>{};updateSaveState=()=>{};
 const rows=buildWorshipPersistenceRows(service,getServiceItems(sid),{},{},{elementTypedStateColumns:typed});
 sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
 state.worshipSections=structuredClone(rows.sections);state.worshipElements=structuredClone(rows.elements);
 state.serviceItems[sid]=groupWorshipElements(rows.sections,rows.elements)[sid];
 const document=buildServiceDocumentSnapshot(service,state.serviceItems[sid]);
 let db={revision:'1',service:{id:sid,service_type_id:service.type_id,service_date:service.date,title:service.title,source_ref:{mindexServiceDocument:document}},...structuredClone(rows),slides:[]};
 service._worshipSourceRef=structuredClone(db.service.source_ref);
 state.dirty.service=false;state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
 let writes=0,fail=false,uploadFail=false,uploads=0,removed=[],notices=[];showToast=(text)=>notices.push(text);
 state.client={from(){throw Error('Direct table access')},storage:{from(){return {
   async upload(path){uploads++;return uploadFail&&uploads%2===0?{error:{message:'upload failure'}}:{data:{path}}},
   getPublicUrl(path){return {data:{publicUrl:'https://fixture.invalid/'+path}}},
   async remove(paths){removed.push(...paths);return {data:paths}}
 }}},rpc:async(name,{req})=>{
  if(name==='get_worship_service_v1')return {data:structuredClone(db)};
  check(name==='save_worship_service_v1','wrong RPC');
  if(fail)return {error:{message:'Network timeout',code:'NETWORK_ERROR'}};
  check(req.expectedRevision===db.revision,'stale revision');writes++;
  for(const [key,patches] of [['sections',req.sectionPatches],['elements',req.elementPatches]])for(const change of patches){
   const row=db[key].find(r=>r.id===change.id);Object.assign(row,change.patch);
   for(const [field,keys] of Object.entries(change.removeKeys||{}))for(const k of keys)delete row[field][k];
  }
  db.sections.push(...req.newSections.map(x=>({id:x.id,service_id:sid,...x.patch})));
  db.elements.push(...req.newElements.map(x=>({id:x.id,section_id:x.sectionId,...x.patch})));
  for(const move of req.elementMoves)db.elements.find(x=>x.id===move.id).section_id=move.sectionId;
  db.elements=db.elements.filter(x=>!req.deleteElementIds.includes(x.id));db.sections=db.sections.filter(x=>!req.deleteSectionIds.includes(x.id));
  Object.assign(db.service,req.metadataPatch);db.service.source_ref={...db.service.source_ref,mindexServiceDocument:req.document};
  db.revision=String(Number(db.revision)+1);
  return {data:{aggregate:structuredClone(db),committedRevision:db.revision,replayed:false}};
 }};
 const client=await worshipAtomicClient();await client.read(sid);
 const parent=getServiceItems(sid).find(i=>i.song_id);
 const media=getServiceItems(sid).find(i=>parseServiceItemMemo(i.memo).mediaPlacement);
 const original=JSON.stringify(parseServiceItemMemo(media.memo).mediaPlacement);
 await saveWorshipServiceInstance(service);
 const persisted=db.elements.find(e=>e.config?.mediaPlacement);
 check(persisted&&JSON.stringify(persisted.config.mediaPlacement)===original,'full save lost placement');
 const current=()=>getServiceItems(sid).find(i=>i.id===persisted.id);
 current().memo=serializeServiceItemMemo({...parseServiceItemMemo(current().memo),asset:{kind:'image',name:'새 사진',url:'/assets/icon-512.png'}});
 markServiceElementDirty(sid,current());
 await saveWorshipServiceElementPatch(service,current().id);
 check(JSON.stringify(db.elements.find(e=>e.id===current().id).config.mediaPlacement)===original,'element patch lost placement');
 const after=buildServicePresenterSlidesUncached(sid,{service,items:getServiceItems(sid),allowHydration:false});
 const at=after.findIndex(s=>s.elementId===current().id);
 check(after[at-1].formKey===parseServiceItemMemo(current().memo).mediaPlacement.formKey,'atomic read-back location drift');
 // Newly inserted ordinary media takes the structural atomic path.
 const liveParent=getServiceItems(sid).find(i=>i.song_id);
 const livePlan=presenterProgressionForItem(liveParent,sid);
 const extra=addPresenterReferenceMedia(sid,'praise',{afterItemId:liveParent.id,render:false,focus:false,
   mediaPlacement:{parentItemId:liveParent.id,formKey:livePlan.groups[2].key,signature:livePlan.signature}});
 check(await uploadPresenterReferenceMediaAsset({file:new File(['extra'],'extra.png',{type:'image/png'}),serviceId:sid,item:extra}),'new upload/save failed '+notices.join(' / '));
 check(db.elements.filter(e=>e.config?.mediaPlacement).length===2,'new media not atomically inserted');
 check(db.elements.some(e=>e.config?.mediaPlacement?.formKey===livePlan.groups[2].key&&e.config.mediaPlacement.parentItemId===liveParent.id),'new anchor lost');
 uploads=0;
 // Only pre-save failures may remove freshly uploaded blobs.
 const before=current().memo;uploadFail=true;
 const files=[new File(['one'],'one.png',{type:'image/png'}),new File(['two'],'two.png',{type:'image/png'})];
 check(!await uploadPresenterReferenceMediaAsset({file:files[0],imageFiles:files,serviceId:sid,item:current(),slideMode:'append'}),'failed upload succeeded');
 check(removed.length===1&&current().memo===before,'pre-save cleanup changed source draft');
 uploadFail=false;fail=true;const removedBefore=removed.length;
 check(!await uploadPresenterReferenceMediaAsset({file:files[0],serviceId:sid,item:current(),slideMode:'append'}),'failed save succeeded');
 check(removed.length===removedBefore,'unknown save outcome deleted uploaded media');
 check(parseServiceItemMemo(current().memo).asset.slides.some(s=>s.url.startsWith('https://fixture.invalid/')),'unknown save outcome discarded draft');
 check(JSON.stringify(parseServiceItemMemo(current().memo).mediaPlacement)===original,'unknown save outcome lost placement');
 return {result:'PASS atomic full/partial read-back, pre-save cleanup and uncertain-save media retention',writes};
}'''
def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as p:
   for engine in ('chromium','webkit'):
    browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page()
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname in ('127.0.0.1','localhost') and r.request.method=='GET' else r.abort())
    page.goto(url);page.wait_for_function("typeof insertPresenterProgressionMedia==='function'&&typeof refs!=='undefined'&&!!refs.saveAllBtn")
    page.evaluate(SCRIPT);print(engine,page.evaluate(ATOMIC),flush=True);browser.close()
 finally:server.shutdown()
if __name__=='__main__':main()
