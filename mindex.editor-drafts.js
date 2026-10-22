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
 const parse=raw=>{try{return JSON.parse(raw)}catch{return null}};
 function snapshot(module,id){
  return {schema:1,module,id,base:state.cleanFingerprints[module],value:structuredClone(dirtyModuleValue(module)),fields:pendingFields(),
   ...(module==='service'?{sourceText:serviceSourceTextareaForService(id)?.value??state.services.find(row=>row.id===id)?._worshipSourceTextDraft,elementIds:[...(state.dirtyServiceElementIds.get(id)||[])],structure:state.dirtyServiceStructureIds.has(id),typeIds:[...state.dirtyServiceTypeIds]}:{})};
 }
 function content(draft){
  return JSON.stringify([draft.value,draft.sourceText??null,(draft.fields||[]).map(field=>({id:field.id,data:Object.fromEntries(Object.entries(field.data||{}).filter(([key])=>key!=='initialValue').sort(([a],[b])=>a.localeCompare(b))),value:field.value,checked:field.checked}))]);
 }
 function candidates(module,id){
  const storage=window.MINDEX_SERVER_STORAGE,current=content(snapshot(module,id)),seen=new Set();
  const keys=[keyFor(module,id),...(storage.keys?.('local')||[]).filter(key=>key.startsWith(historyPrefix(module,id)))];
  return keys.map(key=>({key,draft:parse(storage.getItem('local',key))}))
   .filter(({draft})=>draft?.schema===1&&draft.module===module&&draft.id===id&&draft.value)
   .sort((a,b)=>String(b.draft.savedAt||'').localeCompare(String(a.draft.savedAt||'')))
   .filter(({draft})=>{const value=content(draft);if(value===current||seen.has(value))return false;seen.add(value);return true});
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
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;capture();render()})}
 function render(){
  if(!refs.saveAllBtn||!window.MINDEX_SERVER_STORAGE?.ready)return;
  let button=document.getElementById('restoreServerEditorDraft');
  if(!button){button=document.createElement('button');button.id='restoreServerEditorDraft';button.className='btn secondary';const label=document.createElement('span');label.textContent='임시 저장본 복구';button.append(label);button.onclick=restore;refs.saveAllBtn.before(button)}
  const module=moduleName(),id=idFor(module);
  button.hidden=!id||!candidates(module,id).length;
 }
 function preview(draft){
  const lines=[],value=draft.value;
  const add=(label,text)=>{if(typeof text==='string'&&text.trim())lines.push(`${label}\n${text}`)};
  if(draft.module==='praise'){add('제목',value.song?.title);for(const form of value.forms||[])add(form.label||form.part_type||'가사',form.lyrics)}
  else if(draft.module==='scripture'){add('제목',value.title);add('본문',value.body||value.text);add('장절',value.reference);add('역본',value.translation)}
  else if(draft.module==='service'){add('예배',value.service?.title);add('원문',draft.sourceText||value.service?._worshipSourceTextDraft);for(const item of value.items||[])add(item.label||'순서',[item.raw_title,item.assignee,item.text].filter(Boolean).join(' / '))}
  else for(const item of value||[])add(item.title||'참고자료',item.url);
  for(const field of draft.fields||[])add('미반영 입력',field.value);
  return lines.join('\n\n')||'표시할 본문이 없습니다. 제목·연결·설정 변경이 포함될 수 있습니다.';
 }
 async function restore(){
  const module=moduleName(),id=idFor(module);if(!id||state.saving)return;
  const entries=candidates(module,id);if(!entries.length)return;
  const current=snapshot(module,id),signature=content(current),client=state.client;
  const dialog=document.createElement('dialog');dialog.className='editor-draft-review';dialog.setAttribute('aria-label','임시 저장본 확인');
  const title=document.createElement('h2');title.textContent='임시 저장본 확인';dialog.append(title);
  const note=document.createElement('p');note.textContent='현재 입력은 먼저 별도로 보관합니다. 복구 후 확인하고 저장해야 예배·찬양에 반영됩니다.';dialog.append(note);
  const label=document.createElement('label');label.textContent='보관 시각';const select=document.createElement('select');select.setAttribute('aria-label','복구할 임시 저장본');
  entries.forEach(({draft},index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=draft.savedAt?new Date(draft.savedAt).toLocaleString('ko-KR'):'기존 초안 · 보관 시각 정보 없음';select.append(option)});label.append(select);dialog.append(label);
  const columns=document.createElement('div');columns.className='editor-draft-preview';dialog.append(columns);
  const field=(name,text)=>{const label=document.createElement('label');label.textContent=name;const area=document.createElement('textarea');area.readOnly=true;area.value=text;area.setAttribute('aria-label',name);label.append(area);columns.append(label);return area};
  field('현재 입력',preview(current));const saved=field('복구할 내용',preview(entries[0].draft));select.onchange=()=>saved.value=preview(entries[Number(select.value)].draft);
  const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
  const actions=document.createElement('div');actions.className='editor-draft-actions';dialog.append(actions);
  const cancel=document.createElement('button');cancel.className='btn secondary';cancel.textContent='닫기';cancel.onclick=()=>dialog.close();actions.append(cancel);
  const apply=document.createElement('button');apply.className='btn primary';apply.textContent='편집창에 복구';actions.append(apply);
  apply.onclick=async()=>{
   if(moduleName()!==module||idFor(module)!==id||state.client!==client||content(snapshot(module,id))!==signature){status.textContent='현재 입력이나 화면이 바뀌었습니다. 닫고 다시 확인해 주세요.';return}
   apply.disabled=true;select.disabled=true;
   try{if(await restoreDraft(entries[Number(select.value)].draft))dialog.close();else status.textContent='복구하지 않았습니다. 현재 입력과 보관본은 유지됩니다.'}
   finally{apply.disabled=false;select.disabled=false}
  };
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
 }
 async function restoreDraft(draft){
  const module=moduleName(),id=idFor(module);
  if(state.saving||state.serviceMusic?.playing||state.serviceMusic?.pending||isPresenterOutputWindowOpen()){showToast('저장이나 재생을 마친 뒤 임시 저장본을 복구해 주세요.','error');return false;}
  if(draft?.schema!==1||draft.module!==module||draft.id!==id)return false;
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
  if(!window.confirm(notice))return;
  const unchanged=()=>moduleName()===module&&idFor(module)===id&&state.client===client&&dirtyModuleFingerprint(module)===fingerprint&&content(snapshot(module,id))===signature&&!state.saving&&!state.serviceMusic?.playing&&!state.serviceMusic?.pending&&!isPresenterOutputWindowOpen();
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
 window.addEventListener('mindex-server-state-settled',render);
 window.addEventListener('mindex-server-storage-ready',render);
 document.addEventListener('input',schedule);document.addEventListener('change',schedule);
 window.MINDEX_EDITOR_DRAFTS={capture:schedule,restoreDraft,identity:()=>{const kind=moduleName(),id=idFor(kind);return id?{kind,id}:null},restoring:false};
})();
