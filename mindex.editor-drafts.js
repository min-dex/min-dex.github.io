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
   ...(module==='service'?{sourceText:serviceSourceTextareaForService(id)?.value,elementIds:[...(state.dirtyServiceElementIds.get(id)||[])],structure:state.dirtyServiceStructureIds.has(id),typeIds:[...state.dirtyServiceTypeIds]}:{})};
  const serialized=JSON.stringify(value);
  if(last.get(key)===serialized)return;
  if(storage.queue('local',key,serialized)){last.set(key,serialized);touched.add(key)}
 }
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;capture();render()})}
 function render(){
  if(!refs.saveAllBtn||!window.MINDEX_SERVER_STORAGE?.ready)return;
  let button=document.getElementById('restoreServerEditorDraft');
  if(!button){button=document.createElement('button');button.id='restoreServerEditorDraft';button.className='btn secondary';button.textContent='초안 복구';button.onclick=restore;refs.saveAllBtn.before(button)}
  const module=moduleName(),id=idFor(module);
  button.hidden=!id||!window.MINDEX_SERVER_STORAGE.getItem('local',keyFor(module,id));
 }
 async function restore(){
  const module=moduleName(),id=idFor(module);if(!id||state.saving)return;
  const raw=window.MINDEX_SERVER_STORAGE.getItem('local',keyFor(module,id));if(!raw)return;
  let draft;try{draft=JSON.parse(raw)}catch{showToast('초안 형식을 확인하지 못했습니다. 원본은 서버에 보관됩니다.','error');return}
  if(draft.schema!==1||draft.module!==module||draft.id!==id)return;
  if(hasDirtyChanges()||pendingFields().length){showToast('현재 입력을 먼저 저장하거나 정리해 주세요.','error');return}
  if(draft.base&&dirtyModuleFingerprint(module)!==draft.base){showToast('초안을 만든 뒤 서버 내용이 바뀌었습니다. 현재 내용을 덮어쓰지 않고 초안을 보관합니다.','error');return}
  if(!window.confirm('서버에 보관된 미저장 초안을 편집창에 복구할까요?'))return;
  const value=structuredClone(draft.value);
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
   if(draft.sourceText!==undefined)state.services[index]._worshipSourceTextDraft=draft.sourceText;
   state.dirtyServiceElementIds.set(id,new Set(draft.elementIds||[]));
   for(const typeId of draft.typeIds||[])state.dirtyServiceTypeIds.add(typeId);
   if(draft.structure)state.dirtyServiceStructureIds.add(id);state.dirty.service=true;
  }else if(module==='references'){state.referenceLinks=value;state.dirty.references=true}
  touched.add(keyFor(module,id));window.MINDEX_EDITOR_DRAFTS.restoring=true;
  try{
   window.render();
   for(const field of draft.fields||[]){
    const node=[...(refs.detailPane?.querySelectorAll('input,textarea,select')||[])].find(node=>field.id?node.id===field.id:JSON.stringify({...node.dataset})===JSON.stringify(field.data));
    if(node){node.value=field.value;if(typeof field.checked==='boolean')node.checked=field.checked;node.dispatchEvent(new Event('input',{bubbles:true}))}
   }
  }finally{window.MINDEX_EDITOR_DRAFTS.restoring=false}
  updateSaveState();showToast('초안을 복구했습니다. 확인 후 저장해 주세요.');
 }
 window.addEventListener('mindex-server-state-settled',render);
 window.addEventListener('mindex-server-storage-ready',render);
 document.addEventListener('input',schedule);document.addEventListener('change',schedule);
 window.MINDEX_EDITOR_DRAFTS={capture:schedule,restoring:false};
})();
