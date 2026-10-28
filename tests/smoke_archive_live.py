"""Detached archive refresh, no native output and no production network."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context();context.add_init_script('window.open=()=>null;Element.prototype.requestFullscreen=async()=>{throw Error("Disabled")};')
   context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function('!!window.MINDEX_ARCHIVE_LIVE')
   page.evaluate("""()=>{
    state.config.url='archive-fixture';state.module='setlists';state.loading=false;state.saving=false;state.presenter.outputPendingAt=0;
    window.live=false;window.reads=[];window.renders=0;window.writes=0;window.sent=[];
    isPresenterOutputWindowOpen=()=>live;canUseClientData=()=>true;sundayEditSyncHasLocalDraft=()=>false;
    state.dirty={song:false,forms:false,scripture:false,service:false,references:false};state.selectedServiceId=null;
    state.worshipSetlistSongCatalog={status:'loaded'};
    window.db={mindex_worship_services:[{id:'service',save_revision:'1',service_type_id:'children',service_date:'2026-10-18',title:'Live',praise_leader:'Leader'}],mindex_worship_sections:[{id:'section',service_id:'service',sort_order:10,title:'Praise'}],mindex_worship_elements:[{id:'element',section_id:'section',element_type:'praise',title:'Song',sort_order:10}],mindex_worship_import_sources:[{id:'import',updated_at:'1',service_date:'2025-10-18',leader:'Old leader'}],mindex_worship_import_candidates:[{id:'candidate',import_source_id:'import',updated_at:'1',candidate_level:'element',raw_title:'Old song',sort_order:10}]};
    state.worshipSetlistArchive={loaded:true,loading:false,error:'',sources:[],candidates:[],live:{services:[],sections:[],elements:[]}};
    state.client={channel:()=>({on(){return this},subscribe(){return this},send(m){sent.push(m);return Promise.resolve()}}),removeChannel:async()=>{},from(table){let fields='',filters=[],start=0,end=999;
      const q={select(value){fields=value;return q},order(){return q},eq(key,value){filters.push(row=>row[key]===value);return q},not(key,op,value){filters.push(row=>row[key]!==value);return q},in(key,values){filters.push(row=>values.includes(row[key]));return q},range(a,b){start=a;end=b;return q},
      async then(resolve,reject){try{reads.push({table,fields});if(window.onRead){const fn=onRead;onRead=null;fn()};if(window.failRead)return resolve({error:{message:'Offline'}});if(window.nullRead)return resolve({data:null});
        let records=(db[table]||[]).filter(row=>filters.every(fn=>fn(row))).slice(start,end+1);
        if(fields==='id,save_revision')records=records.map(({id,save_revision})=>({id,save_revision}));
        if(fields==='id,updated_at')records=records.map(({id,updated_at})=>({id,updated_at}));
        if(fields==='id,import_source_id,updated_at')records=records.map(({id,import_source_id,updated_at})=>({id,import_source_id,updated_at}));
        resolve({data:structuredClone(records)});}catch(e){reject(e)}}};return q;}};
    document.body.innerHTML='<div id="pane" style="height:200px;overflow:auto"><div style="height:2000px">archive</div></div><input id="draft">';refs.detailPane=document.getElementById('pane');refs.detailPane.scrollTop=320;
    renderSongList=()=>{};renderServiceSetlistArchiveDetail=()=>{renders++;refs.detailPane.innerHTML='<div style="height:2000px">archive updated</div>';refs.detailPane.scrollTop=0};
    window.signal=()=>MINDEX_CONTENT_LIVE.receive({id:createUuid(),project:state.config.url,kind:'setlist-archive',recordId:'all'});
   }""")
   assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh()') is True
   assert page.evaluate("state.worshipSetlistArchive.sources[0].leader==='Old leader'&&state.worshipSetlistArchive.live.elements[0].title==='Song'&&refs.detailPane.scrollTop===320")
   page.evaluate('reads=[];window.beforeRender=renders');assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh()') is True
   assert page.evaluate('reads.length===3&&renders===beforeRender'), 'Only revision scans when unchanged'
   page.evaluate("db.mindex_worship_services[0].save_revision='2';void(window.onRead=()=>{window.onRead=()=>{window.onRead=()=>{window.onRead=()=>{db.mindex_worship_services[0].save_revision='3'}}}})")
   assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh().catch(()=>false)') is False
   assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh()') is True
   page.evaluate("db.mindex_worship_import_sources[0].leader='New leader';db.mindex_worship_import_sources[0].updated_at='2';db.mindex_worship_import_candidates[0].raw_title='New song';db.mindex_worship_import_candidates[0].updated_at='2';MINDEX_CONTENT_LIVE.publish('setlist-archive','all')")
   page.wait_for_function("state.worshipSetlistArchive.sources[0].leader==='New leader'")
   assert page.evaluate("state.worshipSetlistArchive.candidates[0].raw_title==='New song'&&refs.detailPane.scrollTop===320")
   page.evaluate("document.getElementById('draft').focus();db.mindex_worship_services[0].save_revision='4';db.mindex_worship_elements[0].title='Deferred song';signal()")
   page.wait_for_timeout(300);assert page.evaluate("state.worshipSetlistArchive.live.elements[0].title==='Song'")
   page.evaluate("document.activeElement.blur();worshipSetlistLeaderDrafts.set('import',{value:'unsaved',original:'New leader'})")
   page.wait_for_timeout(2100);assert page.evaluate("state.worshipSetlistArchive.live.elements[0].title==='Song'")
   page.evaluate('worshipSetlistLeaderDrafts.clear()');page.wait_for_function("state.worshipSetlistArchive.live.elements[0].title==='Deferred song'")
   page.evaluate("db.mindex_worship_import_candidates=[];db.mindex_worship_services=[];db.mindex_worship_sections=[];db.mindex_worship_elements=[]")
   assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh()') is True
   assert page.evaluate('state.worshipSetlistArchive.candidates.length===0&&state.worshipSetlistArchive.live.services.length===0&&state.worshipSetlistArchive.live.elements.length===0')
   page.evaluate('failRead=true;db.mindex_worship_import_sources=[]');assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh().catch(()=>false)') is False
   assert page.evaluate('state.worshipSetlistArchive.sources.length')==1
   page.evaluate('failRead=false;nullRead=true');assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh().catch(()=>false)') is False
   assert page.evaluate('state.worshipSetlistArchive.sources.length')==1
   page.evaluate('nullRead=false;void(window.onRead=()=>{live=true})');assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh()') is False
   assert page.evaluate('state.worshipSetlistArchive.sources.length')==1
   page.evaluate('live=false;MINDEX_ARCHIVE_LIVE.reconcile()');page.wait_for_function('state.worshipSetlistArchive.sources.length===0')
   page.evaluate("db.mindex_worship_import_sources=Array.from({length:1002},(_,i)=>({id:'source-'+i,updated_at:'1',service_date:'2025-01-01',leader:'Paged'}))")
   assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh()') is True
   assert page.evaluate('state.worshipSetlistArchive.sources.length===1002&&writes===0')
   page.evaluate('reads=[];for(let i=0;i<100;i++)signal()');page.wait_for_timeout(500)
   assert page.evaluate('reads.length')==4, '100 signals coalesce; one paginated revision pass'
   page.evaluate("state.singleSongCatalog={};db.mindex_worship_services=[{id:'native',save_revision:'1',service_date:'2026-10-25',service_type_id:'children'}];db.mindex_worship_sections=[{id:'native-section',service_id:'native'}];db.mindex_worship_elements=[{id:'native-song',section_id:'native-section',element_type:'praise',title:'',song_id:null,praise_record_id:'SONG-CHLD-0001-0001'}];reads=[]")
   assert page.evaluate('MINDEX_ARCHIVE_LIVE.refresh()') is True
   assert page.evaluate("reads.some(r=>r.table==='mindex_worship_elements'&&r.fields.includes('praise_record_id'))")
   assert page.evaluate("MindexSetlistLinks.fromServices(state.worshipSetlistArchive.live).candidates[0].suggested_song_id==='SONG-CHLD-0001-0001'")
   print('PASS',engine,'archive live/import edits, revisions only/no-op, focus/draft/playback/race guards, deletions, failed/null reads, recovery, pagination, coalescing and zero writes',flush=True)
   context.close();browser.close()
finally:server.shutdown()
