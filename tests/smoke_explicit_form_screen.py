
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page(viewport={'width':1440,'height':1000});page.goto(url);page.wait_for_function("!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''()=>{
    const sid=crypto.randomUUID(),vid=crypto.randomUUID(),song={id:crypto.randomUUID(),title:'송폼 순서 검증',_relationalVersionsLoaded:true,versions:[{id:vid,name:'기본',praise_types:['ccm'],forms:[{id:'v1',part_type:'Verse',part_number:1,lyrics:'첫째 절 가사'},{id:'v2',part_type:'Verse',part_number:2,lyrics:'둘째 절 가사'},{id:'c',part_type:'Chorus',lyrics:'후렴 가사'}],metadata:{presenter_form:'V2-C-V1-C'}}]};
    const service={id:sid,type_id:'fixture',date:'2000-01-01',title:'Fixture'};state.services=[service];state.songs=[song];state.selectedServiceId=sid;state.loadedWorshipServiceIds.add(sid);clearSearchCaches();
    const item=normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,label:'찬양 1',raw_title:song.title,song_id:song.id,version_id:vid,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})},0);state.serviceItems[sid]=[item];
    const lyrics=buildPresenterSlidesForServiceItem(item,service,0).filter(s=>s.type==='lyrics');
    if(lyrics.map(s=>s.text).join('|')!=='둘째 절 가사|후렴 가사|첫째 절 가사|후렴 가사')throw Error('lyric sequence');
    const scoreItem={...item,id:crypto.randomUUID(),memo:JSON.stringify({elementType:'praise',inputMode:'score',outputMode:'score',formHint:'V2-C-V1-C',asset:{kind:'score',slides:[{url:'assets/hymn-scores/359/slide-01.webp',formLabel:'Verse 1'},{url:'assets/hymn-scores/359/slide-02.webp'},{url:'assets/hymn-scores/359/slide-05.webp',formLabel:'Verse 2'},{url:'assets/hymn-scores/359/slide-06.webp'},{url:'assets/hymn-scores/359/slide-03.webp',formLabel:'Chorus'},{url:'assets/hymn-scores/359/slide-04.webp'}]}})};
    const scoreMemo=JSON.parse(scoreItem.memo);state.hymnScoreManifest={'359':{title:'검증 악보',slides:scoreMemo.asset.slides.map(x=>({...x,src:x.url}))}};delete scoreMemo.asset;scoreItem.memo=JSON.stringify(scoreMemo);song.hymn_no='359';song.versions[0].hymn_no='359';song.versions[0].praise_types=['hymn'];state.serviceItems[sid].push(scoreItem);clearSearchCaches();
    const scores=buildPresenterSlidesForServiceItem(scoreItem,service,1).filter(s=>s.sourceType==='score');
    const source=scores.map(s=>s.asset?.url||s.imageSrc||'');
    if(source.map(x=>x.match(/slide-(\d+)/)?.[1]).join(',')!=='05,06,03,04,01,02,03,04')throw Error('score order '+source.join(','));
    if(scores.length!==8)throw Error('score continuation lost '+JSON.stringify(scores));
    const html=(slides,start)=>slides.map((s,i)=>renderPresenterSlideThumb(s,start+i,-1,sid,s.formLabel||s.marker||'')).join('');
    document.body.innerHTML='<main style="padding:24px"><h2>가사 V2–C–V1–C</h2><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">'+html(lyrics,0)+'</div><h2>악보 V2–C–V1–C · 각 구간 2페이지</h2><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">'+html(scores,4)+'</div></main>';
    window.qaScoreSources=source;return {lyrics:lyrics.map(s=>s.marker),scorePages:scores.length};
   }'''))
   page.evaluate("async()=>{await Promise.all(qaScoreSources.map(src=>{const i=new Image();i.src=src;return i.decode()}));await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}");page.screenshot(path=f'/tmp/mindex-explicit-form-{engine}.png',full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   b.close()
finally:server.shutdown()
