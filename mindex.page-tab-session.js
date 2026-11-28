// Per-tab editor/view state is memory-only. It never saves records or changes output.
(() => {
  const sessions = new Map();
  const fields = () => [...(refs.detailPane?.querySelectorAll("input,textarea,select") || [])]
    .filter(node => node.type !== "file" && node.type !== "password" && node.dataset.initialValue !== undefined && node.value !== node.dataset.initialValue)
    .map(node => ({id:node.id||"",data:Object.fromEntries(Object.entries(node.dataset).filter(([key])=>key!=="initialValue")),value:node.value,checked:node.checked}));
  const identity = data => JSON.stringify(Object.keys(data||{}).sort().map(key=>[key,data[key]]));
  const focus = () => {
    const field=document.activeElement;
    if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement||field instanceof HTMLSelectElement)||!refs.detailPane?.contains(field))return null;
    return {id:field.id||"",data:Object.fromEntries(Object.entries(field.dataset).filter(([key])=>key!=="initialValue")),start:typeof field.selectionStart==="number"?field.selectionStart:null,end:typeof field.selectionEnd==="number"?field.selectionEnd:null};
  };
  function capture(tab=state.pageTabs[state.pageTabIndex]){
    if(!tab)return;
    const module=["service","presenter"].includes(state.module)?"service":state.module;
    const dirty=module==="praise"?state.dirty.song||state.dirty.forms:Boolean(state.dirty[module]);
    const pending=fields();
    const editor=(dirty||pending.length)&&["praise","scripture","service","references"].includes(module)?{module,value:structuredClone(dirtyModuleValue(module)),dirty,fields:pending,...(module==="service"?{serviceId:state.selectedServiceId,sourceText:serviceSourceTextareaForService(state.selectedServiceId)?.value??state.services.find(row=>row.id===state.selectedServiceId)?._worshipSourceTextDraft,elementIds:[...(state.dirtyServiceElementIds.get(state.selectedServiceId)||[])],structure:state.dirtyServiceStructureIds.has(state.selectedServiceId),typeIds:[...state.dirtyServiceTypeIds]}:{})}:null;
    sessions.set(tab.id,{editor,view:{detailTop:refs.detailPane?.scrollTop||0,detailLeft:refs.detailPane?.scrollLeft||0,listTop:refs.songList?.scrollTop||0,listLeft:refs.songList?.scrollLeft||0,rightTop:refs.rightSidebar?.scrollTop||0,selectedServiceItemIndex:state.selectedServiceItemIndex,focus:focus()}});
  }
  function restoreFields(saved=[],focused=null){
    const controls=[...(refs.detailPane?.querySelectorAll("input,textarea,select")||[])];
    const locate=value=>controls.find(node=>value.id?node.id===value.id:identity(Object.fromEntries(Object.entries(node.dataset).filter(([key])=>key!=="initialValue")))===identity(value.data));
    for(const value of saved){const node=locate(value);if(!node)continue;node.value=value.value;if(typeof value.checked==="boolean")node.checked=value.checked}
    const target=focused?locate(focused):null;if(target){target.focus({preventScroll:true});if(focused.start!==null&&typeof target.setSelectionRange==="function")target.setSelectionRange(focused.start,focused.end??focused.start)}
  }
  function restore(tab=state.pageTabs[state.pageTabIndex]){
    const session=tab?sessions.get(tab.id):null,editor=session?.editor;clearDirtyState();
    if(editor?.module==="praise"&&editor.value?.song){state.songs=state.songs.map(song=>song.id===editor.value.song.id?structuredClone(editor.value.song):song);state.selectedVersionId=editor.value.versionId;state.forms=structuredClone(editor.value.forms||[]);state.dirty.song=editor.dirty;state.dirty.forms=editor.dirty}
    else if(editor?.module==="scripture"&&editor.value?.id){state.scriptures=state.scriptures.map(row=>row.id===editor.value.id?structuredClone(editor.value):row);state.dirty.scripture=editor.dirty}
    else if(editor?.module==="service"&&editor.value?.service?.id===editor.serviceId){state.services=state.services.map(row=>row.id===editor.serviceId?structuredClone(editor.value.service):row);state.serviceItems[editor.serviceId]=structuredClone(editor.value.items||[]);state.serviceTypes=structuredClone(editor.value.serviceTypes||state.serviceTypes);const service=state.services.find(row=>row.id===editor.serviceId);if(service&&editor.sourceText!==undefined)service._worshipSourceTextDraft=editor.sourceText;if(editor.dirty){state.dirty.service=true;state.dirtyServiceElementIds.set(editor.serviceId,new Set(editor.elementIds||[]));if(editor.structure)state.dirtyServiceStructureIds.add(editor.serviceId);for(const typeId of editor.typeIds||[])state.dirtyServiceTypeIds.add(typeId)}}
    else if(editor?.module==="references"&&Array.isArray(editor.value)){state.referenceLinks=structuredClone(editor.value);state.dirty.references=editor.dirty}
    const view=session?.view;if(Number.isInteger(view?.selectedServiceItemIndex))state.selectedServiceItemIndex=view.selectedServiceItemIndex;
    if(editor||Number.isInteger(view?.selectedServiceItemIndex))render();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(tab?.id!==state.pageTabs[state.pageTabIndex]?.id)return;if(refs.detailPane){refs.detailPane.scrollTop=view?.detailTop||0;refs.detailPane.scrollLeft=view?.detailLeft||0}if(refs.songList){refs.songList.scrollTop=view?.listTop||0;refs.songList.scrollLeft=view?.listLeft||0}if(refs.rightSidebar)refs.rightSidebar.scrollTop=view?.rightTop||0;restoreFields(editor?.fields,view?.focus);updateSaveState()}));
  }
  window.MINDEX_PAGE_TAB_SESSION={capture,restore,remove:id=>sessions.delete(id),isDirty:id=>Boolean(sessions.get(id)?.editor?.dirty)};
})();
