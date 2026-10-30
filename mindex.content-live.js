// Saved catalog/bulletin invalidations share the existing authenticated transport.
(() => {
  if (isPresenterOutputRoute()) return;
  const key='mindex.content.committed.v1',pending=new Map(),seen=new Set(),deletedNotices=new Set();
  let channel,busy=false,probing=false,edit=0;
  for(const event of ['input','change','pointerdown','keydown'])document.addEventListener(event,()=>edit++,true);
  const identity=m=>`${m.kind}:${m.kind==='scripture'?'all':m.recordId}`;
  const controller=()=>refs.detailPane?.querySelector('[data-bulletin-owner]')?.bulletinController;
  const schedule=createLiveRefreshScheduler(pending,flush);
  function remember(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
  function receive(m){
    if(!m||m.project!==state.config.url||typeof m.id!=='string'||!['song','bulletin','bulletin-template','service-list','references','service-settings','setlist-archive','scripture'].includes(m.kind)||typeof m.recordId!=='string'||!m.recordId||seen.has(m.id))return;
    if(m.kind==='song')globalThis.MindexPresenterFreshness?.notify(m.recordId);
    remember(m.id);if(m.kind==='service-list')window.MINDEX_SERVICE_LIST_LIVE?.invalidate();pending.set(identity(m),m);schedule();
  }
  function publish(kind,recordId){
    if(!state.config.url||!recordId)return;
    const m={id:createUuid(),project:state.config.url,kind,recordId};remember(m.id);
    if(kind==='song')globalThis.MindexPresenterFreshness?.notify(recordId);
    if(kind==='setlist-archive'){pending.set(identity(m),m);schedule();}
    try{channel?.postMessage(m);}catch{}
    connectDepartmentRealtime();
    try{void departmentTabSync?.remote?.send({type:'broadcast',event:'content-committed',payload:m}).catch(()=>{});}catch{}
  }
  function praiseBlocked(){return state.module!=='praise'||departmentRefreshBlocked()||songLoadPromise||state.dirty.song||state.dirty.forms
    ||(state.cleanFingerprints.praise&&dirtyModuleFingerprint('praise')!==state.cleanFingerprints.praise);}
  async function rows(client,table,filter){
    const result=await fetchAllRows(()=>({async range(from,to){
      const response=await filter(client.from(table).select('*')).range(from,to);
      if(!response?.error&&!Array.isArray(response?.data))throw Error('Incomplete catalog page');
      return response;
    }}));
    if(result.error)throw result.error;if(!Array.isArray(result.data))throw Error("Incomplete catalog response");return result.data;
  }
  async function refreshSong(id){
    if(state.singleSongRepository)return refreshPraiseCatalog(id);
    if(praiseBlocked())return false;
    const client=state.client,project=state.config.url,revision=edit,selected=state.selectedSongId,versionId=state.selectedVersionId;
    const before=dirtyModuleFingerprint('praise');
    const stale=()=>client!==state.client||project!==state.config.url||revision!==edit||selected!==state.selectedSongId||versionId!==state.selectedVersionId||praiseBlocked()||before!==dirtyModuleFingerprint('praise');
    const result=await client.from('mindex_songs').select('*').eq('id',id).maybeSingle();
    if(result.error)throw result.error;
    let song=result.data?normalizeServerSong(result.data):null;
    if(song&&state.songVersionTablesSupported){
      const versions=[...new Map((await Promise.all(['source_song_id','canonical_song_id'].map(column=>rows(client,'mindex_song_versions',q=>q.eq(column,id).order('id'))))).flat().map(row=>[row.id,row])).values()];
      const units=[];
      for(let offset=0;offset<versions.length;offset+=100)units.push(...await rows(client,'mindex_version_units',q=>q.in('version_id',versions.slice(offset,offset+100).map(v=>v.id)).order('id')));
      attachRelationalSongVersionRows(versions,units,[id],[song]);
    }
    if(song&&state.songRelationsSupported){
      const relations=(await Promise.all(['source_song_id','related_song_id'].map(column=>rows(client,'mindex_song_relations',q=>q.eq(column,id).eq('relation_type','related').order('source_song_id').order('related_song_id'))))).flat();
      song.related_song_ids=[...new Set(relations.map(r=>r.source_song_id===id?r.related_song_id:r.source_song_id).filter(x=>x&&x!==id))].sort();
    }
    if(stale())return false;
    const previous=state.songs.find(s=>s.id===id);
    if(JSON.stringify(dirtyComparableValue(song))===JSON.stringify(dirtyComparableValue(previous||null)))return true;
    // Retain a deleted selected record, so a remote deletion cannot clear the user's view.
    if(!song&&selected===id){const notice=project+':'+id;if(!deletedNotices.has(notice)){deletedNotices.add(notice);showToast('다른 곳에서 이 곡을 삭제했습니다. 현재 화면은 유지됩니다.','info');}return true;}
    if(song)deletedNotices.delete(project+':'+id);
    const viewport=captureDetailViewportSnapshot(),listTop=refs.songList?.scrollTop;
    state.songs=state.songs.filter(s=>s.id!==id);if(song)state.songs.push(song);state.songs.sort(sortSongs);
    clearSearchCaches();
    if(selected===id){
      state.selectedVersionId=song.versions.some(v=>v.id===versionId)?versionId:getPreferredVersionId(song);
      state.forms=normalizeForms((getSelectedVersion()?.forms||[]).map(form=>withLocalId({...form,song_id:state.selectedVersionId})));
      captureCleanFingerprint('praise');render();restoreDetailViewportSnapshot(viewport);
    }else renderSongList();
    if(refs.songList&&listTop!=null)refs.songList.scrollTop=listTop;
    return true;
  }
  function scriptureBlocked(){
    return state.module!=='scripture'||departmentRefreshBlocked()||hasDirtyChanges()||scriptureLoadPromise
      ||(state.cleanFingerprints.scripture&&dirtyModuleFingerprint('scripture')!==state.cleanFingerprints.scripture);
  }
  const scriptureContext=()=>JSON.stringify([state.module,state.selectedScriptureId,state.selectedBookCode,
    state.selectedBibleTranslationId,state.selectedBibleChapter,state.selectedBibleVerse,state.selectedBibleVerses,state.bibleTextSearchQuery,state.search,state.scriptureFilter]);
  async function refreshScriptures(){
    if(scriptureBlocked())return false;
    const client=state.client,project=state.config.url,revision=edit,context=scriptureContext();
    const previous=state.scriptures,ui=state.uiVerses;
    const comparable=value=>JSON.stringify(dirtyComparableValue(value));
    const before=comparable([previous,ui]);
    // Saved excerpts have no revision column. Read this small catalogue only while
    // visible; never read the separate Bible verse corpus or chapter caches.
    const result=await rows(client,'mindex_scriptures',q=>q.eq('is_active',true).order('id'));
    if(result.some(r=>!r||typeof r.id!=='string'||!r.id)||new Set(result.map(r=>r.id)).size!==result.length)throw Error('Invalid scripture catalogue');
    if(client!==state.client||project!==state.config.url||revision!==edit||context!==scriptureContext()
      ||scriptureBlocked()||previous!==state.scriptures||ui!==state.uiVerses||before!==comparable([state.scriptures,state.uiVerses]))return false;
    const normalized=result.map(normalizeServerScripture),nextUi=extractUiVerses(normalized);
    const next=normalized.filter(r=>!uiVerseSlot(r)).sort(sortScriptures);
    const selected=getSelectedScripture(),notice=project+':scripture:'+state.selectedScriptureId;
    if(selected&&!next.some(r=>r.id===selected.id)){
      next.push(selected);next.sort(sortScriptures);
      if(!deletedNotices.has(notice)){deletedNotices.add(notice);showToast('다른 곳에서 이 말씀 자료를 삭제했습니다. 현재 화면은 유지됩니다.','info');}
    }else deletedNotices.delete(notice);
    if(before===comparable([next,nextUi]))return true;
    const selectedChanged=comparable(selected)!==comparable(next.find(r=>r.id===state.selectedScriptureId)||null);
    const viewport=captureDetailViewportSnapshot();
    state.scriptures=next;state.uiVerses=nextUi;state.scripturesLoaded=true;state.scriptureError='';
    captureCleanFingerprint('scripture');clearSearchCaches();
    // The sidebar is the Bible book catalogue, not the saved excerpt list.
    // Leave reader/search DOM and chapter/translation/verse selection intact.
    if(selectedChanged&&!isBibleTextSearchActive()){renderScriptureDetail();restoreDetailViewportSnapshot(viewport);}
    return true;
  }
  const sharedContext=()=>JSON.stringify([state.module,state.selectedServiceId,state.selectedServiceTypeId,state.editingReferenceId,state.editingReferenceGroupKey,state.search,state.pageTabIndex]);
  function sharedBlocked(kind){
    if(departmentRefreshBlocked()||hasDirtyChanges()||serviceDataLoadPromise||activeServiceSavePromise)return true;
    if(kind==='references')return state.module!=='references'||referenceLinksLoadPromise||state.editingReferenceId||state.editingReferenceGroupKey
      ||(state.cleanFingerprints.references&&dirtyModuleFingerprint('references')!==state.cleanFingerprints.references);
    // Defaults participate in projection: never switch them under an open document.
    return !['home','service','presenter','bulletin'].includes(state.module)||state.dirtyServiceTypeIds.size||state.newServiceForm
      ||(['service','presenter','bulletin'].includes(state.module)&&state.selectedServiceId)
      ||(state.module==='service'&&state.cleanFingerprints.service&&dirtyModuleFingerprint('service')!==state.cleanFingerprints.service);
  }
  async function refreshShared(kind){
    if(sharedBlocked(kind))return false;
    const reference=kind==='references',client=state.client,project=state.config.url,revision=edit,context=sharedContext();
    const previous=reference?state.referenceLinks:state.serviceTypes;
    const signature=JSON.stringify(dirtyComparableValue(previous));
    const result=await rows(client,reference?'mindex_reference_links':'mindex_worship_service_types',q=>q.order('id'));
    if(client!==state.client||project!==state.config.url||revision!==edit||context!==sharedContext()||sharedBlocked(kind)
      ||previous!==(reference?state.referenceLinks:state.serviceTypes)||signature!==JSON.stringify(dirtyComparableValue(previous)))return false;
    const next=reference?result.map(normalizeReferenceLink).sort(sortReferenceLinks):result.map(normalizeWorshipServiceType).sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));
    const comparable=value=>JSON.stringify(dirtyComparableValue([...value].sort((a,b)=>a.id.localeCompare(b.id))));
    if(comparable(previous)===comparable(next))return true;
    // An empty type catalogue cannot safely replace the installed defaults.
    if(!reference&&!next.length)throw Error("Empty service settings response");
    const viewport=captureDetailViewportSnapshot(),listTop=refs.songList?.scrollTop;
    if(reference){state.referenceLinks=next;state.referenceLinksLoaded=true;state.referenceError='';captureCleanFingerprint('references');renderReferencesDetail();}
    else{
      state.serviceTypes=next;
      if(state.module==='service')captureCleanFingerprint('service');
      if(state.module==='bulletin')renderBulletinList();else renderServiceList();
      if(state.module==='service'&&state.selectedServiceTypeId===SERVICE_TEMPLATES_PANEL_ID)renderServiceTemplatesDetail();
    }
    restoreDetailViewportSnapshot(viewport);if(refs.songList&&listTop!=null)refs.songList.scrollTop=listTop;
    return true;
  }
  // Entry refreshes use the same deferred queue as saved notifications. Fetch into
  // detached values and recheck interaction/context before adopting any response.
  const entryContext=()=>JSON.stringify([state.module,state.pageTabIndex,state.selectedServiceId,state.selectedServiceTypeId,state.selectedSongId,state.selectedVersionId,state.search]);
  function entryBlocked(){return departmentRefreshBlocked()||hasDirtyChanges()||state.applyingBrowserHistory
    ||songLoadPromise||scriptureLoadPromise||referenceLinksLoadPromise||calendarLoadPromise||serviceDataLoadPromise||activeServiceSavePromise
    ||state.newServiceForm||state.dirtyServiceTypeIds.size||pendingSundayEditSync.size
    ||document.querySelector('[data-input-status="saving"],[data-input-status="error"],[data-input-status="modified"]');}
  async function refreshEntry(message){
    if(message.context!==entryContext())return true;
    if(entryBlocked())return false;
    const module=state.module;
    if(module==='praise')return refreshPraiseCatalog();
    if(module==='calendar')return refreshCalendar();
    if(module==='scripture')return refreshScriptures();
    if(module==='references')return refreshShared('references');
    if(isSetlistArchiveView())return window.MINDEX_ARCHIVE_LIVE?.refresh();
    if(['home','service','presenter','bulletin'].includes(module)){
      const done=await window.MINDEX_SERVICE_LIST_LIVE?.refresh();
      if(message.context!==entryContext()||entryBlocked())return false;
      if(['service','presenter'].includes(module)&&state.selectedServiceId){
        return await window.MINDEX_SERVICE_ENTRY?.check(state.selectedServiceId,undefined,{background:true})&&done;
      }
      const target=controller()?.remoteIdentity();
      return target?await controller().refreshRemote(target.kind,target.recordId)&&done:done;
    }
    return true;
  }
  async function refreshCalendar(){
    const client=state.client,project=state.config.url,context=entryContext(),revision=edit,before=state.calendarData;
    const result=await rows(client,'mindex_sunday_calendar',q=>q.order('date').order('id'));
    if(client!==state.client||project!==state.config.url||context!==entryContext()||revision!==edit||before!==state.calendarData||entryBlocked())return false;
    result.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    if(JSON.stringify(before)===JSON.stringify(result))return true;
    const viewport=captureDetailViewportSnapshot(),top=refs.songList?.scrollTop;
    state.calendarData=result;state.calendarLoaded=true;state.calendarError='';
    renderSongList();renderCalendarView();restoreDetailViewportSnapshot(viewport);
    if(refs.songList&&top!=null)refs.songList.scrollTop=top;
    return true;
  }
  async function refreshPraiseCatalog(recordId=""){
    if(praiseBlocked())return false;
    const client=state.client,project=state.config.url,context=entryContext(),revision=edit;
    const previous=state.songs,repository=state.singleSongRepository,oldCatalog=state.singleSongCatalog;
    let catalog,next;
    if(repository){
      if(recordId){
        const records=await repository.read([recordId]);
        const fresh=new Map(oldCatalog.ids().map(id=>[id,oldCatalog.get(id)]));
        for(const record of records)fresh.set(record.id,record);
        catalog=globalThis.MindexSingleSong.createCatalog([...fresh.values()]);
      }else{
        const prepared=await globalThis.MindexSingleSong.loadActivation(client);
        if(prepared.phase!=='native')throw Error('Praise storage changed during entry');
        catalog=globalThis.MindexSingleSong.createCatalog(prepared.records);
      }
      next=catalog.ids().map(id=>catalog.appSong(id));
    }else{
      const data=await rows(client,'mindex_songs',q=>q);
      next=data.map(normalizeServerSong);
      if(state.songVersionTablesSupported){
        const versions=await rows(client,'mindex_song_versions',q=>q),units=await rows(client,'mindex_version_units',q=>q);
        attachRelationalSongVersionRows(versions,units,next.map(song=>song.id),next);
      }
      if(state.songRelationsSupported){
        const relations=await rows(client,'mindex_song_relations',q=>q.eq('relation_type','related'));
        for(const song of next)song.related_song_ids=[...new Set(relations.flatMap(r=>r.source_song_id===song.id?[r.related_song_id]:r.related_song_id===song.id?[r.source_song_id]:[]))];
      }
    }
    if(client!==state.client||project!==state.config.url||context!==entryContext()||revision!==edit||previous!==state.songs
      ||repository!==state.singleSongRepository||oldCatalog!==state.singleSongCatalog||entryBlocked()||praiseBlocked())return false;
    // A remote deletion must not clear the open record or its authored selection.
    const selected=previous.find(song=>song.id===state.selectedSongId);
    if(selected&&!next.some(song=>song.id===selected.id)){
      next.push(selected);
      if(catalog)catalog=globalThis.MindexSingleSong.createCatalog([...catalog.ids().map(id=>catalog.get(id)),oldCatalog.get(selected.id)]);
    }
    next.sort(sortSongs);
    if(JSON.stringify(dirtyComparableValue(previous))===JSON.stringify(dirtyComparableValue(next)))return true;
    const viewport=captureDetailViewportSnapshot(),top=refs.songList?.scrollTop;
    if(catalog)state.singleSongCatalog=catalog;
    state.songs=next;clearSearchCaches();
    const song=next.find(song=>song.id===state.selectedSongId);
    if(song){
      if(!song.versions.some(version=>version.id===state.selectedVersionId))state.selectedVersionId=getPreferredVersionId(song);
      state.forms=normalizeForms((getSelectedVersion()?.forms||[]).map(form=>withLocalId({...form,song_id:state.selectedVersionId})));
      captureCleanFingerprint('praise');
    }
    render();restoreDetailViewportSnapshot(viewport);if(refs.songList&&top!=null)refs.songList.scrollTop=top;
    return true;
  }
  function enter(){
    pending.set('entry',{kind:'entry',project:state.config.url,context:entryContext()});
    window.MINDEX_SERVICE_LIST_LIVE?.invalidate();
    schedule();
  }
  async function flush(){
    if(busy||!pending.size)return;
    if(departmentRefreshBlocked()){schedule(2000);return;}
    busy=true;let delay=2000;
    try{
      for(const [id,m] of [...pending]){
        if(m.project!==state.config.url){if(pending.get(id)===m)pending.delete(id);continue;}
        const done=m.kind==='entry'?await refreshEntry(m):m.kind==='scripture'?await refreshScriptures():m.kind==='setlist-archive'?await window.MINDEX_ARCHIVE_LIVE?.refresh():['references','service-settings'].includes(m.kind)?await refreshShared(m.kind):m.kind==='service-list'?await window.MINDEX_SERVICE_LIST_LIVE?.refresh():m.kind==='song'?await refreshSong(m.recordId):await controller()?.refreshRemote(m.kind,m.recordId);
        if(done&&pending.get(id)===m)pending.delete(id);
      }
    }catch{delay=15000;}
    finally{busy=false;schedule(delay);}
  }
  async function reconcile(){
    if(probing||departmentRefreshBlocked())return;
    probing=true;
    try{
      window.MINDEX_SERVICE_LIST_LIVE?.reconcile();
      window.MINDEX_ARCHIVE_LIVE?.reconcile();
      if(!scriptureBlocked())receive({id:createUuid(),project:state.config.url,kind:'scripture',recordId:'all'});
      for(const kind of ['references','service-settings'])if(!sharedBlocked(kind))receive({id:createUuid(),project:state.config.url,kind,recordId:'all'});
      // Only the visible record is fetched on recovery; no full lyrics corpus polling.
      if(state.module==='praise'&&state.selectedSongId)receive({id:createUuid(),project:state.config.url,kind:'song',recordId:state.selectedSongId});
      const target=controller()?.remoteIdentity();
      if(target)receive({id:createUuid(),project:state.config.url,...target});
    }finally{probing=false;}
  }
  try{channel=new BroadcastChannel(key);channel.onmessage=e=>receive(e.data);}catch{}
  window.addEventListener('storage',e=>{if(e.key===key&&e.newValue)try{receive(JSON.parse(e.newValue));}catch{}});
  function wake(){enter();schedule();void reconcile();}
  window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  setInterval(()=>void reconcile(),60000);
  window.MINDEX_CONTENT_LIVE={publish,receive,reconcile,enter};
})();
