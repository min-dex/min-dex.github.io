"""Native freshness respects explicit title-only output; no operational reads or output."""
import os,json
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
from pathlib import Path
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function('!!window.MindexPresenterFreshness')
   result=page.evaluate('''async()=>{
    const uid=()=>crypto.randomUUID(),sid=uid(),service={id:sid,type_id:'fixture',title:'isolated'};
    const make=(id,forms)=>({...MindexSingleSong.fromLegacySong({id:uid(),title:id,praise_types:['ccm']},{id:uid(),name:'fixture',forms},id),revision:1});
    const full=make('SONG-CONT-0901-0001',[{id:uid(),part_type:'Lyrics',lyrics:'보존할 가사',sort_order:1}]);
    const empty=make('SONG-CONT-0902-0001',[]),records=[full,empty],original=JSON.stringify(records);let reads=0;
    installSingleSongSession(records,MindexSingleSong.createRepository({read:async(ids)=>{reads++;return structuredClone(records.filter(r=>ids.includes(r.id)))},commit:async()=>{throw Error('write prohibited')}}));
    state.services=[service];state.selectedServiceId=sid;state.config.url='fixture';state.dirty.song=false;state.dirty.forms=false;state.presenter.outputPendingAt=0;
    hydratePresenterServiceData=async()=>{};isPresenterOutputWindowOpen=()=>false;
    state.client={from(){const q={select(){return q},eq(){return q},single:async()=>({data:{id:sid,save_revision:1}})};return q}};
    const results=[];
    for(const [name,record,mode,hint] of [['native-lyrics',full,'lyrics_db','L'],['empty-lyrics',empty,'lyrics_db','L'],['title-only',empty,'lyrics_db','T'],['mixed-missing-lyrics',empty,'lyrics_db','T-L'],['implicit-empty',empty,'lyrics_db',''],['score-empty-lyrics',empty,'score_db','V1'],['audio-empty-lyrics',empty,'children_audio','L'],['audio-title-only',empty,'children_audio','T'],['explicit-missing-version',full,'lyrics_db','L']]){
     const item={id:uid(),service_id:sid,label:'찬양 1',song_id:record.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:mode,formHint:hint})};
     if(name==='explicit-missing-version')item.version_id='missing-version';
     state.serviceItems={[sid]:[item]};const before=JSON.stringify(item);let error=null;
     try{await MindexPresenterFreshness.verify(sid)}catch(e){error=e.message}
     const song=state.singleSongCatalog.appSong(record.id),version=song.versions[0],plan=presenterFormPlanForServiceItem(version,item,song);
     const slides=presenterLyricsSlidesForServiceItem({item,section:{sectionKey:'praise',sectionLabel:'찬양'},index:0,song,version,displayText:song.title,label:item.label,forms:plan.forms,formWarnings:plan.warnings});
     const expected=['native-lyrics','title-only','score-empty-lyrics'].includes(name);
     if(Boolean(!error)!==expected)throw Error(name+': '+error);
     if(name==='title-only'&&(slides.length!==1||slides[0].type==='lyrics'))throw Error('title output changed');
     if(JSON.stringify(item)!==before)throw Error('item mutated');
     results.push({name,error,usable:presenterVersionHasUsableLyrics(version),plan:plan.forms.map(f=>({title:!!f._presenterTitle,blank:!!f._presenterBlank,lyrics:!!f.lyrics})),preserved:JSON.stringify(item)===before});
    }
    if(JSON.stringify(records)!==original)throw Error('record mutation');
    return {results,reads};
   }''')
   print(engine,json.dumps(result,ensure_ascii=False),flush=True);b.close()
finally:server.shutdown();server.server_close()
