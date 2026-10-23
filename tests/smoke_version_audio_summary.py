"""Read-only version audio summary; isolated drafts, no playback or production IO."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server, launch_chromium, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch(headless=True)
   page=b.new_page(viewport={'width':1100,'height':650})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof renderVersionAudioSummary==='function' && !document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    const forms=[{id:'form',part_type:'Verse',lyrics:'보존할 가사'}];
    const version={id:'version',name:'어린이 찬양',forms,praise_types:['children']};
    const audio={audioUrl:'https://example.test/audio.mp3',audioName:'<script>실행 금지</script> '+ '아주 긴 음원 파일명 '.repeat(8)+'.mp3',starts:[0,2,4],enabled:true,sourceSignature:MindexSongTiming.sourceSignature(version)};
    version.audio_set=audio;const song={id:'song',title:'요약 화면 검증',versions:[version]};
    const before=JSON.stringify(song);window.summaryFixture={song,version,forms,before};
    const html=renderVersionAudioSummary(version,forms);
    check(html.includes('저장 타이밍 3개')&&html.includes('자동 넘김 켜짐'),'saved settings');
    check(!html.includes('<script>'),'filename escaping');
    check(!renderVersionAudioSummary({...version,audio_set:null,childrenAudioSets:{version:audio}},forms),'no legacy fallback');
    check(renderVersionAudioSummary({...version,audio_set:{...audio,starts:[],enabled:false}},forms).includes('저장 타이밍 없음'),'empty timing');
    check(renderVersionAudioSummary({...version,audio_set:{...audio,enabled:false}},forms).includes('자동 넘김 꺼짐'),'disabled setting');
    check(renderVersionAudioSummary(version,[{...forms[0],lyrics:'아직 저장하지 않은 가사'}]).includes('확인 필요'),'draft mismatch');
    check(JSON.stringify(song)===before,'source mutated');
    state.songs=[song];state.selectedSongId=song.id;state.selectedVersionId=version.id;state.forms=forms;state.saving=false;
    document.body.innerHTML='<main id="fixture" style="padding:15px;width:800px;max-width:100%;box-sizing:border-box"><div class="version-compare-title">'+renderVersionTitleContent(song,version,forms,{active:true})+'</div></main>';refreshIcons();
   }''')
   for width in (800,320):
    page.locator('#fixture').evaluate('(el,w)=>el.style.width=w+"px"',width)
    assert page.locator('.version-audio-summary').count()==1
    assert page.evaluate('''()=>{const host=document.querySelector('.version-compare-title').getBoundingClientRect();return [...document.querySelectorAll('.version-audio-summary span')].every(e=>{const r=e.getBoundingClientRect();return r.left>=host.left&&r.right<=host.right+1&&e.scrollWidth<=e.clientWidth+1})}''')
    page.locator('[data-version-name-field]').fill('미저장 버전 이름')
    assert page.locator('[data-version-name-field]').input_value()=='미저장 버전 이름'
    assert page.evaluate('JSON.stringify(summaryFixture.song)===summaryFixture.before')
   page.screenshot(path='/tmp/mindex-audio-summary-'+engine+'.png')
   print('PASS',engine,'320/800px, long filename, escaping, per-version ownership, saved toggle, draft mismatch, no mutations',flush=True);b.close()
finally:server.shutdown()
