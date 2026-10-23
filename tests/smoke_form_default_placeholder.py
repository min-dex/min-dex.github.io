"""Blank forms show effective defaults without owning/saving them; main praise and special songs default Title."""
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
    for(const [label,key,hasTitle] of [['찬양 1','praise',true],['특송','special_song',true],['봉헌특송','offering',true],['파송찬양','sending',false],['결단찬양','response_song',false]]) {
     const item={id:key,service_id:service.id,song_id:song.id,version_id:version.id,label,_worshipSectionKey:key,raw_title:song.title,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
     const before=JSON.stringify({item,song});
     const field=input(item);check(field.value==='' && field.placeholder===(hasTitle?'T-V-C':'V-C'),'default must be placeholder '+label+' '+field.outerHTML);
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
    const imported={id:'source-praise',label:'찬양 4',_worshipSectionKey:'source-찬양',_worshipSectionTitle:'찬양',song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-C',formPreset:{forms:['V1','C'],strength:'manual'}})};
    const importedBefore=JSON.stringify(imported);
    check(isMainPraiseServiceItem(imported) && input(imported).value==='T-V1-C','source praise with saved form restores leading T');
    check(presenterFormPlanForServiceItem(version,imported,song).forms[0]._presenterTitle,'source praise renders restored title');
    check(JSON.stringify(imported)===importedBefore,'source praise title rewrote authored form');
    check(isMainPraiseServiceItem({...imported,_worshipSectionTitle:''}),'source praise key without display title');
    for(const title of ['봉헌','파송찬양','결단찬양','입례찬양'])check(!isMainPraiseServiceItem({...imported,_worshipSectionKey:'source-'+title,_worshipSectionTitle:title}),'source non-main scope '+title);
    check(!isMainPraiseServiceItem({...imported,_worshipSectionKey:'offering'}),'canonical section owns scope');
    const intentional={...imported};
    applyServiceItemMetadataField(intentional,{dataset:{serviceItemField:'form_hint'},value:'V1-C'},service);
    check(input(intentional).value==='V1-C' && !presenterFormPlanForServiceItem(version,intentional,song).forms.some(f=>f._presenterTitle),'source praise intentional omission preserved');
    let backgroundCases=0;
    for(const date of ['2026-07-19','2026-10-25','2027-01-03'])for(const type of Object.keys(SERVICE_ORDER_TEMPLATE_FALLBACKS)) {
     const svc={id:'defaults-'+date+'-'+type,type_id:type,date};state.services=[svc];
     for(const [sectionIndex,step] of serviceOrderTemplate(type,{service:svc}).entries())for(const element of worshipTemplateElementSteps(step,step.label||step.name||'')) {
      const expected=normalizeServiceFormPreset(element.formPreset||element.form_preset,element.formHint||element.form_hint,element.defaultStrength);
      if(!expected?.forms?.length)continue;
      const label=element.label||element.name||step.label;
      const row={id:'default-'+backgroundCases,service_id:svc.id,label,_worshipSectionKey:worshipTemplateSectionKey(step.label||step.name,sectionIndex,step),memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formPresetDisabled:true})};
      const original=JSON.stringify(row);
      const hint=input(row);const wanted=normalizeServiceFormHint(expected.forms);
      check(hint.value==='' && (hint.placeholder===wanted || hint.placeholder==='T-'+wanted),'background default missing '+type+'/'+label+' '+hint.outerHTML);
      check(JSON.stringify(row)===original,'background default changed stored row');
      const plan=presenterServiceItemFormPreset({},row,null);
      check(normalizeServiceFormHint(plan.forms)===hint.placeholder,'background placeholder/playback mismatch '+type+'/'+label);
      check(!serviceElementConfigForSave({},parseServiceItemMemo(row.memo)).formPreset,'background persisted on save');
      const authored={...row};applyServiceItemMetadataField(authored,{dataset:{serviceItemField:'form_hint'},value:'C-V1'},svc);
      const authoredBefore=JSON.stringify(authored);
      check(input(authored).value==='C-V1' && presenterServiceItemFormPreset({},authored,null).forms.join('-')==='C-V1','authored sequence overwritten '+type+'/'+label);
      const projected=mergeTemplateProjectionMemo(serializeServiceItemMemo({formPreset:expected,formHint:wanted}),authored.memo);
      check(parseServiceItemMemo(projected).formHint==='C-V1','template projection overwrote manual form');
      check(JSON.stringify(authored)===authoredBefore,'authored source changed');
      const legacyAuto={...row,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formPreset:expected,formHint:wanted})};
      check(input(legacyAuto).value.endsWith(wanted),'existing stored sequence must be preserved even with legacy default strength');
      const uncertain={...row,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formPreset:{forms:['C','V1','C'],strength:'default'}})};
      check(input(uncertain).value.endsWith('C-V1-C'),'unmatched stored legacy form changed');
      backgroundCases++;
     }
     const scaffold=buildWorshipServiceScaffold(svc.id,type,{service:svc});
     check(scaffold.elements.every(e=>!e.config.formHint && !e.config.formPreset),'new scaffold materialized background defaults '+type);
    }
    check(backgroundCases>=20,'background matrix did not exercise templates');
    state.services=[service];
    song.metadata={presenter_form:{forms:['C','V1'],strength:'song-default'}};
    const registered={id:'registered',label:'찬양 1',_worshipSectionKey:'praise',song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    check(input(registered).value==='T-C-V1','registered main default filled');
    const linked={...registered,song_id:null,version_id:null};linkServiceItemToPraiseSong(linked,song,service);check(serviceItemFormHint(linked)==='T-C-V1','registered form copied on link');
    const sending={...registered,label:'파송찬양',_worshipSectionKey:'sending'};check(input(sending).value==='C-V1','registered sending form has no added Title');
    const hymn={...song,praise_types:['hymn'],metadata:{}};const hymnVersion={...version,praise_types:['hymn']};
    const score={...registered,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})};
    check(!presenterScoreFormSequence(score,hymn,hymnVersion).forms.includes('T'),'hymn score default Title');
    for(const [label,key] of [['특송','special_song'],['봉헌특송','offering']]) {
     const special={...score,label,_worshipSectionKey:key};
     const original=JSON.stringify(special);
     check(presenterScoreFormSequence(special,hymn,hymnVersion).forms[0]==='T','special hymn score default Title '+label);
     for(const mode of ['lyrics_db','score_db','manual_praise','audio_praise']) {
      special.memo=serializeServiceItemMemo({elementType:'praise',inputMode:mode,formPreset:{forms:['C','V1'],titleSequence:true,strength:'manual'}});
      check(presenterFormPresetWithDefaultTitle(parseServiceItemMemo(special.memo).formPreset,special,hymn,hymnVersion).forms.join('-')==='C-V1','authored omission overwritten '+mode);
     }
     special.memo=score.memo;
     check(JSON.stringify(special)===original,'special default mutated source');
     const secondary={...special,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',connectedPraise:{role:'secondary',groupId:'fixture'}})};
     check(!presenterDefaultTitleForServiceItem(secondary,hymn,hymnVersion,{score:true}),'connected secondary duplicate Title');
    }

    score.memo=serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',formPreset:{forms:['T','V1'],titleSequence:true}});
    check(presenterScoreFormSequence(score,hymn,hymnVersion).forms.join('-')==='T-V1','explicit score Title preserved');
    const scoreSong={...hymn,id:'score-song',hymn_no:9,versions:[{...hymnVersion,id:'score-version'}]};
    state.songs=[...state.songs,scoreSong];
    state.hymnScoreManifest={9:{title:'하늘에 가득 찬 영광의 하나님',slides:[
     {src:'v1-a.png',formLabel:'Verse 1'},{src:'v1-b.png',formLabel:'Verse 1'},
     {src:'c-a.png',formLabel:'Chorus'},{src:'v2-a.png',formLabel:'Verse 2'},{src:'c-b.png',formLabel:'Chorus'}]}};
    const scoreItem={...registered,song_id:scoreSong.id,version_id:'score-version',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})};
    const scoreBefore=JSON.stringify(scoreItem);
    check(input(scoreItem).value==='' && input(scoreItem).placeholder==='V1-C-V2-C','score asset forms are light defaults, repeated pages collapse');
    check(JSON.stringify(scoreItem)===scoreBefore,'score placeholder persisted data');
    applyServiceItemMetadataField(scoreItem,{dataset:{serviceItemField:'form_hint'},value:'title-v2'},service);
    check(input(scoreItem).value==='T-V2','authored score Title canonical T');
    applyServiceItemMetadataField(scoreItem,{dataset:{serviceItemField:'form_hint'},value:''},service);
    check(input(scoreItem).value==='' && input(scoreItem).placeholder==='V1-C-V2-C','cleared score restores light defaults');
    scoreItem.memo=serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',asset:{slides:[{url:'custom1.png',formLabel:'Verse 2'},{url:'custom2.png',formLabel:'Chorus'}]}});
    check(input(scoreItem).placeholder==='V2-C','explicit score assets own placeholder');
    scoreItem.memo=serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',asset:{slides:[{url:'custom1.png'}]}});
    const wholeBefore=JSON.stringify(scoreItem);
    check(input(scoreItem).value==='' && input(scoreItem).placeholder==='V-C','unlabelled score shows actual source form default');
    check(JSON.stringify(scoreItem)===wholeBefore && !serviceElementConfigForSave({},parseServiceItemMemo(scoreItem.memo)).formPreset,'whole-score default never persists');
    applyServiceItemMetadataField(scoreItem,{dataset:{serviceItemField:'form_hint'},value:'V-V'},service);
    check(input(scoreItem).value==='V-V','authored score sequence overrides whole-score placeholder');
    applyServiceItemMetadataField(scoreItem,{dataset:{serviceItemField:'form_hint'},value:''},service);
    check(input(scoreItem).value==='' && input(scoreItem).placeholder==='V-C','clearing score restores actual light forms');
    scoreItem.memo=serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',asset:{kind:'score',url:'https://example.invalid/score.pdf'}});
    const fileScore={...scoreItem,song_id:null,version_id:null,_worshipSectionKey:'offering'};
    check(input(fileScore).value==='' && input(fileScore).placeholder==='송폼','unlinked score file must not invent V');
    const noScore={...scoreItem,song_id:null,version_id:null,raw_title:'',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})};
    check(!input(noScore).placeholder.split('-').includes('V'),'missing score never invents content default');
    for(const [kinds,wanted] of [[['Verse','Coda'],'V-Coda'],[['Verse'],'V'],[['Lyrics'],'Lyrics']]) {
      const vv={id:'real-score-version',name:'새찬송가',praise_types:['hymn'],forms:kinds.map((part_type,i)=>({id:'part-'+i,part_type,lyrics:'검증 가사'}))};
      const ss={id:'real-score',title:'단일 구성 악보',praise_types:['hymn'],versions:[vv],_relationalVersionsLoaded:true};state.songs=[ss];
      const row={id:'real-score-row',song_id:ss.id,version_id:vv.id,label:'찬양 1',_worshipSectionKey:'praise',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',formPresetDisabled:true,asset:{slides:[{url:'one.png'},{url:'two.png'}]}})};
      const original=JSON.stringify({row,ss});
      check(input(row).value==='' && input(row).placeholder===wanted,'actual single-score structure '+wanted+' '+input(row).outerHTML);
      check(JSON.stringify({row,ss})===original,'score source changed');
      ss.metadata={presenter_form:{forms:['C','V'],titleSequence:true}};
      check(input(row).value==='C-V' && presenterScoreFormSequence(row,ss,vv).forms.join('-')==='C-V','registered form must remain editable and authoritative after clear');
    }
    return 'PASS empty placeholder, default scope, content headings, linking, authored input, clear/save and registered forms';
   }'''),flush=True);browser.close()
finally:server.shutdown();server.server_close()
