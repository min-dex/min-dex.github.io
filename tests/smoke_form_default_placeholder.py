"""Blank forms show effective defaults without owning/saving them; only main praise defaults Title."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof serviceItemDefaultFormHint==='function' && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''() => {
    const check=(ok,m)=>{if(!ok)throw Error(m)};
    const version={id:'v',name:'기본',praise_types:['ccm'],forms:[{id:'verse',part_type:'Verse',part_number:1,lyrics:'첫 절'},{id:'chorus',part_type:'Chorus',lyrics:'후렴'}]};
    const song={id:'s',title:'기본 송폼 검증',praise_types:['ccm'],versions:[version],_relationalVersionsLoaded:true};
    state.songs=[song];
    const service={id:'svc',type_id:'fixture',date:'2000-01-01'};state.services=[service];
    const input=item=>{const host=document.createElement('div');host.innerHTML=renderServiceFormHintInput(item,0);return host.firstElementChild};
    for(const [label,key,hasTitle] of [['찬양 1','praise',true],['파송찬양','sending',false],['결단찬양','response_song',false]]) {
     const item={id:key,service_id:service.id,song_id:song.id,version_id:version.id,label,_worshipSectionKey:key,raw_title:song.title,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
     const before=JSON.stringify({item,song});
     const field=input(item);check(field.value==='' && field.placeholder===(hasTitle?'Title-V-C':'V-C'),'default must be placeholder '+label+' '+field.outerHTML);
     check(presenterFormPlanForServiceItem(version,item,song).forms.some(f=>f._presenterTitle)===hasTitle,'default Title scope '+label);
     const slides=buildPresenterSlidesForServiceItem(item,service,0,{allowHydration:false});
     if(!hasTitle)check(slides[0].type==='title-assignee' && !slides[0].formLabel && slides[0].contentTitle.includes(song.title),'ordinary content heading '+label);
     check(JSON.stringify({item,song})===before,'read changes data');
     const linked={...item,song_id:null,version_id:null};linkServiceItemToPraiseSong(linked,song,service);check(!parseServiceItemMemo(linked.memo).formPreset,'inference persisted on link');
     applyServiceItemMetadataField(item,{dataset:{serviceItemField:'form_hint'},value:'C-V1'},service);
     check(input(item).value==='C-V1' && !presenterFormPlanForServiceItem(version,item,song).forms.some(f=>f._presenterTitle),'authored sequence owns title/order');
     applyServiceItemMetadataField(item,{dataset:{serviceItemField:'form_hint'},value:''},service);
     check(input(item).value==='' && !serviceElementConfigForSave({},parseServiceItemMemo(item.memo)).formPreset,'clearing restores empty input');
    }
    song.metadata={presenter_form:{forms:['C','V1'],strength:'song-default'}};
    const registered={id:'registered',label:'찬양 1',_worshipSectionKey:'praise',song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    check(input(registered).value==='Title-C-V1','registered main default filled');
    const linked={...registered,song_id:null,version_id:null};linkServiceItemToPraiseSong(linked,song,service);check(serviceItemFormHint(linked)==='Title-C-V1','registered form copied on link');
    const sending={...registered,label:'파송찬양',_worshipSectionKey:'sending'};check(input(sending).value==='C-V1','registered sending form has no added Title');
    const hymn={...song,praise_types:['hymn'],metadata:{}};const hymnVersion={...version,praise_types:['hymn']};
    const score={...registered,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})};
    check(!presenterScoreFormSequence(score,hymn,hymnVersion).forms.includes('Title'),'hymn score default Title');
    score.memo=serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',formPreset:{forms:['Title','V1'],titleSequence:true}});
    check(presenterScoreFormSequence(score,hymn,hymnVersion).forms.join('-')==='Title-V1','explicit score Title preserved');
    return 'PASS empty placeholder, default scope, content headings, linking, authored input, clear/save and registered forms';
   }'''),flush=True);browser.close()
finally:server.shutdown();server.server_close()
