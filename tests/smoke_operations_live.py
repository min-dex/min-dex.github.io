"""Read-only remote calendar and service membership updates; no native output/print."""
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
    page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function('!!window.MINDEX_SERVICE_LIST_LIVE')
    page.evaluate('''()=>{
      window.sid='dddddddd-dddd-4ddd-8ddd-dddddddddddd';window.other='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      state.config.url='operations-fixture';state.module='calendar';state.loading=false;state.saving=false;state.calendarLoaded=true;
      state.presenter.outputPendingAt=0;window.live=false;window.reads=0;window.renders=0;window.detailRenders=0;window.writes=0;
      isPresenterOutputWindowOpen=()=>live;canUseClientData=()=>true;hasDirtyChanges=()=>false;sundayEditSyncHasLocalDraft=()=>false;
      window.row={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date:'2026-10-25',...Object.fromEntries(CALENDAR_LIVE_FIELDS.map(k=>[k,'Old '+k]))};
      state.calendarData=[row];window.calendarDB=structuredClone(row);window.serviceDB=[{id:sid,service_type_id:'children',service_date:'2026-10-25',title:'Original'}];
      state.services=serviceDB.map(normalizeWorshipService);state.loadedWorshipServiceIds.add(sid);state.selectedServiceId=null;state.selectedServiceTypeId=SERVICE_LIST_PANEL_ID;
      state.client={channel:()=>({on(event,filter,fn){window.receivers??={};receivers[filter.event]=fn;return this},subscribe(fn){window.remoteStatus=fn;return this},send:remoteSend}),removeChannel:async()=>{},
        from(table){let fields='',ids=null,start=0,end=999,patch=null;
          const q={select(s){fields=s;return q},eq(){return q},in(k,value){if(k==='id')ids=value;return q},order(){return q},range(a,b){start=a;end=b;return q},update(value){patch=value;return q},
          async then(resolve,reject){try{reads++;if(window.onRead){const fn=onRead;onRead=null;await fn()};
            if(patch){writes++;if(window.failWrite)return resolve({error:{message:'Rejected'}});Object.assign(calendarDB,patch);return resolve({data:null});}
            if(window.failRead)return resolve({error:{message:'Offline'}});
            if(window.missingView&&table==='mindex_worship_services_list')return resolve({error:{code:'42P01',message:'Missing view'}});
            const data=table==='mindex_sunday_calendar'?[calendarDB]:table==='mindex_worship_services'&&fields==='id'?serviceDB.map(s=>({id:s.id})):serviceDB.filter(s=>!ids||ids.includes(s.id));
            resolve({data:structuredClone(data.slice(start,end+1))});}catch(e){reject(e)}}};return q;}};
      document.body.innerHTML='<div id="list" style="height:150px;overflow:auto"><div style="height:1000px">list</div></div><div id="pane" style="height:200px;overflow:auto"><table><tbody><tr>'+CALENDAR_LIVE_FIELDS.map(field=>'<td contenteditable="true" data-cal-id="'+row.id+'" data-cal-field="'+field+'">'+row[field]+'</td>').join('')+'</tr></tbody></table><div style="height:2000px"></div></div><button id="outside">Outside</button>';
      refs.detailPane=document.getElementById('pane');refs.songList=document.getElementById('list');refs.detailPane.scrollTop=200;refs.songList.scrollTop=100;
      renderServiceList=()=>{renders++;refs.songList.innerHTML='<div style="height:1000px">'+state.services.map(s=>s.title).join(',')+'</div>';refs.songList.scrollTop=0};
      renderServiceDetail=()=>{detailRenders++;refs.detailPane.innerHTML='<div style="height:2000px">'+state.services.map(s=>s.title).join(',')+'</div>';refs.detailPane.scrollTop=0};
      connectDepartmentRealtime();
    }''')
   a,b=pages
   def deliver(event):
    packet=next(x for x in reversed(messages) if x['event']==event)
    b.evaluate('m=>receivers[m.event]({payload:m.payload})',packet)
   def calendar_signal():
    a.evaluate('publishDepartmentTabChange(row,[],{calendarOnly:true})');a.wait_for_timeout(20);deliver('committed')
   def list_signal():
    a.evaluate("MINDEX_CONTENT_LIVE.publish('service-list','all')");a.wait_for_timeout(20);deliver('content-committed')
   b.evaluate("for(const key of CALENDAR_LIVE_FIELDS)calendarDB[key]='New '+key")
   calendar_signal();b.wait_for_function("row.note==='New note'")
   assert b.evaluate('!state.loadedWorshipServiceIds.has(sid)'), 'A concurrent linked-role change must still invalidate service caches'
   assert b.evaluate("CALENDAR_LIVE_FIELDS.every(k=>row[k]===calendarDB[k]&&document.querySelector('[data-cal-field='+k+']').textContent===calendarDB[k])&&refs.detailPane.scrollTop===200")
   b.evaluate("window.cell=document.querySelector('[data-cal-field=note]');cell.focus();cell.textContent='draft';calendarDB.note='Deferred'")
   calendar_signal();b.wait_for_timeout(300);assert b.evaluate("cell.textContent==='draft'&&row.note==='New note'")
   b.evaluate("cell.blur();cell.classList.add('is-save-error')");b.wait_for_timeout(2100);assert b.evaluate("cell.textContent==='draft'")
   b.evaluate("cell.classList.remove('is-save-error')");b.wait_for_function("row.note==='Deferred'")
   b.evaluate("calendarDB.church_schedule='';remoteStatus('SUBSCRIBED')");b.wait_for_function("row.church_schedule===''")
   # Real unlinked calendar write emits only on success.
   messages.clear();a.evaluate("async()=>{await saveCalendarCell(row.id,'note','Saved');failWrite=true;await saveCalendarCell(row.id,'note','Rejected')}")
   a.wait_for_timeout(30);assert len(messages)==1 and messages[0]['payload']['calendarOnly'] is True
   messages.clear()
   a.evaluate("async()=>{state.client.rpc=async(name,{req}={})=>{if(name.startsWith('mindex_monitor_'))return {data:null};if(window.rejectRPC)return {error:{code:'P0001',message:'Rejected'}};return {data:name==='delete_worship_service_v1'?{replayed:false,committedRevision:'2',currentRevision:'2',deleted:true,aggregate:null}:{replayed:false,committedRevision:'1',aggregate:{revision:'1',service:{id:req.serviceId,service_type_id:'children',service_date:'2026-10-25'},sections:[],elements:[]}}}};const atomic=await worshipAtomicClient();await atomic.create({service:{id:sid,service_type_id:'children',service_date:'2026-10-25'},rows:{sections:[],elements:[]},document:{sourceText:'Test'}});await atomic.remove(sid);window.rejectRPC=true;await atomic.create({service:{id:other,service_type_id:'children',service_date:'2026-11-01'},rows:{sections:[],elements:[]},document:{sourceText:'Rejected'}}).catch(()=>{})}")
   a.wait_for_timeout(50);assert len([m for m in messages if m['event']=='content-committed' and m['payload']['kind']=='service-list'])==2
   # Keep the same detail DOM while another service appears in the sidebar.
   b.evaluate("state.module='service';state.selectedServiceId=sid;refs.detailPane.scrollTop=200;window.originalPane=refs.detailPane.firstElementChild;serviceDB.push({id:other,service_type_id:'children',service_date:'2026-11-01',title:'Created'})")
   list_signal();b.wait_for_function('state.services.length===2')
   assert b.evaluate('refs.detailPane.firstElementChild===originalPane&&detailRenders===0&&state.selectedServiceId===sid&&refs.songList.scrollTop===100')
   b.evaluate('serviceDB=serviceDB.filter(s=>s.id!==other);live=true');list_signal();b.wait_for_timeout(300);assert b.evaluate('state.services.length')==2
   b.evaluate('live=false');b.wait_for_function('state.services.length===1')
   # Open deletion retains its editor. Leaving it permits safe list removal.
   b.evaluate('serviceDB=[]');list_signal();b.wait_for_timeout(2300);assert b.evaluate('state.services.length===1&&refs.detailPane.firstElementChild===originalPane')
   b.evaluate('state.selectedServiceId=null');b.wait_for_function('state.services.length===0')
   assert b.evaluate('detailRenders===1&&refs.detailPane.scrollTop===200')
   # Missed create notification recovered on reconnect; failed scans cannot delete rows.
   b.evaluate("serviceDB=[{id:sid,service_type_id:'children',service_date:'2026-10-25',title:'Recovered'}];remoteStatus('SUBSCRIBED')")
   b.wait_for_function('state.services.length===1')
   b.evaluate('failRead=true;serviceDB=[]');list_signal();b.wait_for_timeout(400);assert b.evaluate('state.services.length')==1
   b.evaluate('failRead=false;serviceDB=[{id:sid,service_type_id:"children",service_date:"2026-10-25",title:"Recovered"}];serviceDB.push({id:other,service_type_id:"children",service_date:"2026-11-01",title:"Race"});void(window.onRead=()=>{live=true})')
   # Direct invocation checks the after-await guard independent of retry backoff.
   b.evaluate('MINDEX_SERVICE_LIST_LIVE.refresh()');assert b.evaluate('state.services.length===1')
   b.evaluate('live=false');assert b.evaluate('writes')==0
   # Full pagination plus missing-view fallback cannot truncate the membership scan.
   b.evaluate("serviceDB=Array.from({length:1002},(_,i)=>({id:i===1001?sid:'fixture-'+i,service_type_id:'children',service_date:'2026-10-25',title:'Page '+i}));window.missingView=true")
   assert b.evaluate('MINDEX_SERVICE_LIST_LIVE.refresh()') is True
   assert b.evaluate('state.services.length===1002&&state.services.some(s=>s.id===sid)&&writes===0')
   print('PASS',engine,'all calendar fields/clear, focus/failed-cell protection, confirmed save signal, create/delete lists, retained editor/scroll, playback, reconnect, failed read and receiver read-only',flush=True)
   for context in contexts:context.close()
   browser.close()
finally:server.shutdown()
