// Drafts are private server records. Restoring changes only the editor, never DB rows.
(() => {
 const touched=new Set(),last=new Map();let scheduled=false;
 const moduleName=()=>['service','presenter'].includes(state.module)?'service':state.module;
 const idFor=module=>module==='praise'?state.selectedSongId:module==='scripture'?state.selectedScriptureId:module==='service'?state.selectedServiceId:module==='references'?'all':null;
 const keyFor=(module,id)=>`mindex.editor.draft.v1:${module}:${id}`;
 function pendingFields(){return [...(refs.detailPane?.querySelectorAll('input,textarea,select')||[])]
  .filter(node=>node.type!=='file'&&node.type!=='password'&&node.dataset.initialValue!==undefined&&node.value!==node.dataset.initialValue)
  .map(node=>({id:node.id,data:{...node.dataset},value:node.value,checked:node.checked}));}
 function capture(){
  const storage=window.MINDEX_SERVER_STORAGE;if(!storage?.ready)return;
  const module=moduleName(),id=idFor(module);if(!id)return;
  const key=keyFor(module,id),fields=pendingFields();
  const dirty=module==='praise'?state.dirty.song||state.dirty.forms:state.dirty[module];
  if(!dirty&&!fields.length){
   if(touched.has(key)){storage.queue('local',key,null);touched.delete(key);last.delete(key)}
   return;
  }
  const value={schema:1,module,id,base:state.cleanFingerprints[module],value:dirtyModuleValue(module),fields,
   ...(module==='service'?{sourceText:serviceSourceTextareaForService(id)?.value??state.services.find(row=>row.id===id)?._worshipSourceTextDraft,elementIds:[...(state.dirtyServiceElementIds.get(id)||[])],structure:state.dirtyServiceStructureIds.has(id),typeIds:[...state.dirtyServiceTypeIds]}:{})};
  const serialized=JSON.stringify(value);
  if(last.get(key)===serialized)return;
  if(storage.queue('local',key,serialized)){last.set(key,serialized);touched.add(key);window.MINDEX_DRAFT_HANDOFF?.publish(module,id,value,value.value?.song?.title||value.value?.title||value.value?.service?.title||'편집 초안')}
 }
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;capture();render()})}
 function render(){
  if(!refs.saveAllBtn||!window.MINDEX_SERVER_STORAGE?.ready)return;
  let button=document.getElementById('restoreServerEditorDraft');
  if(!button){button=document.createElement('button');button.id='restoreServerEditorDraft';button.className='btn secondary';button.textContent='임시 저장본 복구';button.onclick=restore;refs.saveAllBtn.before(button)}
  const module=moduleName(),id=idFor(module);
  button.hidden=!id||!window.MINDEX_SERVER_STORAGE.getItem('local',keyFor(module,id));
 }
 async function restore(){
  const module=moduleName(),id=idFor(module);if(!id||state.saving)return;
  const raw=window.MINDEX_SERVER_STORAGE.getItem('local',keyFor(module,id));if(!raw)return;
  let draft;try{draft=JSON.parse(raw)}catch{showToast('임시 저장본 형식을 확인하지 못했습니다. 원본은 서버에 보관됩니다.','error');return}
  return restoreDraft(draft);
 }
 async function restoreDraft(draft){
  const module=moduleName(),id=idFor(module);
  if(state.saving||state.serviceMusic?.playing||state.serviceMusic?.pending||isPresenterOutputWindowOpen()){showToast('저장이나 재생을 마친 뒤 임시 저장본을 복구해 주세요.','error');return false;}
  if(draft?.schema!==1||draft.module!==module||draft.id!==id)return false;
  const payload=draft.value;
  if((module==='praise'&&(!payload?.song||payload.song.id!==id||!Array.isArray(payload.forms)))||(module==='scripture'&&payload?.id!==id)||(module==='service'&&(payload?.service?.id!==id||!Array.isArray(payload.items)||!Array.isArray(payload.serviceTypes)))||(module==='references'&&!Array.isArray(payload))){showToast('임시 저장본 내용과 연결 대상을 확인하지 못했습니다. 원본은 보존됩니다.','error');return false;}
  if(hasDirtyChanges()||pendingFields().length){showToast('현재 입력을 먼저 저장하거나 정리해 주세요.','error');return}
  const fingerprint=dirtyModuleFingerprint(module),client=state.client;
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
  if(!window.confirm(notice))return;
  try{
   // Never lose the draft or the latest editor snapshot, even after a later save.
   await window.MINDEX_SERVER_STORAGE.setItem('local',`mindex.editor.recovery.v1:${module}:${id}:${crypto.randomUUID()}`,
    JSON.stringify({schema:1,module,id,draft,current:dirtyModuleValue(module),createdAt:new Date().toISOString()}));
  }catch{showToast('복구 전 보관을 완료하지 못했습니다. 원본과 임시 저장본을 유지합니다. 연결을 확인하고 다시 시도해 주세요.','error');return false;}
  if(moduleName()!==module||idFor(module)!==id||state.client!==client||dirtyModuleFingerprint(module)!==fingerprint||hasDirtyChanges()||pendingFields().length||state.saving||state.serviceMusic?.playing||state.serviceMusic?.pending||isPresenterOutputWindowOpen()){
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
  touched.add(keyFor(module,id));window.MINDEX_EDITOR_DRAFTS.restoring=true;
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
 window.addEventListener('mindex-server-state-settled',render);
 window.addEventListener('mindex-server-storage-ready',render);
 document.addEventListener('input',schedule);document.addEventListener('change',schedule);
 window.MINDEX_EDITOR_DRAFTS={capture:schedule,restoreDraft,identity:()=>{const kind=moduleName(),id=idFor(kind);return id?{kind,id}:null},restoring:false};
})();
