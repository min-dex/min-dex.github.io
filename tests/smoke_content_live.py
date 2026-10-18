"""Offline separate-profile realtime: catalog adoption and bulletin draft/print protection."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   contexts=[browser.new_context() for _ in range(2)];pages=[];messages=[]
   for context in contexts:
    context.add_init_script('window.open=()=>null;Element.prototype.requestFullscreen=async()=>{}')
    context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page=context.new_page();pages.append(page);page.expose_function('remoteSend',lambda message:messages.append(message))
    page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function('!!window.MINDEX_CONTENT_LIVE')
    page.evaluate('''()=>{
      window.sid='dddddddd-dddd-4ddd-8ddd-dddddddddddd';window.vid='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      state.config.url='content-fixture';state.module='praise';state.loading=false;state.saving=false;
      state.presenter.outputPendingAt=0;window.live=false;window.reads=0;window.renders=0;
      isPresenterOutputWindowOpen=()=>live;sundayEditSyncHasLocalDraft=()=>false;canUseClientData=()=>true;
      window.db={song:{id:sid,title:'Original',memo:null},versions:[{id:vid,source_song_id:sid,version_label:'Original version'}],units:[]};
      state.songVersionTablesSupported=true;state.songRelationsSupported=false;
      state.client={channel:()=>({on(event,filter,fn){if(filter.event==='content-committed')window.remoteReceive=fn;return this},subscribe(fn){window.remoteStatus=fn;return this},send:remoteSend}),removeChannel:async()=>{},
        from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},range(){return q},maybeSingle(){return q},
          then(resolve,reject){reads++;if(window.onRead){const fn=onRead;onRead=null;fn()};return Promise.resolve({data:structuredClone(table==='mindex_songs'?db.song:table==='mindex_song_versions'?db.versions:db.units)}).then(resolve,reject)}};return q}};
      state.songs=[normalizeServerSong(db.song)];attachRelationalSongVersionRows(db.versions,[],[sid],state.songs);
      state.selectedSongId=sid;state.selectedVersionId=vid;state.forms=[];state.dirty.song=false;state.dirty.forms=false;captureCleanFingerprint('praise');
      document.body.innerHTML='<div id="pane" style="height:200px;overflow:auto"><div style="height:2000px">editor</div></div><textarea id="draft"></textarea><button id="outside">Outside</button>';
      refs.detailPane=document.getElementById('pane');refs.detailPane.scrollTop=320;
      render=()=>{renders++;refs.detailPane.innerHTML='<div style="height:2000px">'+state.songs[0].title+'</div>';refs.detailPane.scrollTop=0};renderSongList=()=>{};
      connectDepartmentRealtime();
    }''')
   a,b=pages
   def signal(kind='song',record=None):
    a.evaluate('([kind,id])=>MINDEX_CONTENT_LIVE.publish(kind,id||sid)',[kind,record]);a.wait_for_timeout(20)
    packet=messages.pop();assert packet['event']=='content-committed'
    assert set(packet['payload'])=={'id','project','kind','recordId'}
    b.evaluate('(payload)=>remoteReceive({payload})',packet['payload'])
   b.evaluate("db.song.title='Saved';db.versions[0].version_label='New version';db.units=[{id:'unit',version_id:vid,lyrics:'New lyrics',unit_order:1}]")
   signal();b.wait_for_function("state.songs[0].title==='Saved'")
   assert b.evaluate("state.selectedVersionId===vid&&refs.detailPane.scrollTop===320&&JSON.stringify(state.forms).includes('New lyrics')")
   count=b.evaluate('renders');signal();b.wait_for_timeout(300);assert b.evaluate('renders')==count
   b.evaluate("db.song.title='Deferred';document.getElementById('draft').focus();document.getElementById('draft').value='typing'")
   signal();b.wait_for_timeout(300);assert b.evaluate("state.songs[0].title==='Saved'")
   b.evaluate("document.activeElement.blur();state.dirty.song=true")
   b.wait_for_timeout(2100);assert b.evaluate("state.songs[0].title==='Saved'")
   b.evaluate('state.dirty.song=false');b.wait_for_function("state.songs[0].title==='Deferred'")
   b.evaluate("db.song.title='Race';void(window.onRead=()=>{state.serviceMusic.playing=true})")
   signal();b.wait_for_function('state.serviceMusic.playing');assert b.evaluate("state.songs[0].title==='Deferred'")
   b.wait_for_timeout(150);b.evaluate('state.serviceMusic.playing=false');b.wait_for_function("state.songs[0].title==='Race'")
   b.evaluate("db.song.title='Recovered';remoteStatus('SUBSCRIBED')");b.wait_for_function("state.songs[0].title==='Recovered'")
   # The real workbench uses detached snapshots, preserving drafts, source snapshot and scroll.
   b.evaluate('''async()=>{
      state.module='bulletin';const B=MindexBulletin;
      window.source=B.resolveSource({service:{id:'bulletin',service_type_id:'children',service_date:'2026-10-04'},sections:[{id:'section',section_key:'sermon',title:'설교',sort_order:1}],elements:[{id:'element',section_id:'section',element_type:'title_person',title:'설교 제목',person:'교사'}]});
      window.docMap=new Map();window.row={revision:1,...B.storedValue({...B.normalizeSnapshot({fields:{news:'Original bulletin'},settings:{design:'simple'}}),source})};
      refs.detailPane.innerHTML='<div data-bulletin-owner="bulletin" style="height:600px"></div>';window.host=refs.detailPane.firstElementChild;
      window.workbench=host.bulletinController=B.mount(host,{documents:docMap,serviceId:'bulletin',scope:'fixture',services:[{id:'bulletin',label:'Bulletin'}],remoteBlocked:()=>departmentRefreshBlocked(),loadDraft:async()=>{if(window.onDraft){const fn=onDraft;onDraft=null;fn()}return structuredClone(row)},loadSource:async()=>structuredClone(source),saveDraft:async()=>{throw Error('Unexpected receiver write')}});
   }''')
   b.wait_for_function("document.querySelector('[data-bulletin-save]')?.disabled&&docMap.size===1")
   b.evaluate("row.revision=2;row.content.fields.news='Remote bulletin';document.querySelector('.bulletin-canvas').scrollTop=100;window.beforeScroll=document.querySelector('.bulletin-canvas').scrollTop")
   signal('bulletin','bulletin');b.wait_for_function("docMap.values().next().value.revision===2")
   assert b.evaluate("docMap.values().next().value.fields.news==='Remote bulletin'&&document.querySelector('.bulletin-canvas').scrollTop===beforeScroll")
   b.evaluate("docMap.values().next().value.dirty=true;row.revision=3;row.content.fields.news='Later'")
   signal('bulletin','bulletin');b.wait_for_timeout(350);assert b.evaluate("docMap.values().next().value.revision===2")
   b.evaluate("docMap.values().next().value.dirty=false;void(window.onDraft=()=>document.querySelector('[data-bulletin-field=\"news\"]').dispatchEvent(new Event('input',{bubbles:true})))")
   b.wait_for_timeout(2200);assert b.evaluate("docMap.values().next().value.revision===2")
   b.evaluate("docMap.values().next().value.dirty=false;document.activeElement.blur()");b.wait_for_function("docMap.values().next().value.revision===3")
   # Stub only the native print call; exercise the real print preparation and afterprint lock.
   b.evaluate("document.addEventListener('load',e=>{if(e.target instanceof HTMLIFrameElement)e.target.contentWindow.print=()=>{window.printCalled=true}},{capture:true});void 0")
   b.click('[data-bulletin-print]');b.wait_for_function('window.printCalled===true')
   b.evaluate("row.revision=4;row.content.fields.news='After print'");signal('bulletin','bulletin')
   b.wait_for_timeout(2200);assert b.evaluate("docMap.values().next().value.revision===3")
   b.evaluate("document.querySelector('.bulletin-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))")
   b.wait_for_function("docMap.values().next().value.revision===4")
   # Template changes refresh only the template editor, keeping the saved weekly document intact.
   b.evaluate("()=>{workbench.destroy();source.department='young-adult';source.date='2026-11-01';const B=MindexBulletin;window.templateRow={template_key:B.TEMPLATE_KEY,...B.templateValue(docMap.values().next().value),revision:1};templateRow.common.welcome='Original common';workbench=host.bulletinController=B.mount(host,{documents:docMap,serviceId:'bulletin',scope:'fixture',services:[{id:'bulletin',label:'Bulletin'}],remoteBlocked:()=>departmentRefreshBlocked(),loadDraft:async()=>row,loadSource:async()=>structuredClone(source),loadTemplate:async()=>structuredClone(templateRow),saveTemplate:async()=>{throw Error('Unexpected template write')}})}")
   b.wait_for_function("!document.querySelector('[data-bulletin-template-edit]').disabled")
   b.click('[data-bulletin-template-edit]');b.wait_for_function("workbench.remoteIdentity().kind==='bulletin-template'")
   b.evaluate("templateRow.revision=2;templateRow.common.welcome='Remote common'")
   signal('bulletin-template',b.evaluate('MindexBulletin.TEMPLATE_KEY'))
   b.wait_for_function("document.querySelector('.bulletin-canvas').textContent.includes('Remote common')")
   b.click('[data-bulletin-template-exit]')
   assert b.evaluate("docMap.values().next().value.fields.news==='After print'&&docMap.values().next().value.revision===4")
   # Successful saves notify; rejected CAS saves never notify.
   messages.clear()
   a.evaluate("async()=>{const original=state.client;state.client={...original,from(){const q={update(){return q},eq(){return q},select(){return q},maybeSingle:async()=>window.rejectSave?{data:null}:{data:{revision:2}}};return q}};await saveBulletinDraft('bulletin',{},1);window.rejectSave=true;await saveBulletinDraft('bulletin',{},1).catch(()=>{});state.client=original;connectDepartmentRealtime()}")
   a.wait_for_timeout(50);assert len(messages)==1 and messages[0]['payload']['kind']=='bulletin'
   messages.clear()
   a.evaluate("async()=>{saveSongMeta=async()=>{if(window.rejectSong)throw Error('Rejected')};state.dirty.song=true;await saveAll();window.rejectSong=true;state.dirty.song=true;await saveAll()}")
   a.wait_for_timeout(50);assert len(messages)==1 and messages[0]['payload']['kind']=='song'
   assert not b.evaluate("state.dirty.song||state.dirty.forms")
   print('PASS',engine,'catalog versions/lyrics, isolated transport, no-op, selection/scroll, focused/dirty/media guards, read race, reconnect, bulletin draft/race/scroll/print, confirmed save signals, receiver read-only',flush=True)
   for context in contexts:context.close()
   browser.close()
finally:server.shutdown()
