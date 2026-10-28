"""Audio presence replaces children classification; no production IO."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch(headless=True)
   page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.route('**/app.runtime.js*',lambda route:route.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof versionHasAudio==='function' && !!globalThis.MindexSongTiming && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate(r"""()=>{
    const check=(v,m)=>{if(!v)throw Error(m)},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const forms=[{id:'f',label:'Lyrics',part_type:'Lyrics',lyrics:'첫 줄\n둘째 줄\n\n다음 장'}];
    const slides=[{type:'lyrics',text:'첫 줄\n둘째 줄'},{type:'lyrics',text:'다음 장'}];
    const old={id:'SONG-CHLD-0001-0001',revision:1,metadata:{title:'음원 있는 곡',praise_types:['children']},content:{name:'보존할 이름',praise_types:['children'],forms},relations:{same_song:[],related:[]}};
    old.content.audio_set={enabled:true,audioUrl:'https://example.test/a.mp3',audioFingerprint:'hash',duration:20,starts:[2,9],forms:structuredClone(forms),sourceSignature:MindexSongTiming.sourceSignature(old.content),lyricsFingerprint:MindexSongTiming.fingerprint(slides)};
    const clean=MindexSingleSong.recordForWrite(old),song=MindexSingleSong.createCatalog([clean]).appSong(clean.id),version=song.versions[0];
    const manual={id:'SONG-CONT-0002-0001',title:'반주로 부를 곡',versions:[{id:'SONG-CONT-0002-0001',name:'기본',praise_types:['ccm'],forms:structuredClone(forms)}]};
    state.songs=[song,manual];state.module='praise';state.praiseFilter='audio';renderListFilter();
    check(same(getSongsForPraiseFilter().map(s=>s.id),[song.id]),'audio filter');
    check(!!refs.listFilter.querySelector('[data-list-filter=audio]') && !refs.listFilter.textContent.includes('음원 없음') && !refs.listFilter.textContent.includes('어린이'),'visible names');
    state.praiseFilter='all';check(getSongsForPraiseFilter().length===2,'all retains manual songs');
    check(normalizePraiseListFilterKey('children')==='audio','old filter preference');
    state.selectedSongId=song.id;state.selectedVersionId=version.id;state.forms=structuredClone(forms);
    check(!renderFormsTab(song).includes('data-version-type-toggle'),'no classification editor toggle');
    const editorHymn={...manual,id:'editorHymn',praise_types:['hymn'],versions:[{...manual.versions[0],id:'editorHymn-v',praise_types:['hymn']}]};
    const hymnBefore=JSON.stringify(editorHymn);state.songs=[...state.songs,editorHymn];state.selectedSongId=editorHymn.id;state.selectedVersionId=editorHymn.versions[0].id;renderFormsTab(editorHymn);state.songs=state.songs.filter(s=>s!==editorHymn);state.selectedSongId=song.id;state.selectedVersionId=version.id;check(JSON.stringify(editorHymn)===hymnBefore,'existing editorHymn rendering preserves data');
    state.praiseFilter='hymn';check(same(buildNewPraiseSongDraft({title:'새 곡'}).praise_types,['ccm']),'new song independent of hymn filter');state.praiseFilter='all';

    const item={id:'slot',song_id:song.id,memo:serializeServiceItemMemo({inputMode:'children_audio',elementType:'praise'})};
    const before=JSON.stringify({item,clean});
    check(serviceSelectableSongVersions(song,item,{}).length===1,'CCM audio selectable');
    check(serviceSelectableSongVersions(manual,item,{}).length===0,'missing audio excluded');
    check(same(MindexSongTiming.formsFor(item,song,version,[]),forms),'saved audio form order');
    const rendered=MindexSongTiming.decorate(slides,item,song,version);
    check(rendered.every(s=>s.syncTimeline?.audioSrc===version.audio_set.audioUrl),'CCM auto timing');
    check(rendered[0].syncTimeline.start===2 && rendered[1].syncTimeline.start===9,'cue preservation');
    const lyricsItem={...item,memo:serializeServiceItemMemo({inputMode:'lyrics_db',elementType:'praise'})};
    check(MindexSongTiming.decorate(slides,lyricsItem,song,version).every(s=>!s.syncTimeline&&!s.songTimingAudio),'manual lyrics without audio');
    check(JSON.stringify({item,clean})===before,'inputs unchanged');
    const service={id:'fixture-service',type_id:'children'};state.services=[service];state.selectedServiceId=service.id;
    const context={item:{...item,label:'찬양'},service,index:0,timingEntries:rendered.map(slide=>({slide:{...slide,elementId:item.id}}))};
    const host=document.createElement('div');document.body.append(host);
    const paint=()=>{const has=MindexSongTiming.audioFor(context.timingEntries,item.id);host.innerHTML=renderPresenterBoardItemAudioControls(service.id,context,{manager:!!has?.url});return host.textContent;};
    check(!paint().includes('등록된 음원이 없습니다'),'valid audio not missing');
    const saved=version.audio_set;delete version.audio_set;context.timingEntries=[];
    check(paint().includes('등록된 음원이 없습니다.'),'missing audio empty state');
    check(!host.querySelector('[data-song-timing-play]'),'missing audio cannot play');
    version.audio_set={...saved,sourceSignature:'stale'};
    check(paint().includes('가사·송폼이 변경'),'stale lyrics distinct');
    check(MindexSongTiming.decorate(slides,item,song,version).every(s=>!s.syncTimeline&&!s.songTimingAudio),'stale set never borrowed or auto played');
    version.audio_set={...saved,starts:[2]};context.timingEntries=slides.map(slide=>({slide:{...slide,elementId:item.id}}));
    check(paint().includes('자동 넘김 타이밍이 맞지'),'invalid timing distinct');
    check(MindexSongTiming.decorate(slides,item,song,version).every(s=>!s.syncTimeline),'invalid timing never auto advances');
    version.audio_set=saved;
    version.audio_set.enabled=false;check(versionHasAudio(version),'paused autosync has audio');
    check(MindexSongTiming.decorate(slides,item,song,version).every(s=>!s.syncTimeline),'disabled timing remains disabled');
    state.hymnScoreManifestLoaded=true;
    state.hymnScoreManifest={'301':{slides:[{url:'assets/icon-192.png'}]},'custom-score':{slides:[{url:'assets/icon-512.png'}]}};
    const hymn={id:'h',hymn_no:'301',praise_types:['hymn'],versions:[{id:'new-score',name:'새찬송가',hymn_no:'301'},{id:'union-score',name:'통일찬송가',hymn_no:'통 460'}]};
    check(presenterHymnScoreAssetSlides(hymn,hymn.versions[0]).length===1,'registered new hymnal');
    check(presenterHymnScoreAssetSlides(hymn,hymn.versions[1]).length===0,'union never borrows new hymnal');
    check(presenterHymnScoreAssetSlides(hymn,{id:'other',name:'다른 편곡'}).length===0,'arrangement never borrows parent number');
    const custom={id:'custom',praise_types:['ccm'],versions:[{id:'custom-score',name:'직접 악보',forms:[]}]};
    check(serviceSongHasScore(custom),'non-hymnal registered score');
    check(presenterHymnScoreAssetSlides(custom,custom.versions[0])[0].url==='assets/icon-512.png','exact version source');
    check(!serviceSongHasScore(manual),'no score absent');
    const scoreItem={id:'score-slot',label:'찬양',memo:serializeServiceItemMemo({inputMode:'score_db',elementType:'praise'})};
    check(serviceSelectableSongVersions(custom,scoreItem,service).length===1,'non-hymnal score selectable');
    state.songs.push(custom);clearSearchCaches();
    check(!serviceItemSongSelectionInvalid({...scoreItem,song_id:custom.id,version_id:'custom-score'},service,custom),'registered custom selection accepted');
    return 'PASS audio/source ownership, empty/stale/timing states, real score presence, new/other edition isolation, manual mode and preserved cues';
   }"""),flush=True);b.close()
finally:server.shutdown()
