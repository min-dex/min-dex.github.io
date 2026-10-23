"""L is a selectable whole lyric form; source IDs, paragraphs and repeats survive."""
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof presenterBoardSlideBlocks==='function' && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''()=>{
    const check=(x,m)=>{if(!x)throw Error(m)};
    const body='첫 화면\\n가사\\n\\n둘째 화면\\n가사\\n\\n셋째 화면\\n가사';
    const form={id:'native-lyrics-id',part_type:'Lyrics',label:'Lyrics',lyrics:body};
    const version={id:'lyrics-version',forms:[form],praise_types:['ccm']},song={id:'lyrics-song',title:'L 검증',versions:[version],praise_types:['ccm']};
    const service={id:'lyrics-service',type_id:'fixture',date:'2000-01-01'};
    const item={id:'lyrics-item',service_id:service.id,label:'찬양 1',_worshipSectionKey:'praise',song_id:song.id,version_id:version.id,raw_title:song.title,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    state.songs=[song];state.services=[service];
    const before=JSON.stringify({song,version,form});
    check(serviceItemDefaultFormHint(item)==='T-L','inferred L hint');
    const natural=presenterFormPlanForServiceItem(version,item,song);
    check(natural.forms.some(f=>f.id===form.id && f.lyrics===body),'native form identity preserved');
    for(const hint of ['L','Lyrics','T-L-Int-L']) {
     const stored={...item,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formPreset:{forms:normalizeServiceFormPresetForms(hint),titleSequence:true,strength:'manual'}})};
     const slides=buildPresenterSlidesForServiceItem(stored,service,0,{allowHydration:false});
     const lyrics=slides.filter(s=>s.type==='lyrics');
     check(lyrics.length===(hint.includes('Int')?6:3),'L retains all paragraph pages '+hint);
     check(lyrics.slice(0,3).map(s=>s.text).join('\\n\\n')===body,'L text preserved');
     check(lyrics.filter(s=>s.marker||s.formLabel).every(s=>(s.formLabel||s.marker)==='L')&&(lyrics[0].formLabel||lyrics[0].marker)==='L','L markers');
     const blocks=presenterBoardSlideBlocks(annotatePresenterFormStarts(slides.map((slide,slideIndex)=>({slide,slideIndex}))).entries).filter(b=>b.label==='L');
     check(blocks.length===(hint.includes('Int')?2:1)&&blocks.every(b=>b.entries.length===3),'whole L grouping '+hint);
    }
    const manual={...item,song_id:null,version_id:null,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',slides:body.split('\\n\\n'),formPreset:{forms:['T','L','Int','L'],titleSequence:true,strength:'manual'}})};
    const directSlides=buildPresenterSlidesForServiceItem(manual,service,0,{allowHydration:false});
    check(directSlides.filter(s=>s.type==='lyrics').length===6,'direct renderer preserves paragraph pages');
    const multi=resolvePresenterFormPresetSequence([form,{...form,id:'second',lyrics:'마지막 가사'}],['L','L']);
    check(multi.items.map(f=>f.id).join()==='native-lyrics-id,second,native-lyrics-id,second','multiple native Lyrics IDs and repeat');
    const direct=resolvePresenterLyricsFormPresetSequence([],['L','L'],[],body.split('\\n\\n'));
    check(direct.items.length===2&&direct.items.every(f=>f.lyrics===body),'direct L whole content repeat');
    const images=[1,2,3].map(i=>({url:'/assets/icon-192.png?page='+i,formLabel:'Lyrics'}));
    const scoreForms=presenterScoreFormsFromImageSources(images);
    const scoreItem={...item,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',formPreset:{forms:['L','L'],titleSequence:true,strength:'manual'}})};
    const score=presenterScoreImageSourcesForFormSequence(images,scoreForms,[],scoreItem,song,version);
    check(score.imageSources.length===6,'score L repeats all pages');
    check(presenterFormPresetDisplayLabel('Lyrics')==='L' && songFormPresetDisplayLabel('Lyrics')==='L','display normalization');
    check(JSON.stringify({song,version,form})===before,'source unchanged');
    return 'PASS L aliases, inference, native IDs, complete paragraph playback, repeats, score pages and controller blocks';
   }'''),flush=True);browser.close()
finally:server.shutdown();server.server_close()
