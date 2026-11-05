"""Opt-in read-only home entry probe. Temporary browser profiles are destroyed.

Measures an empty profile, a reopened validated snapshot, an HTTP-cache-only
restart, and another snapshot restart. Never records catalog bodies or keys.
"""
import argparse,ast,json,os,sys,tempfile,time
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from smoke_app import sync_playwright,LOCAL_CHROME_PATH
from helpers.readonly_bookkeeping import ReadonlyBookkeeping
parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--engine',choices=['chromium','webkit'],default='chromium');parser.add_argument('--label',required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--profile-phases',action='store_true');parser.add_argument('--include-invalidated',action='store_true');args=parser.parse_args()
source=ast.parse((ROOT/'tools/measure_app_loading.py').read_text())
guard=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='GUARD' for t in n.targets))
guard+=''';(()=>{
 if(typeof AudioBufferSourceNode!=='undefined')AudioBufferSourceNode.prototype.start=function(){loadingAudit.blocked++;throw new DOMException('Read-only probe','NotAllowedError')};
 for(const key of ['requestFullscreen','webkitRequestFullscreen','webkitRequestFullScreen'])Object.defineProperty(Element.prototype,key,{configurable:true,value:()=>Promise.reject(new DOMException('Background probe','NotAllowedError'))});
})();'''
if args.profile_phases:
 guard+=r""";(()=>{
  window.entryPhases={sync:{},longTasks:[]};
  const record=(name,ms)=>{const v=entryPhases.sync[name]||(entryPhases.sync[name]={calls:0,totalMs:0,maxMs:0});v.calls++;v.totalMs+=ms;v.maxMs=Math.max(v.maxMs,ms)};
  for(const [object,key,label] of [[JSON,'parse','JSON.parse'],[window,'structuredClone','structuredClone']]){const original=object[key];object[key]=function(...args){const s=performance.now();try{return Reflect.apply(original,this,args)}finally{record(label,performance.now()-s)}};}
  let singleSong;Object.defineProperty(window,'MindexSingleSong',{configurable:true,get:()=>singleSong,set:api=>{singleSong=Object.freeze({...api,...Object.fromEntries(['createCatalog','groupSongs'].map(key=>[key,function(...args){const s=performance.now();try{return Reflect.apply(api[key],this,args)}finally{record(key,performance.now()-s)}}]))})}});
  if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('longtask'))new PerformanceObserver(list=>{for(const e of list.getEntries())entryPhases.longTasks.push({startMs:e.startTime,durationMs:e.duration})}).observe({type:'longtask',buffered:true});
 })();"""
args.output.mkdir(parents=True,exist_ok=True)
results=[];book=ReadonlyBookkeeping()
def launch(p,profile):
 options=dict(headless=True,viewport={'width':1440,'height':900},service_workers='block')
 if args.engine=='webkit':return p.webkit.launch_persistent_context(str(profile),**options)
 try:return p.chromium.launch_persistent_context(str(profile),args=['--mute-audio'],**options)
 except Exception:
  if not LOCAL_CHROME_PATH.exists():raise
  return p.chromium.launch_persistent_context(str(profile),executable_path=str(LOCAL_CHROME_PATH),args=['--mute-audio'],**options)
with tempfile.TemporaryDirectory(prefix='mindex-entry-profile-',dir='/private/tmp') as folder,sync_playwright() as p:
 for phase in ['empty-profile','reopened-snapshot','http-cache-only','reopened-repeat']+(['invalidated-signature'] if args.include_invalidated else []):
  print(args.engine,phase,flush=True)
  context=launch(p,Path(folder));context.expose_binding('__loadingBookkeeping',lambda source,name,body:book.handle(name,body));context.add_init_script(guard)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(True))
  try:
   page.goto(args.url+'#preset=gwc&module=home',wait_until='domcontentloaded',timeout=60000)
   page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')",timeout=90000)
   shell=page.evaluate('performance.now()')
   page.wait_for_function("state.services.length>0&&!serviceDataLoadPromise&&homeOverviewStats?.songs!=null&&homeOverviewStats?.editions!=null&&!homeOverviewStats.promise&&state.calendarLoaded",timeout=120000)
   page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
   ready=page.evaluate('performance.now()')
   phaseMetrics=page.evaluate('''()=>window.entryPhases?{sync:structuredClone(entryPhases.sync),longTasks:entryPhases.longTasks,resources:performance.getEntriesByType('resource').filter(e=>new URL(e.name).origin===location.origin).map(e=>({name:new URL(e.name).pathname.split('/').pop(),initiator:e.initiatorType,startMs:e.startTime,requestMs:e.requestStart,headersMs:e.responseStart,endMs:e.responseEnd,transferBytes:e.transferSize,encodedBytes:e.encodedBodySize,decodedBytes:e.decodedBodySize})),navigation:performance.getEntriesByType('navigation').map(e=>({startMs:e.startTime,requestMs:e.requestStart,headersMs:e.responseStart,endMs:e.responseEnd,domContentLoadedMs:e.domContentLoadedEventEnd}))}:null''')
   row=page.evaluate('''async()=>{
    const serialized=JSON.stringify(state.singleSongCatalog.ids().map(id=>state.singleSongCatalog.get(id)));
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
    return {release:MINDEX_RELEASE,native:state.singleSongCatalog.ids().length,logical:homeOverviewStats.songs,editions:homeOverviewStats.editions,ui:document.querySelector('.home-overview').innerText.includes(homeOverviewStats.songs.toLocaleString('ko-KR')+'곡'),hash:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),cache:window.MindexCatalogCache?.stats()||null,blocked:loadingAudit.blocked,requests:loadingAudit.requests};
   }''')
   row.update(phaseMetrics=phaseMetrics,phase=phase,shellReadyMs=shell,homeReadyMs=ready,pageErrors=len(errors));results.append(row)
   assert row['blocked']==0 and row['pageErrors']==0 and row['ui'],'unexpected write/playback, JS error or display mismatch'
   # Background writes are outside home readiness; wait before destroying process.
   if row['cache'] is not None:
    page.wait_for_function('MindexCatalogCache.stats().hits>0||MindexCatalogCache.stats().writes>0',timeout=5000)
   if phase=='reopened-repeat' and args.include_invalidated:
    # Change only this disposable local profile's signature, never server data.
    page.evaluate("async()=>{await MindexCatalogCache.write(state.client,{status:{...(await state.client.rpc('get_praise_storage_status_v1')).data,manifest:'diagnostic-stale-signature'},records:state.singleSongCatalog.ids().map(id=>state.singleSongCatalog.get(id))})}")
   if phase=='reopened-snapshot':
    page.evaluate('async()=>{if(window.MindexCatalogCache)await MindexCatalogCache.remove(state.client)}')
   (args.output/(args.label+'-'+args.engine+'.json')).write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
   pages=[r for r in row['requests'] if r['name']=='get_single_praise_catalog_page_v1' and r.get('startMs',float('inf'))<=ready]
   print(round(ready/1000,3),'seconds',len(pages),'catalog requests',row['cache'],flush=True)
  finally:context.close()
 print('PASS',args.label,args.engine,flush=True)
