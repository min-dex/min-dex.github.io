"""Separate profiles, confirmed RPC signal, real aggregate adoption and safe deferral."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from smoke_app import prepare_server_state_fixture
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
    page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function('!!window.MINDEX_WORSHIP_LIVE')
    prepare_server_state_fixture(page)
    page.evaluate('''async()=>{
      window.sid='dddddddd-dddd-4ddd-8ddd-dddddddddddd';window.sec='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      window.eid='ffffffff-ffff-4fff-8fff-ffffffffffff';window.other='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      state.config.url='worship-live-fixture';state.module='service';state.selectedServiceId=sid;state.loading=false;state.saving=false;
      state.presenter.outputPendingAt=0;window.live=false;window.dirty=false;window.failSave=false;window.reads=0;window.renders=0;window.notices=0;
      isPresenterOutputWindowOpen=()=>live;hasDirtyChanges=()=>dirty;sundayEditSyncHasLocalDraft=()=>dirty;
      showToast=()=>notices++;captureCleanFingerprint=()=>{};
      window.db={revision:'1',service:{id:sid,title:'Original',service_type_id:'test',service_date:'2026-10-18'},
        sections:[{id:sec,service_id:sid,title:'Praise',section_key:'praise',sort_order:1}],
        elements:[{id:eid,section_id:sec,element_type:'praise',sort_order:1,config:{manualLyrics:'Original lyrics',formHint:'V2-C-V1-C',audioTiming:{starts:[1,3]}},asset:{url:'https://example.invalid/clip.mp3'},source_ref:{label:'찬양'}},
          {id:other,section_id:sec,element_type:'plain_text',sort_order:2,config:{},source_ref:{label:'광고'}}]};
      state.client={channel:()=>({on(event,filter,fn){if(filter.event==='worship-committed')window.remoteReceive=fn;return this},subscribe(fn){window.remoteStatus=fn;return this},send:remoteSend}),removeChannel:async()=>{},
        from:()=>({select:()=>({eq:async()=>({data:db?[{id:sid,save_revision:db.revision}]:[]})})}),
        rpc:async(name,{req}={})=>{if(name==='get_worship_service_v1'){reads++;if(window.onRead)onRead();return {data:structuredClone(db)}};
          if(name.startsWith('mindex_monitor_'))return {data:null};
          if(name!=='save_worship_service_v1')throw Error('Unexpected RPC');
          if(failSave)return {error:{code:'P0001',message:'fixture rejected'}};
          db.revision=String(Number(db.revision)+1);db.service.title=req.metadataPatch.title;
          return {data:{replayed:false,committedRevision:db.revision,aggregate:structuredClone(db)}};}};
      state.services=[normalizeWorshipService(db.service)];state.serviceTypes=[];
      state.worshipSections=structuredClone(db.sections);state.worshipElements=structuredClone(db.elements);
      state.serviceItems=groupWorshipElements(db.sections,db.elements);state.selectedServiceItemIndex=0;
      state.loadedWorshipServiceIds.add(sid);
      document.body.innerHTML='<div id="pane" style="height:200px;overflow:auto"><div style="height:2000px">editor</div></div><textarea id="draft"></textarea><button id="outside">Outside</button>';
      refs.detailPane=document.getElementById('pane');refs.detailPane.scrollTop=320;
      render=()=>{renders++;refs.detailPane.innerHTML='<div style="height:2000px">'+state.services[0].title+'</div>';refs.detailPane.scrollTop=0};
      connectDepartmentRealtime();window.atomic=await worshipAtomicClient();await atomic.read(sid);
    }''')
   a,b=pages
   def signal():
    a.evaluate('MINDEX_WORSHIP_LIVE.publish(sid)');a.wait_for_timeout(20)
    packet=messages.pop();assert packet['event']=='worship-committed'
    assert set(packet['payload'])=={'id','project','serviceId'}
    b.evaluate('(payload)=>remoteReceive({payload})',packet['payload'])
   # Actual wrapped atomic commit publishes only after success.
   b.evaluate("db.revision='2';db.service.title='Saved';db.elements[0].config.manualLyrics='New lyrics';db.elements[0].sort_order=3;db.elements.reverse()")
   a.evaluate("atomic.commit({serviceId:sid,rows:{sections:[],elements:[]},metadata:{title:'Saved'},document:{sourceText:'Saved'}})")
   a.wait_for_timeout(20);packet=next(m for m in messages if m['event']=='worship-committed');b.evaluate('(payload)=>remoteReceive({payload})',packet['payload'])
   assert {m['payload']['kind'] for m in messages if m['event']=='content-committed'}=={'service-list','setlist-archive'}
   messages.clear()
   b.wait_for_function("state.services[0].title==='Saved'")
   assert b.evaluate("atomic.baseline(sid).revision==='2'&&getServiceItems(sid)[state.selectedServiceItemIndex].id===eid&&refs.detailPane.scrollTop===320")
   assert b.evaluate("state.worshipElements.find(e=>e.id===eid).config.manualLyrics==='New lyrics'&&state.worshipElements.find(e=>e.id===eid).config.formHint==='V2-C-V1-C'&&state.worshipElements.find(e=>e.id===eid).asset.url.endsWith('clip.mp3')")
   count=b.evaluate('renders');signal();b.wait_for_timeout(350);assert b.evaluate('renders')==count
   # Focus/draft protection retains both DOM text and committed baseline.
   b.evaluate("db.revision='3';db.service.title='Deferred';document.getElementById('draft').focus();document.getElementById('draft').value='unsaved'")
   signal();b.wait_for_timeout(300);assert b.evaluate("atomic.baseline(sid).revision==='2'&&document.getElementById('draft').value==='unsaved'")
   b.evaluate("dirty=true;document.getElementById('draft').blur();document.getElementById('outside').focus()")
   b.wait_for_timeout(2200);assert b.evaluate("state.services[0].title==='Saved'")
   b.evaluate('dirty=false');b.wait_for_function("state.services[0].title==='Deferred'")
   # Missed signal recovered by cheap revision check; unchanged revision does no aggregate read.
   count=b.evaluate('reads');b.evaluate('MINDEX_WORSHIP_LIVE.reconcile()');assert b.evaluate('reads')==count
   b.evaluate("db.revision='4';db.service.title='Recovered';remoteStatus('SUBSCRIBED')")
   b.wait_for_function("state.services[0].title==='Recovered'")
   # Mid-read playback must not adopt model/revision; eventually resumes.
   b.evaluate("db.revision='5';db.service.title='After media';window.onRead=()=>{state.serviceMusic.playing=true;window.onRead=null}")
   signal();b.wait_for_timeout(400);assert b.evaluate("atomic.baseline(sid).revision==='4'&&state.services[0].title==='Recovered'")
   b.evaluate('state.serviceMusic.playing=false');b.wait_for_function("state.services[0].title==='After media'")
   # Dialog and output also defer automatic re-render.
   b.evaluate("db.revision='6';db.service.title='After dialog';window.modal=document.createElement('dialog');document.body.append(modal);modal.showModal()")
   signal();b.wait_for_timeout(300);assert b.evaluate("state.services[0].title==='After media'")
   b.evaluate('modal.close();modal.remove();live=true');b.wait_for_timeout(2200);assert b.evaluate("state.services[0].title==='After media'")
   b.evaluate('live=false');b.wait_for_function("state.services[0].title==='After dialog'")
   # Failed save never emits a notification.
   messages.clear();a.evaluate("failSave=true;atomic.commit({serviceId:sid,rows:{sections:[],elements:[]},metadata:{title:'Rejected'},document:{sourceText:'Rejected'}}).catch(()=>{})")
   a.wait_for_timeout(100);assert not messages
   # Remote deletion keeps the visible document/selection and warns once.
   b.evaluate('db=null');signal();b.wait_for_function('notices===1');signal();b.wait_for_timeout(350)
   assert b.evaluate("notices===1&&state.services[0].title==='After dialog'")
   print('PASS',engine,'isolated profiles, committed save signal, atomic lyrics/order/media, ID selection/scroll, dedupe, drafts/dialog/output/playback, recovery, failed save, deletion retention',flush=True)
   for context in contexts:context.close()
   browser.close()
finally:server.shutdown()
