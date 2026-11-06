"""Opt-in read-only app latency probe. No env/credential files or output playback.

Uses normal browser HTTP cache, a local bookkeeping fixture and a fail-closed
allowlist of read-only RPCs. Writes only aggregate metrics and catalog hashes.
Never use a user's existing browser context. See worship-production-runbook.md.
"""
import argparse,collections,json,os,sys,time
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from smoke_app import sync_playwright,launch_chromium
from helpers.readonly_bookkeeping import ReadonlyBookkeeping
parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--engine',choices=['chromium','webkit'],default='chromium');parser.add_argument('--label',default='baseline');parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
OUT=args.output.resolve();OUT.mkdir(parents=True,exist_ok=True)
GUARD=r'''(() => {
 const bookkeeping=new Set(['mindex_state_read_v1','mindex_state_write_v1','mindex_monitor_register','mindex_monitor_ping','mindex_monitor_presence','mindex_remote_output']);
 const reads=new Set(['get_worship_service_v1','get_single_praise_records_v1','get_praise_snapshot_v1','get_single_praise_catalog_page_v1','get_praise_storage_status_v1','get_praise_catalog_index_v1','get_praise_catalog_records_v1']);
 window.loadingAudit={blocked:0,fixture:0,requests:[],errors:0};
 const native=window.fetch.bind(window);
 const allowed=(u,m)=>['GET','HEAD','OPTIONS'].includes(m)||(u.hostname.endsWith('.supabase.co')&&m==='POST'&&reads.has(u.pathname.split('/').pop()));
 window.fetch=async(input,init)=>{
  const request=new Request(input,init),u=new URL(request.url),name=u.pathname.split('/').pop(),method=request.method;
  if(u.hostname.endsWith('.supabase.co')&&method==='POST'&&bookkeeping.has(name)){
   loadingAudit.fixture++;const value=await window.__loadingBookkeeping(name,await request.clone().json());
   return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(!allowed(u,method)){loadingAudit.blocked++;return new Response('{"message":"Read-only probe"}',{status:403,headers:{'Content-Type':'application/json'}})}
  let requestedRecords=null;
  if(['get_single_praise_records_v1','get_praise_catalog_records_v1'].includes(name)&&method==='POST'){
   try{const ids=(await request.clone().json()).ids;if(Array.isArray(ids))requestedRecords=ids.length;}catch{}
  }
  const started=performance.now();
  try{const response=await native(input,init);const headersMs=performance.now();const copy=response.clone();void copy.arrayBuffer().then(body=>{let sqlstate=null;if(!response.ok&&u.hostname.endsWith('.supabase.co')){try{const code=JSON.parse(new TextDecoder().decode(body)).code;if(/^[A-Z0-9]{5}$/.test(code))sqlstate=code;}catch{}}loadingAudit.requests.push({name,method,startMs:started,headersMs,endMs:performance.now(),ms:performance.now()-started,bytes:body.byteLength,status:response.status,sqlstate,requestedRecords});});return response;}
  catch(e){loadingAudit.requests.push({name,method,ms:performance.now()-started,error:e.name});throw e;}
 };
 const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
 XMLHttpRequest.prototype.open=function(m,url,...rest){this.__loadingAllowed=allowed(new URL(url,location.href),String(m).toUpperCase());return open.call(this,m,url,...rest)};
 XMLHttpRequest.prototype.send=function(...a){if(!this.__loadingAllowed){loadingAudit.blocked++;throw new DOMException('Read-only','NotAllowedError')}return send.apply(this,a)};
 class LocalSocket extends EventTarget {static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;constructor(url){super();this.url=String(url);this.readyState=3;this.bufferedAmount=0;this.protocol='';this.extensions=''}send(){}close(){}};window.WebSocket=LocalSocket;
 navigator.sendBeacon=()=>false;window.open=()=>null;
 document.addEventListener('submit',e=>e.preventDefault(),true);
 HTMLMediaElement.prototype.play=function(){this.muted=true;return Promise.reject(new DOMException('Playback disabled during latency probe','NotAllowedError'))};
})();'''
def timed(page,label,fn):
 start=time.monotonic();value=fn();print(label,round(time.monotonic()-start,3),flush=True);return {'seconds':round(time.monotonic()-start,4),'result':value}
with sync_playwright() as p:
 browser=launch_chromium(p) if args.engine=='chromium' else p.webkit.launch()
 ctx=browser.new_context(viewport={'width':1440,'height':900},service_workers='block')
 book=ReadonlyBookkeeping();ctx.expose_binding('__loadingBookkeeping',lambda source,name,body:book.handle(name,body));ctx.add_init_script(GUARD)
 page=ctx.new_page();pageErrors=[];page.on('pageerror',lambda e:pageErrors.append(True))
 runs=[]
 try:
  for temperature in ['cold','warm']:
   print(args.engine,temperature,flush=True)
   result={'cache':temperature,'metrics':{}}
   def home():
    page.goto(args.url+'#preset=gwc&module=home',wait_until='domcontentloaded',timeout=60000)
    page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')",timeout=90000)
    result['shellReadyMs']=page.evaluate('performance.now()')
    try:
     page.wait_for_function("state.services.length>0&&!serviceDataLoadPromise&&homeOverviewStats?.songs!=null&&homeOverviewStats?.editions!=null&&!homeOverviewStats.promise&&state.calendarLoaded",timeout=120000)
    except Exception:
     print(page.evaluate("({module:state.module,type:state.selectedServiceTypeId,services:state.services.length,servicePending:!!serviceDataLoadPromise,serviceError:!!state.serviceError,stats:homeOverviewStats&&{songs:homeOverviewStats.songs,editions:homeOverviewStats.editions,errors:homeOverviewStats.errors,pending:!!homeOverviewStats.promise},calendarLoaded:state.calendarLoaded,calendarError:!!state.calendarError,blocked:loadingAudit.blocked,requests:loadingAudit.requests.filter(r=>r.status>=400||r.error)})"),flush=True)
     raise
    page.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
    result['homeReadyMs']=page.evaluate('performance.now()')
    return page.evaluate("({release:window.MINDEX_RELEASE,songs:state.songs.length,services:state.services.length,logicalSongs:homeOverviewStats?.songs,editions:homeOverviewStats?.editions,serviceError:!!state.serviceError,connectionError:!!state.connectionError})")
   result['metrics']['home']=timed(page,'home',home)
   def praise():
    page.evaluate("switchModule('praise')")
    page.wait_for_function("songCatalogLoaded&&!songLoadPromise&&state.songs.length>0",timeout=180000)
    return page.evaluate("({songs:state.songs.length,rows:document.querySelectorAll('[data-song-id]').length})")
   result['metrics']['praise']=timed(page,'praise',praise)
   result['canonicalBefore']=page.evaluate("async()=>{const data=JSON.stringify(state.singleSongCatalog.ids().map(id=>state.singleSongCatalog.get(id)));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data)))).map(x=>x.toString(16).padStart(2,'0')).join('')}")
   for query in ['은혜','예수','하나님']:
    result['metrics']['search-'+query]=timed(page,'search',lambda q=query:page.evaluate("async q=>{refs.searchInput.value=q;refs.searchInput.dispatchEvent(new Event('input',{bubbles:true}));while(state.searchCache.renderTimer)await new Promise(r=>setTimeout(r,15));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {queryApplied:state.search===q,rows:refs.songList.querySelectorAll('[data-global-song-id],[data-song-id]').length}}",q))
   result['metrics']['praise-reentry']=timed(page,'praise-reentry',lambda:page.evaluate("async()=>{await switchModule('home');await switchModule('praise');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return state.module==='praise'}"))
   sid=page.evaluate("state.services.find(s=>s.id==='99df9e1b-1716-41fb-9ea0-f5ca4c99ee45')?.id||state.services[0].id")
   result['metrics']['presenter']=timed(page,'presenter',lambda:page.evaluate("async sid=>{await openServiceInPresenter(sid);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const slides=buildServicePresenterSlides(sid);return {slides:slides.length,thumbs:document.querySelectorAll('.svc-slide-thumb').length,loaded:state.loadedWorshipServiceIds.has(sid)}}",sid))
   result['metrics']['output-preflight']=timed(page,'output-preflight',lambda:page.evaluate("async sid=>{const verified=await MindexPresenterFreshness.verify(sid);const slides=buildServicePresenterSlides(sid);return {verified,slides:slides.length,outputOpen:isPresenterOutputWindowOpen()}}",sid))
   result['metrics']['presenter-reentry']=timed(page,'presenter-reentry',lambda:page.evaluate("async sid=>{await switchModule('home');await openServiceInPresenter(sid);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return buildServicePresenterSlides(sid).length}",sid))
   result['canonicalAfter']=page.evaluate("async()=>{const data=JSON.stringify(state.singleSongCatalog.ids().map(id=>state.singleSongCatalog.get(id)));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data)))).map(x=>x.toString(16).padStart(2,'0')).join('')}")
   result['pageErrors']=len(pageErrors);pageErrors.clear()
   result['requests']=page.evaluate('loadingAudit.requests');result['blocked']=page.evaluate('loadingAudit.blocked');result['localBookkeepingCalls']=page.evaluate('loadingAudit.fixture')
   runs.append(result);(OUT/(args.label+'-'+args.engine+'.json')).write_text(json.dumps(runs,ensure_ascii=False,indent=2)+'\n')
   assert result['blocked']==0,'unexpected mutation attempted during probe'
   assert result['canonicalBefore']==result['canonicalAfter'],'canonical catalog changed during read-only UI'
   page.goto('about:blank')
  print('PASS',args.label,args.engine,flush=True)
 finally:ctx.close();browser.close()
