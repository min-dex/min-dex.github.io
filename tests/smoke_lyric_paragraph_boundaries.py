"""Real DB/direct slide builders with isolated fixtures; no backend or output window."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1200,'height':1000})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''() => {
    const check=(v,m)=>{if(!v)throw Error(m)};
    const lyrics='\\r\\n혼자 부르는 한 줄\\r\\n\\r\\n세 줄의 첫째\\r\\n둘째\\r\\n셋째\\r\\n\\r\\n마지막 한 줄\\r\\n';
    const expected=['혼자 부르는 한 줄','세 줄의 첫째\\n둘째\\n셋째','마지막 한 줄'];
    const service={id:'paragraph-fixture',type_id:'fixture',date:'2030-01-01'};
    const song={id:'song',title:'문단 경계 검증',_relationalVersionsLoaded:true,versions:[{id:'version',name:'Default',_worshipVersionPersisted:true,forms:[{id:'v',part_type:'Verse',part_number:1,lyrics},{id:'c',part_type:'Chorus',lyrics:'후렴 한 줄'}]}]};
    state.songs=[song];state.services=[service];state.selectedServiceId=service.id;
    const item={id:'db',service_id:service.id,song_id:song.id,version_id:'version',label:'찬양',raw_title:song.title,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-C-V1',formPreset:normalizeServiceFormPreset('V1-C-V1','','manual')})};
    const original=JSON.stringify({song,item}),playback=JSON.stringify(state.presenter);
    const slides=buildPresenterSlidesForServiceItem(item,service,0).filter(s=>s.type==='lyrics');
    check(JSON.stringify(slides.map(s=>s.text))===JSON.stringify([...expected,'후렴 한 줄',...expected]),'DB paragraph/order '+JSON.stringify(slides.map(s=>s.text)));
    const grouped={...item,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1A-V1B',formPreset:normalizeServiceFormPreset('V1A-V1B','','manual')})};
    const groupedSlides=buildPresenterSlidesForServiceItem(grouped,service,0).filter(s=>s.type==='lyrics');
    check(JSON.stringify(groupedSlides.map(s=>s.text))===JSON.stringify(['혼자 부르는 한 줄','세 줄의 첫째\\n둘째','셋째','마지막 한 줄']),'grouped paragraph boundary');
    const direct={id:'direct',service_id:service.id,label:'찬양',raw_title:'직접 입력',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',slides:parseServiceManualPraiseLyricsInput(lyrics.replace(/\\r/g,''))})};
    const manual=buildPresenterSlidesForServiceItem(direct,service,1).filter(s=>s.type==='lyrics');
    check(JSON.stringify(manual.map(s=>s.text))===JSON.stringify(expected),'direct/DB mismatch');
    check(JSON.stringify({song,item})===original,'source mutation');check(JSON.stringify(state.presenter)===playback,'active output state touched');
    const old=[{type:'lyrics',text:'혼자 부르는 한 줄\\n세 줄의 첫째'}];
    const profile={audio:new Blob(['fixture']),duration:30,starts:[2],lyricsFingerprint:MindexSongTiming.fingerprint(old)};
    check(MindexSongTiming.validate(profile,slides).includes('장 나눔'),'old cue boundaries accepted');
    check(JSON.stringify(splitPresenterLyricChunks('하나\\n둘\\n셋'))===JSON.stringify(['하나\\n둘','셋']),'liturgy splitter changed');
    const records=parseServiceSourceText('[[찬양]]\\n[찬양]\\n- 유형: 찬양\\n- 입력: 직접 입력');
    check(records[0].inputMode==='직접 입력','source parser rewrote input');
    check(normalizeServiceInputMode(records[0].inputMode)==='manual_praise','import alias not resolved');
    const host=document.createElement('main');host.style.cssText='display:grid;gap:20px;padding:20px;background:#222';
    slides.slice(0,3).forEach(slide=>{const frame=document.createElement('div');frame.className='presenter-output-root no-chromakey';frame.style.cssText='position:relative;width:850px;height:250px';frame.innerHTML=renderPresenterSlideFrame(slide);host.append(frame)});
    document.body.replaceChildren(host);
    for(const text of expected)check(host.textContent.includes(text.replace(/\\n/g,''))||text.split('\\n').every(l=>host.textContent.includes(l)),'rendered text lost');
    return 'PASS DB 1/3/1 paragraphs, repeated form order, direct parity, source and session preservation, stale timing guard, import boundary';
   }'''),flush=True)
   assert not errors,errors
   page.screenshot(path=f'/tmp/mindex-lyric-paragraphs-{engine}.png');browser.close()
finally:server.shutdown()
