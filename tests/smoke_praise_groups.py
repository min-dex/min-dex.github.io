"""Song-level navigation retains native records, exact variants, drafts and output."""
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
   page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof groupPraiseSongs==='function' && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate(r'''()=>{
    const check=(v,m)=>{if(!v)throw Error(m)},uid=()=>crypto.randomUUID();
    const make=(id,title,name,links=[])=>({id,revision:1,metadata:{title},content:{name,praise_types:['ccm'],forms:[{id:uid(),part_type:'Lyrics',label:'Lyrics',lyrics:'첫 줄\n둘째 줄\n\n다음 화면'}]},relations:{same_song:links,related:[]}});
    const a=make('SONG-CONT-0001-0001','대표곡','원곡',['SONG-CONT-0001-0002']);
    const v=make('SONG-CONT-0001-0002','다른 제목','편곡',[a.id]);
    const m=make('SONG-CONT-0118-0001','마라나타','기본'),n=make('SONG-CHLD-0019-0001','마라나타','파이디온');
    const slides=[{type:'lyrics',text:'첫 줄\n둘째 줄'},{type:'lyrics',text:'다음 화면'}];
    v.content.audio_set={enabled:true,audioUrl:'https://example.test/a.mp3',audioFingerprint:'abc',duration:20,starts:[1,9],forms:structuredClone(v.content.forms),sourceSignature:MindexSongTiming.sourceSignature(v.content),lyricsFingerprint:MindexSongTiming.fingerprint(slides)};
    installSingleSongSession([a,v,m,n],MindexSingleSong.createRepository({read:async()=>[],commit:async()=>{throw Error('unexpected write')}}));
    persistUiState=()=>{};state.client={};state.connectionError='';state.auth.session={user:{id:'fixture'}};state.module='praise';state.search='';state.praiseFilter='all';state.selectedSongId=v.id;state.selectedVersionId=v.id;state.forms=structuredClone(v.content.forms);state.dirty.song=false;state.dirty.forms=false;
    const original=JSON.stringify(state.songs),items=[{id:uid(),song_id:v.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio'})}],itemBefore=JSON.stringify(items);
    const group=groupPraiseSongs(state.songs);check(group.length===3,'one row per confirmed song');check(group.filter(s=>s.title==='마라나타').length===2,'different Maranatha separate');
    check(getFilteredSongs().find(s=>s._praiseGroupCount===2).id===a.id,'catalog starts at representative when no search');
    renderSongList();check(refs.songCount.textContent==='3곡','group count: '+refs.songCount.textContent);check(refs.songList.querySelectorAll('.song-item').length===3,'list rows');check(refs.songList.querySelector('.song-item.active')?.dataset.songId===v.id,'selected variant navigation');
    check(refs.songList.querySelector('.song-item.active').textContent.includes('대표곡'),'common list title');
    const found=getGlobalPraiseResults(getSearchTokens('다른 제목'));check(found.length===1&&found[0].song.id===v.id,'variant-title search opens exact match');check(songListView(found[0].song).title==='대표곡','search common title');
    state.praiseFilter='audio';check(groupPraiseSongs(getSongsForPraiseFilter()).length===1,'audio in one variant includes group');state.praiseFilter='all';
    const selected=state.songs.find(s=>s.id===v.id);check(praiseGroupTitle(selected)==='대표곡','detail common title');
    const picker=document.createElement('div');picker.innerHTML=renderSingleSongVersionPicker(selected);check(picker.querySelectorAll('option').length===2&&picker.querySelector('select').value===v.id,'exact selected version');
    check(!renderSingleSongVersionPicker(state.songs.find(s=>s.id===m.id)),'single version no selector');
    check(renderNativeVersionMetadata(state.songs.find(s=>s.id===m.id)).includes('data-version-name-field'),'single default variant still editable');
    const markup=renderFormsTab(selected);check(!markup.includes('linked-version-title'),'one editable version not all columns');check(!markup.includes('data-version-name-field')&&!markup.includes('data-version-output-title-field'),'identity edit not repeated on lyrics');check(markup.includes('다른 제목'),'different title visible');
    check(!renderNativeVersionMetadata(selected).includes('data-version-output-title-field'),'no separate output title');
    selected.related_song_ids=[m.id];check(renderFormsTab(selected).includes('linked-version-title'),'unrelated linked song comparison retained');selected.related_song_ids=[];
    const svc={id:uid(),type_id:'custom',date:'2026-10-28'},manual={id:uid(),song_id:null,raw_title:'대표곡',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    state.services=[svc];state.selectedServiceId=svc.id;state.serviceItems={[svc.id]:[manual]};clearSearchCaches();
    const audioItem={...manual,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio'})};
    const audioResults=serviceSongPickerResults('대표곡',audioItem,svc);check(audioResults.length===1&&audioResults[0].id===v.id,'common title finds audio on differently titled variant');
    const results=serviceSongPickerResults('대표곡',manual,svc);check(results.length===1,'service song grouped');
    const host=document.createElement('div');host.innerHTML=renderServiceSongPickerResult(results[0],0);check(host.querySelector('details summary'),'choose song first');check(host.querySelectorAll('[data-service-song-select]').length===2,'explicit variant choices');check([...host.querySelectorAll('[data-service-song-select]')].map(x=>x.dataset.serviceSongSelect).includes(v.id),'exact variant ID');
    check(!renderServiceSongVersionPicker({...manual,song_id:m.id},0,{linkedSong:state.songs.find(s=>s.id===m.id),service:svc}),'single service selector omitted');
    const audio=MindexSongTiming.decorate(slides,items[0],selected,selected.versions[0]);check(audio[0].syncTimeline.start===1&&audio[1].syncTimeline.start===9,'timing exact');
    check(JSON.stringify(state.songs)===original&&JSON.stringify(items)===itemBefore,'records and worship unchanged');
    renderDetail();
    return 'PASS groups/search/filter, separate songs, exact selected variant, metadata, service choices, lyrics/audio/cues preservation';
   }'''),flush=True)
   page.locator('[data-single-version-select]').select_option('SONG-CONT-0001-0001')
   page.wait_for_function("state.selectedSongId==='SONG-CONT-0001-0001' && state.forms.length>0")
   page.evaluate("()=>{state.dirty.forms=true;state.forms[0].lyrics='저장 전 원문';window.groupTestConfirm=confirmSaveBeforeLeaving;confirmSaveBeforeLeaving=async()=>false}")
   page.locator('[data-single-version-select]').select_option('SONG-CONT-0001-0002')
   page.wait_for_function("document.querySelector('[data-single-version-select]').value==='SONG-CONT-0001-0001'")
   assert page.evaluate("state.selectedSongId==='SONG-CONT-0001-0001' && state.forms[0].lyrics==='저장 전 원문' && state.dirty.forms")
   page.evaluate("()=>{confirmSaveBeforeLeaving=window.groupTestConfirm;state.dirty.forms=false}")
   page.locator('[data-single-version-select]').select_option('SONG-CONT-0001-0002')
   page.wait_for_function("state.selectedSongId==='SONG-CONT-0001-0002' && state.forms.length>0")
   assert page.locator('#editorSongTitle').inner_text().strip()=='대표곡'
   assert page.locator('[data-form-field=lyrics]').count()==1
   assert '다음 화면' in page.locator('[data-form-field=lyrics]').input_value()
   page.locator('[data-open-metadata]').click()
   assert page.get_by_role('textbox',name='판본 구분명',exact=True).count()==1
   assert page.get_by_role('textbox',name='송출 제목',exact=True).count()==0
   page.evaluate("window.titleEditPreserved=JSON.stringify({forms:state.forms,audio:getSelectedVersion().audio_set,items:state.serviceItems,relations:state.singleSongCatalog.get(state.selectedSongId).relations})")
   page.get_by_role('textbox',name='판본 구분명',exact=True).fill('편곡 (직접 정한 이름)')
   page.get_by_role('textbox',name='판본 구분명',exact=True).dispatch_event('input')
   assert page.evaluate("getSelectedVersion().name==='편곡 (직접 정한 이름)' && getSelectedSong().title==='다른 제목'")
   page.locator('[data-song-field="title"]').fill('편곡의 다른 곡 제목')
   page.locator('[data-song-field="title"]').dispatch_event('input')
   assert page.locator('#editorSongTitle').inner_text().strip()=='대표곡'
   page.locator('[data-song-field="subtitle"]').fill('판본 부제 예시')
   assert page.locator('[data-native-title-detail]').inner_text()=='판본 부제 예시'
   assert page.locator('[data-native-group-title]').inner_text()=='대표곡'
   assert page.locator('[data-native-output-title]').inner_text()=='편곡의 다른 곡 제목'
   assert page.evaluate("titleEditPreserved===JSON.stringify({forms:state.forms,audio:getSelectedVersion().audio_set,items:state.serviceItems,relations:state.singleSongCatalog.get(state.selectedSongId).relations})")
   assert page.evaluate("(()=>{const s=getSelectedSong(),r=MindexSingleSong.fromLegacySong(s,s.versions[0],s.id),fresh=MindexSingleSong.createCatalog([r]).appSong(r.id);return fresh.versions[0].name==='편곡 (직접 정한 이름)' && !fresh.versions[0].output_title && fresh.title==='편곡의 다른 곡 제목'})()")
   page.set_viewport_size({'width':800,'height':800})
   assert page.evaluate("(()=>{const d=document.querySelector('.metadata-popover');return d.scrollWidth<=d.clientWidth})()")
   page.screenshot(path='/tmp/praise-variant-title-'+engine+'.png')
   page.locator('[data-close-metadata]').click()
   page.evaluate("()=>{window.groupChoiceCalls=[];selectServiceSongForItem=(index,id)=>groupChoiceCalls.push({index,id});const item=getServiceItems(state.selectedServiceId)[0];refs.detailPane.innerHTML=renderServiceSongPickerResult(serviceSongPickerResults('대표곡',item,selectedServiceForEditor())[0],0)}")
   page.locator('.svc-song-group-choice > summary').click()
   assert page.evaluate('groupChoiceCalls.length')==0
   page.locator('[data-service-song-select="SONG-CONT-0001-0002"]').click()
   assert page.evaluate("groupChoiceCalls.length===1 && groupChoiceCalls[0].id==='SONG-CONT-0001-0002'")
   page.evaluate('renderDetail()')
   page.set_viewport_size({'width':800,'height':800})
   page.screenshot(path='/tmp/praise-group-'+engine+'.png')
   assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
   print(engine,'PASS real selector navigation and cancelled dirty draft retained',flush=True)
   b.close()
finally: server.shutdown()
