"""Children praise defaults reach the actual scaffold/select; existing records remain intact."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium

server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof buildWorshipServiceScaffold==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate("""()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const service={id:'children-audio-default',type_id:'children',date:'2026-11-01'};
    state.services=[service];state.selectedServiceId=service.id;state.client={};
    const scaffold=buildWorshipServiceScaffold(service.id,service.type_id,{service});
    const items=groupWorshipElements(scaffold.sections,scaffold.elements)[service.id];
    const praise=items.filter(i=>i._worshipSectionKey==='praise');
    check(praise.length===4,'children four praise slots');
    check(praise.every(i=>servicePraiseInputMode(i,parseServiceItemMemo(i.memo),service)==='children_audio'),'children default must be DB audio');
    check(projectWorshipServiceItemsFromTemplate(service,[]).length===0,'children legacy projection unexpectedly manufactured records');
    const controls=()=>praise.map((item,index)=>renderServicePraiseInputModeControl(item,index,serviceItemEditorModel(item,{service}))).join('');
    refs.detailPane.innerHTML=controls();check([...refs.detailPane.querySelectorAll('select')].every(e=>e.value==='children_audio'&&e.selectedOptions[0].textContent.trim()==='DB: 음원'),'actual selected label');
    for(const mode of ['lyrics_db','score_db','manual_praise','audio_praise','children_audio']){
     const item={...praise[0],raw_title:'사용자 곡',song_id:mode.includes('_db')?'song-fixture':null,version_id:'version-fixture',assignee:'기존 담당',memo:serializeServiceItemMemo({...parseServiceItemMemo(praise[0].memo),inputMode:mode,slides:['직접 작성 가사'],note:'기존 메모'})};
     const before=JSON.stringify(item),result=projectWorshipServiceItemsFromTemplate(service,[item]).find(i=>i.id===item.id);
     check(servicePraiseInputMode(result,parseServiceItemMemo(result.memo),service)===mode,'explicit mode replaced '+mode);
     check(result.raw_title===item.raw_title&&result.song_id===item.song_id&&result.version_id===item.version_id&&result.assignee===item.assignee,'authored fields replaced');
     check(parseServiceItemMemo(result.memo).slides[0]==='직접 작성 가사'&&JSON.stringify(item)===before,'lyrics/source replaced');
    }
    const other={id:'other-youth',type_id:'youth',date:'2026-11-01'};
    const otherScaffold=buildWorshipServiceScaffold(other.id,other.type_id,{service:other});
    const otherPraise=(groupWorshipElements(otherScaffold.sections,otherScaffold.elements)[other.id]||[]).filter(i=>i._worshipSectionKey==='praise');
    check(otherPraise.length>0&&otherPraise.every(i=>servicePraiseInputMode(i,parseServiceItemMemo(i.memo),other)==='lyrics_db'),'other service default changed');
   }""")
   print('PASS',engine,'children four-slot scaffold and actual DB audio select, explicit modes/lyrics/links/assignee preserved, other-service default unchanged; existing empty services not fabricated; operational writes/output 0',flush=True)
   page.evaluate(r"""()=>{
    const check=(v,m)=>{if(!v)throw Error(m)}, T=MindexSongTiming;
    const forms=[];
    for(let n=1;n<=4;n++) forms.push({id:'audio-verse-'+n,part_type:'Verse',part_number:n,lyrics:`본절${n}가\n\n본절${n}나`},{id:'audio-chorus-'+n,part_type:'Chorus',part_number:null,lyrics:'반복 후렴'});
    forms.push({id:'audio-coda',part_type:'Coda',lyrics:'마지막'});
    const audioForms=[];let offset=0;
    for(const [i,f] of forms.entries()){
     for(const text of f.lyrics.split(/\n\s*\n/)){
      const end=offset+text.replace(/[^\p{L}\p{N}]/gu,'').length;
      audioForms.push({id:'page-'+audioForms.length,part_type:'Lyrics',lyrics:text,audioSourceRange:[offset,end]});offset=end;
     }
     if(i===3||i===8)audioForms.push({id:'blank-'+i,_presenterBlank:true,lyrics:'',label:i===3?'간주':'후주'});
    }
    const v={id:'audio-v',name:'기본',praise_types:['ccm'],forms,metadata:{presenter_form:{forms:['V1','C','V2','C','V3','C','V4','C','Coda'],strength:'song-default'}}};
    const pages=audioForms.map(f=>({type:f._presenterBlank?'blank':'lyrics',text:f.lyrics}));
    v.audio_set={audioUrl:'https://example.invalid/fixture.wav',audioFingerprint:'fixture',duration:40,enabled:true,starts:pages.map((_,i)=>2+i*2),forms:audioForms,sourceSignature:T.sourceSignature(v),lyricsFingerprint:T.fingerprint(pages)};
    const song={id:'audio-s',title:'합성 음원',versions:[v],_relationalVersionsLoaded:true,praise_types:['ccm']};
    const service={id:'audio-service',type_id:'custom',date:'2099-01-01'};
    const item=normalizeServiceItem({id:'audio-item',service_id:service.id,label:'찬양 1',raw_title:song.title,song_id:song.id,version_id:v.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio'})},0);
    state.services=[service];state.songs=[song];state.serviceItems={[service.id]:[item]};state.selectedServiceId=service.id;state.loadedWorshipServiceIds.add(service.id);clearSearchCaches();
    const before=JSON.stringify({song,item});
    const slides=buildPresenterSlidesForServiceItem(item,service,0),actual=T.pagesFor(slides);
    check(actual.length===15,'audio pages lost: '+actual.length);
    check(actual[6].type==='blank'&&actual[14].type==='blank','interlude/outro missing');
    check(!T.audioStatus(v,slides),'unexpected timing warning');
    check(JSON.stringify(actual.map(s=>s.syncTimeline?.start))===JSON.stringify(v.audio_set.starts),'cue starts changed');
    check(actual[6].syncTimeline.lead===0&&actual[14].syncTimeline.lead===0,'instrumental lead changed');
    const manual={...item,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio',formHint:'V2-C',formPreset:{forms:['V2','C'],strength:'manual'}})};
    check(!buildPresenterSlidesForServiceItem(manual,service,0).some(s=>s.syncTimeline),'changed explicit selection inherited old cues');
    check(JSON.stringify({song,item})===before,'authored forms or audio mutated');
   }""")
   print('PASS',engine,'numbered display of unnumbered source choruses preserves all 15 audio pages/cues and blanks; changed manual sequence stays untimed',flush=True)
   browser.close()
finally:server.shutdown()
