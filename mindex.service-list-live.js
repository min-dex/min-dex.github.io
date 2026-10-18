// List metadata only: full documents, atomic baselines and open editors stay intact.
(() => {
  if (isPresenterOutputRoute()) return;
  let edit=0,busy=false,retryAfter=0,retryContext='';
  const notices=new Set();
  for(const event of ['input','change','pointerdown','keydown'])document.addEventListener(event,()=>edit++,true);
  const visible=()=>['home','service','presenter','bulletin'].includes(state.module);
  const context=()=>JSON.stringify([state.module,state.selectedServiceId,state.selectedServiceTypeId,state.pageTabIndex,state.search]);
  function blocked(){
    return !visible()||departmentRefreshBlocked()||hasDirtyChanges()||state.newServiceForm||state.dirtyServiceTypeIds.size
      ||serviceDataLoadPromise||activeServiceSavePromise||serviceItemLoadPromises.size||presenterServiceHydrationPromises.size
      ||worshipPresenterSlideLoadPromises.size||state.presenterPreparationApplyingServiceIds.size||pendingSundayEditSync.size
      ||document.querySelector('[data-input-status="saving"],[data-input-status="error"],[data-input-status="modified"]');
  }
  function retain(id){
    if(sundayEditSyncHasLocalDraft(id))return true;
    if(['service','presenter','bulletin'].includes(state.module)&&state.selectedServiceId===id)return true;
    for(const documents of bulletinTabSessions.values())if(documents.get(id)?.dirty||documents.get(id)?.saving)return true;
    return false;
  }
  async function readRows(client,table,select,filter=q=>q){
    const result=await fetchAllRows(()=>({async range(from,to){
      const response=await filter(client.from(table).select(select)).order('id').range(from,to);
      if(!response?.error&&!Array.isArray(response?.data))throw Error('Incomplete service list page');
      return response;
    }}));
    if(result.error)throw result.error;
    if(!Array.isArray(result.data))throw Error('Incomplete service list');
    return result.data;
  }
  async function readNew(client,ids){
    const records=[];
    for(let i=0;i<ids.length;i+=100){
      const batch=ids.slice(i,i+100),filter=q=>q.in('id',batch);
      try{records.push(...await readRows(client,WORSHIP_SERVICE_LIST_VIEW,WORSHIP_SERVICE_LIST_VIEW_SELECT,filter));}
      catch(error){
        if(!isMissingWorshipListViewError(error))throw error;
        records.push(...await readRows(client,'mindex_worship_services',state.serviceAliasSupported===false?WORSHIP_SERVICE_BASE_LIST_SELECT:WORSHIP_SERVICE_LIST_SELECT,filter));
      }
    }
    if(records.length!==ids.length)throw Error('Service membership changed during read');
    return records.map(normalizeWorshipService);
  }
  async function refresh(){
    if(busy||blocked())return false;
    const beforeContext=context();
    if(retryContext===beforeContext&&Date.now()<retryAfter)return false;
    busy=true;
    const client=state.client,project=state.config.url,before=state.services,revision=edit;
    const stale=()=>client!==state.client||project!==state.config.url||before!==state.services||revision!==edit||beforeContext!==context()||blocked();
    try{
      // Complete paginated summary scan: never infer deletion from cached or partial data.
      const summaries=await readRows(client,'mindex_worship_services','id,service_type_id,service_date,service_date_end,title,praise_leader,worship_leader,status'+(state.serviceAliasSupported===false?'':',service_alias'));
      const ids=new Set(summaries.map(row=>row.id));
      if(stale())return false;
      const previousById=new Map(before.map(row=>[row.id,row]));
      const existing=new Set(previousById.keys());
      const additions=await readNew(client,[...ids].filter(id=>!existing.has(id)));
      if(stale())return false;
      const removals=new Set();let deferred=false;
      for(const service of before){
        if(!service._worship||service._isExpected||ids.has(service.id))continue;
        if(retain(service.id)){
          deferred=true;
          const key=project+':'+service.id;
          // Service-entry already owns the open worship deletion notice.
          if(state.module==='bulletin'&&!notices.has(key)){notices.add(key);showToast('다른 곳에서 이 예배를 삭제했습니다. 열어 둔 주보는 유지됩니다.','info');}
        }else removals.add(service.id);
      }
      const updates=new Map();
      const fields=['type_id','date','date_end','title','alias','leader','praiseLeader','worshipLeader','_worshipServiceTypeId','_worshipStatus'];
      for(const raw of summaries){
        const prior=previousById.get(raw.id);if(!prior||prior._isExpected)continue;
        const next=normalizeWorshipService(raw);
        if(!fields.some(key=>prior[key]!==next[key]))continue;
        if(retain(raw.id)){deferred=true;continue;}
        updates.set(raw.id,Object.fromEntries(fields.map(key=>[key,next[key]])));
      }
      if(additions.length||removals.size||updates.size){
        const positions=[refs.songList,refs.detailPane].filter(Boolean).map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
        state.services=sortServicesByDate([...before.filter(row=>!removals.has(row.id)).map(row=>updates.has(row.id)?{...row,...updates.get(row.id)}:row),...additions]);
        for(const id of new Set([...removals,...updates.keys()])){state.loadedWorshipServiceIds.delete(id);state.loadedWorshipPresenterServiceIds.delete(id);presenterSlideBuildCache.delete(id);}
        clearSearchCaches();
        if(state.module==='bulletin')renderBulletinList();else renderServiceList();
        // Never render an open worship/Presenter/bulletin or a settings/archive editor.
        if(state.module==='home'&&state.selectedServiceTypeId!==SERVICE_SETLIST_ARCHIVE_PANEL_ID)renderHomeDetail();
        else if(state.module==='service'&&!state.selectedServiceId&&![SERVICE_TEMPLATES_PANEL_ID,SERVICE_SETLIST_ARCHIVE_PANEL_ID].includes(state.selectedServiceTypeId))renderServiceDetail();
        for(const {node,top,left} of positions){if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}}
      }
      retryContext=beforeContext;retryAfter=deferred?Date.now()+15000:0;
      return !deferred;
    }finally{busy=false;}
  }
  function reconcile(){
    if(blocked())return;
    window.MINDEX_CONTENT_LIVE?.receive({id:createUuid(),project:state.config.url,kind:'service-list',recordId:'all'});
  }
  window.MINDEX_SERVICE_LIST_LIVE={refresh,reconcile,invalidate(){retryAfter=0;}};
})();
