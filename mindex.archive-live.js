// Detached archive cards; revision scans never fetch lyrics, media or source documents.
(() => {
  if(isPresenterOutputRoute())return;
  let busy=false,edit=0,marks=null,markClient=null,markProject='',markArchive=null;
  for(const event of ['input','change','pointerdown','keydown'])document.addEventListener(event,()=>edit++,true);
  const context=()=>JSON.stringify([state.module,state.selectedServiceId,state.selectedServiceTypeId,state.worshipSetlistArchiveView,state.worshipSetlistArchiveMonth,state.search]);
  function blocked(){
    return !isSetlistArchiveView()||departmentRefreshBlocked()||hasDirtyChanges()||worshipSetlistLeaderDrafts.size
      ||!state.worshipSetlistArchive.loaded||state.worshipSetlistArchive.loading||state.worshipSetlistSongCatalog.status==='loading';
  }
  async function rows(client,table,select,filter=q=>q){
    const result=await fetchAllRows(()=>({async range(from,to){
      const response=await filter(client.from(table).select(select)).order('id').range(from,to);
      if(!response?.error&&!Array.isArray(response?.data))throw Error('Incomplete archive page');
      return response;
    }}));
    if(result.error)throw result.error;return result.data;
  }
  async function batches(client,table,select,column,ids,filter=q=>q){
    const all=[];
    for(let i=0;i<ids.length;i+=80)all.push(...await rows(client,table,select,q=>filter(q.in(column,ids.slice(i,i+80)))));
    return all;
  }
  const index=rows=>new Map(rows.map(row=>[row.id,JSON.stringify(row)]));
  const changed=(current,previous)=>current.filter(row=>previous?.get(row.id)!==JSON.stringify(row)).map(row=>row.id);
  const sorted=value=>[...value].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  async function refresh(){
    if(busy||blocked())return false;
    busy=true;
    const client=state.client,project=state.config.url,revision=edit,before=state.worshipSetlistArchive,beforeContext=context();
    const stale=()=>client!==state.client||project!==state.config.url||revision!==edit||before!==state.worshipSetlistArchive||beforeContext!==context()||blocked();
    try{
      // Three narrow scans recover missed edits/deletions without reloading all card payloads.
      const serviceMarks=await rows(client,'mindex_worship_services','id,save_revision');
      const sourceMarks=await rows(client,'mindex_worship_import_sources','id,updated_at',q=>q.not('service_date','is',null));
      const candidateMarks=await rows(client,'mindex_worship_import_candidates','id,import_source_id,updated_at',q=>q.eq('candidate_level','element'));
      if(stale())return false;
      const previous=markClient===client&&markProject===project&&markArchive===before?marks:null;
      const serviceIds=new Set(serviceMarks.map(row=>row.id)),sourceIds=new Set(sourceMarks.map(row=>row.id));
      const changedServices=changed(serviceMarks,previous?.services);
      const changedSources=new Set(changed(sourceMarks,previous?.sources));
      const candidateIndex=index(candidateMarks);
      for(const row of candidateMarks)if(previous?.candidates.get(row.id)!==JSON.stringify(row))changedSources.add(row.import_source_id);
      if(previous)for(const [id,value] of previous.candidates)if(!candidateIndex.has(id))changedSources.add(JSON.parse(value).import_source_id);
      const sourceBatch=[...changedSources].filter(id=>sourceIds.has(id));
      const services=await batches(client,'mindex_worship_services','id,service_type_id,service_date,title,service_alias,status,praise_leader,worship_leader,no_gathering:source_ref->no_gathering','id',changedServices);
      const sections=await batches(client,'mindex_worship_sections','id,service_id,sort_order,section_key,title','service_id',changedServices);
      const elements=await batches(client,'mindex_worship_elements','id,section_id,sort_order,element_type,title,song_id,label:source_ref->>label,template_suppressed:config->templateSuppressed,legacy_template_suppressed:config->template_suppressed,connectedPraise:config->connectedPraise,connected_praise:config->connected_praise,source_connectedPraise:source_ref->connectedPraise,source_connected_praise:source_ref->connected_praise','section_id',sections.map(row=>row.id),q=>q.eq('element_type','praise'));
      const sources=await batches(client,'mindex_worship_import_sources',WORSHIP_IMPORT_SOURCE_LIST_SELECT,'id',sourceBatch);
      const candidates=await batches(client,'mindex_worship_import_candidates',WORSHIP_IMPORT_CANDIDATE_LIST_SELECT,'import_source_id',sourceBatch,q=>q.eq('candidate_level','element'));
      // Reject mixed snapshots if a save commits between the metadata and card reads.
      const same=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
      if(changedServices.length){
        const checked=await batches(client,'mindex_worship_services','id,save_revision','id',changedServices);
        if(!same(checked,serviceMarks.filter(row=>changedServices.includes(row.id))))throw Error('Archive service changed during read');
      }
      if(sourceBatch.length){
        const checkedSources=await batches(client,'mindex_worship_import_sources','id,updated_at','id',sourceBatch);
        const checkedCandidates=await batches(client,'mindex_worship_import_candidates','id,import_source_id,updated_at','import_source_id',sourceBatch,q=>q.eq('candidate_level','element'));
        if(!same(checkedSources,sourceMarks.filter(row=>changedSources.has(row.id)))
          ||!same(checkedCandidates,candidateMarks.filter(row=>changedSources.has(row.import_source_id))))throw Error('Archive import changed during read');
      }
      if(stale())return false;
      if(services.length!==changedServices.length||sources.length!==sourceBatch.length)throw Error('Archive membership changed during read');
      const touched=new Set(changedServices),old=before.live||{services:[],sections:[],elements:[]};
      const keptSections=old.sections.filter(row=>serviceIds.has(row.service_id)&&!touched.has(row.service_id));
      const keptSectionIds=new Set(keptSections.map(row=>row.id));
      const next={
        sources:sorted([...before.sources.filter(row=>sourceIds.has(row.id)&&!changedSources.has(row.id)),...sources]),
        candidates:sorted([...before.candidates.filter(row=>sourceIds.has(row.import_source_id)&&!changedSources.has(row.import_source_id)),...candidates]),
        live:{services:sorted([...old.services.filter(row=>serviceIds.has(row.id)&&!touched.has(row.id)),...services]),sections:sorted([...keptSections,...sections]),elements:sorted([...old.elements.filter(row=>keptSectionIds.has(row.section_id)),...elements])},
        loaded:true,loading:false,error:''
      };
      const comparable=archive=>JSON.stringify({sources:sorted(archive.sources),candidates:sorted(archive.candidates),live:Object.fromEntries(['services','sections','elements'].map(key=>[key,sorted(archive.live?.[key]||[])]))});
      if(before.error||comparable(before)!==comparable(next)){
        const viewport=captureDetailViewportSnapshot(),top=refs.songList?.scrollTop;
        state.worshipSetlistArchive=next;
        renderSongList();renderServiceSetlistArchiveDetail();restoreDetailViewportSnapshot(viewport);
        if(refs.songList&&top!=null)refs.songList.scrollTop=top;
      }
      marks={services:index(serviceMarks),sources:index(sourceMarks),candidates:candidateIndex};
      markClient=client;markProject=project;markArchive=state.worshipSetlistArchive;
      return true;
    }finally{busy=false;}
  }
  function reconcile(){if(!blocked())window.MINDEX_CONTENT_LIVE?.receive({id:createUuid(),project:state.config.url,kind:'setlist-archive',recordId:'all'});}
  window.MINDEX_ARCHIVE_LIVE={refresh,reconcile};
})();
