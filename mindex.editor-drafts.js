// Drafts are private server records. Restoring changes only the editor, never DB rows.
(() => {
 const touched=new Set(),last=new Map(),sessionKeys=new Map();let scheduled=false,activeClient=null;
 const moduleName=()=>['service','presenter'].includes(state.module)?'service':state.module;
 const idFor=module=>module==='praise'?state.selectedSongId:module==='scripture'?state.selectedScriptureId:module==='service'?state.selectedServiceId:module==='references'?'all':null;
 const keyFor=(module,id)=>`mindex.editor.draft.v1:${module}:${id}`;
 function pendingFields(){return [...(refs.detailPane?.querySelectorAll('input,textarea,select')||[])]
  .filter(node=>node.type!=='file'&&node.type!=='password'&&node.dataset.initialValue!==undefined&&node.value!==node.dataset.initialValue)
  .map(node=>({id:node.id,data:{...node.dataset},value:node.value,checked:node.checked}));}
 const historyPrefix=(module,id)=>`mindex.editor.draft.v2:${module}:${id}:`;
 function snapshot(module,id){
  return {schema:1,module,id,base:state.cleanFingerprints[module],value:structuredClone(dirtyModuleValue(module)),fields:pendingFields(),
   ...(module==='service'?{sourceText:serviceSourceTextareaForService(id)?.value??state.services.find(row=>row.id===id)?._worshipSourceTextDraft,elementIds:[...(state.dirtyServiceElementIds.get(id)||[])],structure:state.dirtyServiceStructureIds.has(id),typeIds:[...state.dirtyServiceTypeIds]}:{})};
 }
 function content(draft){
  return JSON.stringify([draft.value,draft.sourceText??null,(draft.fields||[]).map(field=>({id:field.id,data:Object.fromEntries(Object.entries(field.data||{}).filter(([key])=>key!=='initialValue').sort(([a],[b])=>a.localeCompare(b))),value:field.value,checked:field.checked}))]);
 }
 function capture(){
  const storage=window.MINDEX_SERVER_STORAGE;if(!storage?.ready)return;
  if(activeClient!==state.client){sessionKeys.clear();last.clear();touched.clear();activeClient=state.client}
  const module=moduleName(),id=idFor(module);if(!id)return;
  const identity=keyFor(module,id),fields=pendingFields();
  const dirty=module==='praise'?state.dirty.song||state.dirty.forms:state.dirty[module];
  if(!dirty&&!fields.length){
   // Only retire this session's active draft. Older sessions and legacy drafts stay intact.
   const key=sessionKeys.get(identity);
   if(key&&touched.has(key)){storage.queue('local',key,null);touched.delete(key);last.delete(key);sessionKeys.delete(identity)}
   return;
  }
  const value=snapshot(module,id),signature=content(value);
  if(!sessionKeys.has(identity))sessionKeys.set(identity,historyPrefix(module,id)+crypto.randomUUID());
  const key=sessionKeys.get(identity);
  if(last.get(key)===signature)return;
  value.savedAt=new Date().toISOString();
  if(storage.queue('local',key,JSON.stringify(value))){last.set(key,signature);touched.add(key);window.MINDEX_DRAFT_HANDOFF?.publish(module,id,value,value.value?.song?.title||value.value?.title||value.value?.service?.title||'편집 초안')}
 }
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;capture()})}
 async function restoreDraft(draft,isActive=()=>true){
  const module=moduleName(),id=idFor(module);
  if(state.saving||state.serviceMusic?.playing||state.serviceMusic?.pending||isPresenterOutputWindowOpen()){showToast('저장이나 재생을 마친 뒤 임시 저장본을 복구해 주세요.','error');return false;}
  if(draft?.schema!==1||draft.module!==module||draft.id!==id)return false;
  if(content(draft)===content(snapshot(module,id)))return false;
  const payload=draft.value;
  if((module==='praise'&&(!payload?.song||payload.song.id!==id||!Array.isArray(payload.forms)))||(module==='scripture'&&payload?.id!==id)||(module==='service'&&(payload?.service?.id!==id||!Array.isArray(payload.items)||!Array.isArray(payload.serviceTypes)))||(module==='references'&&!Array.isArray(payload))){showToast('임시 저장본 내용과 연결 대상을 확인하지 못했습니다. 원본은 보존됩니다.','error');return false;}
  const fingerprint=dirtyModuleFingerprint(module),client=state.client,current=snapshot(module,id),signature=content(current);
  let value=structuredClone(draft.value),changed=Boolean(draft.base&&fingerprint!==draft.base),conflicts=[];
  if(changed){
   try{
    const {mergeEditorDraft}=await import(`./mindex.draft-merge.mjs?v=${encodeURIComponent(window.MINDEX_RELEASE||'draft-merge')}`);
    const merged=mergeEditorDraft(JSON.parse(draft.base),draft.value,dirtyModuleValue(module));
    value=merged.value;conflicts=merged.conflicts;
   }catch{showToast('복구 기준을 읽지 못했습니다. 임시 저장본은 그대로 보관됩니다.','error');return false;}
  }
  const notice=changed
   ? (conflicts.length||draft.fields?.length
      ? '원본도 변경되었습니다. 현재 내용과 임시 저장본을 각각 보관한 뒤, 겹치는 수정은 임시 저장본으로 편집창에 복구할까요? 저장 전 내용을 확인해 주세요.'
      : '원본의 새 변경은 유지하고 임시 저장본의 수정만 편집창에 복구할까요? 확인 후 저장하면 반영됩니다.')
   : '임시 저장본을 편집창에 복구할까요? 확인 후 저장하면 반영됩니다.';
  if(!isActive())return false;
  if(!window.confirm(notice))return;
  const unchanged=()=>isActive()&&moduleName()===module&&idFor(module)===id&&state.client===client&&dirtyModuleFingerprint(module)===fingerprint&&content(snapshot(module,id))===signature&&!state.saving&&!state.serviceMusic?.playing&&!state.serviceMusic?.pending&&!isPresenterOutputWindowOpen();
  try{
   const storage=window.MINDEX_SERVER_STORAGE,now=new Date().toISOString();
   const records=[
    [historyPrefix(module,id)+crypto.randomUUID(),{...draft,savedAt:draft.savedAt||now}],
    [historyPrefix(module,id)+crypto.randomUUID(),{...current,savedAt:now}],
    [`mindex.editor.recovery.v1:${module}:${id}:${crypto.randomUUID()}`,{schema:1,module,id,draft,current:current.value,createdAt:now}]
   ];
   for(const [key,value] of records){
    if(!unchanged()){showToast('복구 준비 중 화면이나 입력이 바뀌어 적용을 멈췄습니다. 보관된 내용은 유지됩니다.','error');return false}
    await storage.setItem('local',key,JSON.stringify(value));
   }
  }catch{showToast('복구 전 보관을 완료하지 못했습니다. 원본과 임시 저장본을 유지합니다. 연결을 확인하고 다시 시도해 주세요.','error');return false;}
  if(!unchanged()){
   showToast('복구 준비 중 화면이나 입력이 바뀌어 적용을 멈췄습니다. 보관된 내용은 유지됩니다.','error');return false;
  }
  if(module==='praise'){
   const index=state.songs.findIndex(song=>song.id===id);if(index<0)return;
   state.songs=state.songs.map((song,i)=>i===index?value.song:song);state.forms=value.forms;state.selectedVersionId=value.versionId;
   state.dirty.song=true;state.dirty.forms=true;
  }else if(module==='scripture'){
   const index=state.scriptures.findIndex(row=>row.id===id);if(index<0)return;
   state.scriptures[index]=value;state.dirty.scripture=true;
  }else if(module==='service'){
   const index=state.services.findIndex(row=>row.id===id);if(index<0)return;
   state.services[index]=value.service;state.serviceItems[id]=value.items;state.serviceTypes=value.serviceTypes;
   const sourceText=draft.sourceText??draft.value.service._worshipSourceTextDraft;
   if(sourceText!==undefined)state.services[index]._worshipSourceTextDraft=sourceText;
   state.dirtyServiceElementIds.set(id,new Set(draft.elementIds||[]));
   for(const typeId of draft.typeIds||[])state.dirtyServiceTypeIds.add(typeId);
   if(draft.structure)state.dirtyServiceStructureIds.add(id);state.dirty.service=true;
  }else if(module==='references'){state.referenceLinks=value;state.dirty.references=true}
  window.MINDEX_EDITOR_DRAFTS.restoring=true;
  try{
   window.render();
   for(const field of draft.fields||[]){
    const data={...field.data};
    if(module==='service'&&data.serviceItemIndex!==undefined){
     const itemId=draft.value.items[Number(data.serviceItemIndex)]?.id;
     const index=value.items.findIndex(item=>item.id===itemId);
     if(index<0)continue;
     data.serviceItemIndex=String(index);
    }
    const identity=data=>JSON.stringify(Object.keys(data).filter(key=>key!=='initialValue').sort().map(key=>[key,data[key]]));
    const node=[...(refs.detailPane?.querySelectorAll('input,textarea,select')||[])].find(node=>field.id?node.id===field.id:identity(node.dataset)===identity(data));
    if(node){node.value=field.value;if(typeof field.checked==='boolean')node.checked=field.checked;node.dispatchEvent(new Event('input',{bubbles:true}))}
   }
  }finally{window.MINDEX_EDITOR_DRAFTS.restoring=false}
  updateSaveState();showToast('임시 저장본을 복구했습니다. 확인 후 저장해 주세요.');return true;
 }
 document.addEventListener('input',schedule);document.addEventListener('change',schedule);
 window.MINDEX_EDITOR_DRAFTS={matchesDraft:draft=>!!draft&&draft.module===moduleName()&&draft.id===idFor(moduleName())&&content(draft)===content(snapshot(moduleName(),draft.id)),capture:schedule,restoreDraft,identity:()=>{const kind=moduleName(),id=idFor(kind);return id?{kind,id}:null},restoring:false};
})();
