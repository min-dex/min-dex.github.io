// Saved catalog/bulletin invalidations share the existing authenticated transport.
(() => {
  if (isPresenterOutputRoute()) return;
  const key='mindex.content.committed.v1',pending=new Map(),seen=new Set(),deletedNotices=new Set();
  let channel,timer,busy=false,probing=false,edit=0;
  for(const event of ['input','change','pointerdown','keydown'])document.addEventListener(event,()=>edit++,true);
  const identity=m=>`${m.kind}:${m.recordId}`;
  const controller=()=>refs.detailPane?.querySelector('[data-bulletin-owner]')?.bulletinController;
  function schedule(delay=200){if(!timer&&pending.size)timer=setTimeout(()=>{timer=null;void flush();},delay);}
  function remember(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
  function receive(m){
    if(!m||m.project!==state.config.url||typeof m.id!=='string'||!['song','bulletin','bulletin-template','service-list'].includes(m.kind)||typeof m.recordId!=='string'||!m.recordId||seen.has(m.id))return;
    remember(m.id);if(m.kind==='service-list')window.MINDEX_SERVICE_LIST_LIVE?.invalidate();pending.set(identity(m),m);schedule();
  }
  function publish(kind,recordId){
    if(!state.config.url||!recordId)return;
    const m={id:createUuid(),project:state.config.url,kind,recordId};remember(m.id);
    try{channel?.postMessage(m);}catch{}
    try{localStorage.setItem(key,JSON.stringify(m));}catch{}
    connectDepartmentRealtime();
    try{void departmentTabSync?.remote?.send({type:'broadcast',event:'content-committed',payload:m}).catch(()=>{});}catch{}
  }
  function praiseBlocked(){return state.module!=='praise'||departmentRefreshBlocked()||songLoadPromise||state.dirty.song||state.dirty.forms
    ||(state.cleanFingerprints.praise&&dirtyModuleFingerprint('praise')!==state.cleanFingerprints.praise);}
  async function rows(client,table,filter){
    const result=await fetchAllRows(()=>filter(client.from(table).select('*')));
    if(result.error)throw result.error;return result.data||[];
  }
  async function refreshSong(id){
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
  async function flush(){
    if(busy||!pending.size)return;
    if(departmentRefreshBlocked()){schedule(2000);return;}
    busy=true;let delay=2000;
    try{
      for(const [id,m] of [...pending]){
        if(m.project!==state.config.url){if(pending.get(id)===m)pending.delete(id);continue;}
        const done=m.kind==='service-list'?await window.MINDEX_SERVICE_LIST_LIVE?.refresh():m.kind==='song'?await refreshSong(m.recordId):await controller()?.refreshRemote(m.kind,m.recordId);
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
      // Only the visible record is fetched on recovery; no full lyrics corpus polling.
      if(state.module==='praise'&&state.selectedSongId)receive({id:createUuid(),project:state.config.url,kind:'song',recordId:state.selectedSongId});
      const target=controller()?.remoteIdentity();
      if(target)receive({id:createUuid(),project:state.config.url,...target});
    }finally{probing=false;}
  }
  try{channel=new BroadcastChannel(key);channel.onmessage=e=>receive(e.data);}catch{}
  window.addEventListener('storage',e=>{if(e.key===key&&e.newValue)try{receive(JSON.parse(e.newValue));}catch{}});
  function wake(){try{receive(JSON.parse(localStorage.getItem(key)||'null'));}catch{}schedule();void reconcile();}
  window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  document.addEventListener('focusout',()=>schedule());
  setInterval(()=>void reconcile(),60000);
  window.MINDEX_CONTENT_LIVE={publish,receive,reconcile};
})();
