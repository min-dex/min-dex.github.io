"""Offline common settings/reference realtime; no native windows or production writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context()
   context.add_init_script('window.open=()=>null;Element.prototype.requestFullscreen=async()=>{}')
   context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function('!!window.MINDEX_CONTENT_LIVE')
   page.evaluate("""()=>{
    state.config.url='shared-fixture';state.module='references';state.loading=false;state.saving=false;state.presenter.outputPendingAt=0;
    window.live=false;window.reads=0;window.writes=0;window.renders=0;window.sent=[];
    isPresenterOutputWindowOpen=()=>live;sundayEditSyncHasLocalDraft=()=>false;canUseClientData=()=>true;
    state.dirty={song:false,forms:false,scripture:false,service:false,references:false};state.selectedServiceId=null;
    window.linkDB=[{id:'link',title:'Old',url:'https://example.com/',sort_order:10,group_name:'Group',is_active:true}];
    window.typeDB=[{id:'children',display_name:'Old type',sort_order:10,config:{fixedItems:[]}}];
    state.referenceLinks=linkDB.map(normalizeReferenceLink);state.referenceLinksLoaded=true;state.referenceGroupSupported=true;
    state.serviceTypes=typeDB.map(normalizeWorshipServiceType);captureCleanFingerprint('references');
    state.client={channel:()=>({on(event,filter,fn){if(filter.event==='content-committed')window.receive=fn;return this},subscribe(fn){window.remoteStatus=fn;return this},send(m){sent.push(m);return Promise.resolve()}}),removeChannel:async()=>{},from(table){let patch=false;let start=0,end=999;
      const q={select(){return q},order(){return q},eq(){return q},range(a,b){start=a;end=b;return q},upsert(){patch=true;return q},update(){patch=true;return q},delete(){patch=true;return q},
      async then(resolve,reject){try{if(patch){writes++;return resolve(window.failWrite?{error:{message:'Rejected'}}:{data:structuredClone(table==='mindex_reference_links'?linkDB:typeDB)})}
        reads++;if(window.onRead){const fn=onRead;onRead=null;fn()};return resolve(window.failRead?{error:{message:'Offline'}}:{data:structuredClone((table==='mindex_reference_links'?linkDB:table==='mindex_worship_service_types'?typeDB:[]).slice(start,end+1))})}catch(e){reject(e)}}};return q;}};
    document.body.innerHTML='<div id="pane" style="height:200px;overflow:auto"><div style="height:2000px">original</div></div><input id="draft">';refs.detailPane=document.getElementById('pane');refs.detailPane.scrollTop=320;
    window.draw=()=>{renders++;refs.detailPane.innerHTML='<div style="height:2000px">updated</div>';refs.detailPane.scrollTop=0};renderReferencesDetail=draw;renderServiceTemplatesDetail=draw;renderServiceList=()=>{};render=()=>{};
    connectDepartmentRealtime();window.signal=(kind='references')=>receive({payload:{id:createUuid(),project:state.config.url,kind,recordId:'all'}});
   }""")
   page.evaluate("linkDB[0].title='New';linkDB[0].group_name='New group';signal()")
   page.wait_for_function("state.referenceLinks[0].title==='New'")
   assert page.evaluate("state.referenceLinks[0].group_name==='New group'&&refs.detailPane.scrollTop===320&&writes===0")
   n=page.evaluate('renders');page.evaluate('for(let i=0;i<20;i++)signal()');page.wait_for_timeout(400)
   assert page.evaluate('renders')==n
   page.evaluate("linkDB[0].title='Deferred';document.getElementById('draft').focus();signal()")
   page.wait_for_timeout(300);assert page.evaluate("state.referenceLinks[0].title==='New'")
   page.evaluate("document.activeElement.blur();state.dirty.references=true");page.wait_for_timeout(2100)
   assert page.evaluate("state.referenceLinks[0].title==='New'")
   page.evaluate('state.dirty.references=false');page.wait_for_function("state.referenceLinks[0].title==='Deferred'")
   page.evaluate("linkDB[0].title='Race';void(window.onRead=()=>{live=true});signal()")
   page.wait_for_function('live');assert page.evaluate("state.referenceLinks[0].title==='Deferred'")
   page.evaluate('live=false');page.wait_for_function("state.referenceLinks[0].title==='Race'")
   page.evaluate("state.editingReferenceId='link';linkDB=[];signal()")
   page.wait_for_timeout(300);assert page.evaluate('state.referenceLinks.length')==1
   page.evaluate('state.editingReferenceId=null');page.wait_for_function('state.referenceLinks.length===0')
   page.evaluate("failRead=true;signal()");page.wait_for_timeout(400);assert page.evaluate('state.referenceLinks.length')==0
   page.evaluate("failRead=false;state.module='service';state.selectedServiceTypeId=SERVICE_TEMPLATES_PANEL_ID;captureCleanFingerprint('service');typeDB[0].display_name='New type';signal('service-settings')")
   page.wait_for_function("state.serviceTypes[0].name==='New type'",timeout=20000)
   assert page.evaluate("!state.dirty.service&&dirtyModuleFingerprint('service')===state.cleanFingerprints.service&&refs.detailPane.scrollTop===320")
   page.evaluate("state.selectedServiceId='open';typeDB[0].display_name='Later';window.node=refs.detailPane.firstElementChild;signal('service-settings')")
   page.wait_for_timeout(300);assert page.evaluate("state.serviceTypes[0].name==='New type'&&refs.detailPane.firstElementChild===node")
   page.evaluate("state.selectedServiceId=null;captureCleanFingerprint('service')")
   page.wait_for_function("state.serviceTypes[0].name==='Later'")
   page.evaluate("typeDB[0].display_name='Recovery';remoteStatus('SUBSCRIBED')")
   page.wait_for_function("state.serviceTypes[0].name==='Recovery'")
   assert page.evaluate('writes')==0
   # Real save hooks notify only confirmed writes, including partial type batches.
   page.evaluate("async()=>{state.dirtyServiceTypeIds.add('children');await saveDirtyServiceTypes();window.failWrite=true;state.dirtyServiceTypeIds.add('children');await saveDirtyServiceTypes().catch(()=>{})}")
   assert page.evaluate("sent.filter(x=>x.payload?.kind==='service-settings').length") == 1
   page.evaluate("async()=>{failWrite=false;state.module='references';linkDB=[{id:'link',title:'Saved',url:'https://example.com/',sort_order:10}];state.referenceLinks=linkDB.map(normalizeReferenceLink);await saveReferenceLinks();failWrite=true;await saveReferenceLinks()}")
   assert page.evaluate("sent.filter(x=>x.payload?.kind==='references').length") == 1
   print('PASS',engine,'shared settings/references, groups, deletion, draft/focus/editor/playback/race guards, scroll, no-op, reconnect, failed read, confirmed writes only',flush=True)
   context.close();browser.close()
finally:server.shutdown()
