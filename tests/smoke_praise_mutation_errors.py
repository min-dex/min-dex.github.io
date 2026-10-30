"""First-line alias input through native atomic save; isolated memory RPC only."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from pathlib import Path
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page()
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
    page.add_init_script('window.open=()=>null')
    page.route('**/mindex-release.json*',lambda r:r.fulfill(json={'version':'inline-source-test'}))
    page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof saveWorshipServiceInstance==='function' && !!refs.songList && !document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    print(engine,page.evaluate(r"""async()=>{
      const check=(ok,msg)=>{if(!ok)throw Error(msg)},uid=()=>crypto.randomUUID();
      const records=[1,2].map(n=>{
        const v={id:uid(),name:'원문 판본',forms:[{id:uid(),part_type:'Verse',lyrics:'원문\n보존'}],audio_set:{url:'/fixture.mp3',starts:[1,3]}};
        const r=MindexSingleSong.fromLegacySong({id:uid(),title:'오류 검증 '+n,versions:[v]},v,`SONG-CONT-090${n}-0001`);r.revision=1;return r;
      });
      let failure=new Error('Failed to fetch');
      const repo={read:async()=>structuredClone(records),save:async()=>{throw Error("unexpected save")},mutate:async()=>{throw failure},pendingMutation:()=>null};
      installSingleSongSession(records,repo);
      state.dirty.song=false;state.dirty.forms=false;state.saving=false;
      const song=state.songs.find(s=>s.id===records[0].id);
      const before=JSON.stringify({songs:state.songs,forms:state.forms,records});
      const toasts=[];showToast=(message,kind)=>toasts.push({message,kind});
      for(const [error,expected] of [
        [new Error('Failed to fetch'),'서버 응답'],
        [new Error('SINGLE_SONG_CONFLICT'),'충돌'],
        [Object.assign(new Error('private database details'),{code:'42501'}),'권한'],
        [new Error('SONG_REFERENCE_MISSING'),'찾지 못'],
        [new Error('SINGLE_SONG_IN_USE'),'사용 중'],
        [new Error('SONG_MUTATION_OUTCOME_UNKNOWN'),'처리 결과'],
        [new Error('PGRST301 private token'),'로그인'],
        [new Error('private SQL and record body'),'완료하지 못']
      ]) {
        failure=error;toasts.length=0;
        await editSingleSongRelation(song,'same_song',records[1].id);
        check(toasts.length===1&&toasts[0].kind==='error','failure appeared successful');
        check(toasts[0].message.includes(expected),'wrong error category');
        check(!/private|SINGLE_|PGRST|42501/.test(toasts[0].message),'raw details leaked');
        check(!state.saving,'saving remained stuck');
        check(JSON.stringify({songs:state.songs,forms:state.forms,records})===before,'failure changed source');
        check(failure===error,'original error replaced');
      }
      return 'PASS safe categorized mutation errors; actual relationship failure preserves lyrics/audio/forms/relations; zero writes';
    }"""),flush=True)
    page.unroute_all(behavior='wait')
   finally:browser.close()
finally:server.shutdown()
