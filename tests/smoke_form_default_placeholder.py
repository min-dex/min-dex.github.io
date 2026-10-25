"""Metadata and inference are placeholders; service declarations and item input stay exact."""
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
    const version={id:'v',name:'기본',_worshipVersionPersisted:true,praise_types:['ccm'],forms:[{id:'verse',part_type:'Verse',part_number:1,lyrics:'첫 절'},{id:'chorus',part_type:'Chorus',lyrics:'후렴'}]};
    const song={id:'s',title:'기본 송폼 검증',praise_types:['ccm'],versions:[version],_relationalVersionsLoaded:true};
    state.songs=[song];
    const service={id:'svc',type_id:'fixture',date:'2000-01-01'};state.services=[service];
    const input=item=>{const host=document.createElement('div');host.innerHTML=renderServiceFormHintInput(item,0);return host.querySelector('input.svc-form-hint')};
    const native={...song,id:'SONG-CONT-0001-0001',_singleSongRecord:true,versions:[{...version,id:'SONG-CONT-0001-0001',_singleSongRecord:true}]};
    state.songs=[native];
    const nativeItem={id:'native',service_id:service.id,song_id:native.id,label:'찬양 1',raw_title:native.title,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    const nativeBefore=JSON.stringify({native,nativeItem});
    check(serviceItemLinkedVersion(nativeItem)===native.versions[0],'native content resolves without legacy version id');
    check(input(nativeItem).placeholder==='T-V-C','native inferred form must include lyrics, not only T');
    const picker=document.createElement('div');picker.innerHTML=renderServiceSongVersionPicker(nativeItem,0,serviceItemEditorModel(nativeItem,{service}));
    check(picker.querySelector('select').value===native.id&&picker.querySelector('select').dataset.serviceItemField==='praise_record_id'&&!picker.querySelector('[aria-invalid]'),'native picker must keep current record without legacy version warning');
    check(JSON.stringify({native,nativeItem})===nativeBefore,'native read must preserve record and worship input');
    const authored={...nativeItem,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'C-V1-C'})};
    check(input(authored).value==='C-V1-C','authored native form remains authoritative');
    const noMatch={...native,versions:[{...version,id:'other'}]};
    check(serviceItemLinkedVersion(nativeItem,noMatch)===null,'never borrow another record content');
    state.songs=[song];
    check(serviceItemLinkedVersion({...nativeItem,song_id:song.id},song)===null,'legacy unresolved selection remains unresolved');
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
    for(const [label,key] of [['입례찬양','praise'],['입례 찬양','praise'],['입례찬양','entrance_praise'],['성경봉독 전 찬양','pre_scripture_praise'],['봉헌찬송','offering'],['봉헌찬양','offering'],['결단찬양','response_song'],['기도찬양','prayer_meeting_praise'],['송영','sending'],['파송찬양','sending'],['폐회찬송','closing_visual']]) {
     for(const mode of ['lyrics_db','score_db','manual_praise','audio_praise']) {
      for(const sequence of [null,['T','V1','C'],['V1','T','C']]) {
       const direct=['manual_praise','audio_praise'].includes(mode);
       state.songs=[mode==='score_db'?{...song,hymn_no:'9',praise_types:['hymn'],versions:[{...version,name:'새찬송가',hymn_no:'9',praise_types:['hymn']}]}:song];
       const expectedTitle=(mode==='score_db'?'9 ':'')+song.title;
       const item={id:'content-'+label+'-'+mode,service_id:service.id,label,_worshipSectionKey:key,raw_title:song.title,
        song_id:direct?null:song.id,version_id:direct?null:version.id,_worshipElementTemplateModified:true,
        memo:serializeServiceItemMemo({elementType:'praise',inputMode:mode,outputMode:mode==='score_db'?'score':'lyrics',
         ...(direct?{slides:['첫 절','후렴']}:{}),
         ...(mode==='score_db'?{asset:{kind:'score',slides:[{url:'/assets/icon-192.png',formLabel:'V1'},{url:'/assets/icon-512.png',formLabel:'C'}]}}:{}),
         ...(sequence?{formPreset:{forms:sequence,titleSequence:true,strength:'manual'}}:{})})};
       const original=JSON.stringify(item),slides=buildPresenterSlidesForServiceItem(item,service,0,{allowHydration:false});
       const headings=slides.filter(slide=>slide.orderTitle && slide.contentTitle);
       check(headings.length===1 && headings[0].contentTitle==='♬ '+expectedTitle,'content heading missing/duplicate '+label+'/'+mode+'/'+sequence);
       check(!slides.some(slide=>slide.type==='song-title'),'non-main got main Title '+label+'/'+mode+'/'+sequence+' '+JSON.stringify(slides.map(s=>({type:s.type,label:s.label,sectionKey:s.sectionKey,sectionRole:s.sectionRole,order:s.orderTitle,content:s.contentTitle,form:s.formLabel,reason:s.missingReason}))));
       check(!sequence || headings[0].formLabel==='T','authored T identity lost');
       if(!sequence)check(!headings[0].formLabel && !input(item).placeholder.startsWith('T-'),'implicit T added to liturgical praise '+label);
       for(const noChromakey of [false,true]) {
        const html=renderPresenterSlideFrame(headings[0],{noChromakey});
        const host=document.createElement('div');host.innerHTML=html;
        const expectedNote='♬',otherNote='♪';
        check(host.textContent.includes(expectedTitle)&&host.textContent.includes(expectedNote)&&!host.textContent.includes(otherNote),'all song title roles use shared note '+label+'/'+mode+'/'+sequence+'/'+noChromakey);
        check(noChromakey ? html.includes('presenter-fullscreen-song-heading')&&html.includes('presenter-slide--fullscreen-song-title')&&!html.includes('presenter-slide--song-note-title') : html.includes('presenter-title-assignee--order-content'),'order/content output lost '+label+'/'+mode+'/'+sequence+'/'+noChromakey);
        const preview=normalizePresenterMiniPreviewSlide({...headings[0],outputContext:noChromakey?'clean':'chromakey'},!noChromakey);
        check(preview.type===headings[0].type && renderPresenterTitleAssigneeSlide(preview)===renderPresenterTitleAssigneeSlide(headings[0]),'preview/output title mismatch '+label+'/'+mode+'/'+noChromakey+' '+JSON.stringify({preview,original:headings[0]}));
       }
       check(JSON.stringify(item)===original,'content heading rewrote data');
      }
     }
    }
    state.songs=[song];
    const mainTitle=presenterSongTitleSlide({id:'main-title',label:'찬양 1'},{sectionKey:'praise'},song,version,song.title,0);
    const keyed=renderPresenterSlideFrame(mainTitle,{noChromakey:false}),full=renderPresenterSlideFrame(mainTitle,{noChromakey:true});
    check(keyed.includes('>♬</span>') && !keyed.includes('♪'),'authored Title uses double note in chromakey');
    check(full.includes('aria-label="찬양">♬</span>') && !full.includes('♪'),'separate fullscreen note changed');
    const oldContent={...presenterOrderContentTitleSlide({label:'결단찬양'},{sectionKey:'response_song'},0,'결단찬양','♪ '+song.title),songTitle:song.title};
    const oldBefore=JSON.stringify(oldContent),oldFull=renderPresenterSlideFrame(oldContent,{noChromakey:true});
    const oldHost=document.createElement('div');oldHost.innerHTML=oldFull;
    check(JSON.stringify(oldContent)===oldBefore&&oldHost.textContent.includes('♬')&&!oldHost.textContent.includes('♪'),'legacy content note normalization is view-only');
    check(oldFull.includes('presenter-fullscreen-song-heading')&&oldHost.textContent.includes(song.title)&&!oldFull.includes('presenter-slide--song-note-title'),'old order/content snapshot must restore standard fullscreen composition');
    const fullTitleHost=document.createElement('main');fullTitleHost.className='presenter-output-root no-chromakey';
    fullTitleHost.style.cssText='position:fixed;left:0;top:0;margin:0;width:1920px;height:1080px;transform:none';
    fullTitleHost.innerHTML=oldFull;document.body.append(fullTitleHost);fitPresenterSongTitleText(fullTitleHost);
    const fullTitle=fullTitleHost.querySelector('.presenter-title-content-title'),fullHeading=fullTitleHost.querySelector('.presenter-fullscreen-song-heading');
    const stageBounds=fullTitleHost.getBoundingClientRect(),titleBounds=fullTitle.getBoundingClientRect(),headingBounds=fullHeading.getBoundingClientRect();
    const glyphRange=document.createRange();glyphRange.selectNodeContents(fullTitle);const glyphBounds=glyphRange.getBoundingClientRect();
    check(Math.abs((glyphBounds.left+glyphBounds.right-stageBounds.left-stageBounds.right)/2)<2,'fullscreen content glyphs must center');
    check(headingBounds.bottom<=titleBounds.top+1 && Math.abs((titleBounds.top+titleBounds.bottom-stageBounds.top-stageBounds.bottom)/2)<108,'fullscreen order heading above centered title');
    check(parseFloat(getComputedStyle(fullTitle).fontSize)===150,'short fullscreen content title must retain original scale');
    fullTitleHost.remove();
    for(const slide of [mainTitle,oldContent])for(const noChromakey of [true,false]){
     const stage=document.createElement('main');stage.className='presenter-output-root'+(noChromakey?' no-chromakey':'');
     stage.innerHTML=renderPresenterSlideFrame(slide,{noChromakey});document.body.append(stage);
     const note=stage.querySelector('.presenter-song-note'),heading=stage.querySelector('.presenter-slide--song-note-title .presenter-fullscreen-song-heading');
     if(note){
      const ratio=parseFloat(getComputedStyle(note).fontSize)/parseFloat(getComputedStyle(note.parentElement).fontSize);
      check(Math.abs(ratio-.80)<.005,'inline note ratio '+noChromakey+' '+ratio);
     }else check(heading,'song note markup missing '+slide.type+' '+noChromakey);
     if(heading){
      const ratio=parseFloat(getComputedStyle(heading).fontSize)/parseFloat(getComputedStyle(stage.querySelector('.presenter-title-content-title')).fontSize);
      check(Math.abs(ratio-.80)<.005,'separate note ratio '+ratio);
     }
     stage.remove();
    }
    const proxyCache=new WeakMap();
    const readOnly=value=>{
     if(!value||typeof value!=='object')return value;
     if(proxyCache.has(value))return proxyCache.get(value);
     const proxy=new Proxy(value,{
      get:(target,key)=>readOnly(Reflect.get(target,key)),
      set:()=>{throw Error('render attempted to edit source worship data')},
      deleteProperty:()=>{throw Error('render attempted to delete source worship data')},
     });proxyCache.set(value,proxy);return proxy;
    };
    const protectedData={formPreset:{forms:['T','L','Int','L'],titleSequence:true},audioTiming:{startTimes:[0,12,24]},song_id:'keep-song',version_id:'keep-version',sort_order:30,lyrics:'보존할 가사'};
    const protectedSlides=[oldContent,mainTitle,{...oldContent,songTitle:'기본 송폼 검증'},
     {...oldContent,assignee:'이름 집사'},
     {...mainTitle,layout:PRESENTER_SLIDE_LAYOUTS.BLANK,type:'blank',autoTrailingBlank:true},
     {type:'lyrics',elementType:PRESENTER_ELEMENT_TYPES.PRAISE,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,text:'보존할 가사'}];
    for(const raw of protectedSlides){
     const source={...raw,preservedConfig:structuredClone(protectedData)},before=JSON.stringify(source),locked=readOnly(source);
     for(const noChromakey of [false,true]){
      const options=readOnly({noChromakey,presentationDesign:{sectionKeys:[],songTitleStyle:'note-title'}});
      const view=presenterFullscreenSongTitleView(locked,options);
      check(presenterFullscreenSongTitleView(view,options)===view,'display conversion must be idempotent');
      const rendered=renderPresenterSlideFrame(locked,options);
      check(rendered===renderPresenterSlideFrame(locked,options),'repeat rendering must be stable');
      check(JSON.stringify(source)===before,'render changed saved links/forms/lyrics/timing/order');
      if(view!==locked&&locked.songTitleContent){
       check(view.songTitleContent!==locked.songTitleContent,'view must not share editable title metadata');
       view.songTitleContent.title='view only';check(JSON.stringify(source)===before,'editing derived title changed source');
      }
     }
    }
    const imported={id:'source-praise',label:'찬양 4',_worshipSectionKey:'source-찬양',_worshipSectionTitle:'찬양',song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-C',formPreset:{forms:['V1','C'],strength:'manual'}})};
    const importedBefore=JSON.stringify(imported);
    check(isMainPraiseServiceItem(imported) && input(imported).value==='V1-C','stored source praise form stays exact');
    check(!presenterFormPlanForServiceItem(version,imported,song).forms.some(f=>f._presenterTitle),'stored form receives no inferred T');
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
      check(hint.value===wanted && hint.placeholder==='송폼','background default missing '+type+'/'+label+' '+hint.outerHTML);
      check(JSON.stringify(row)===original,'background default changed stored row');
      const plan=presenterServiceItemFormPreset({},row,null);
      check(normalizeServiceFormHint(plan.forms)===hint.value,'background placeholder/playback mismatch '+type+'/'+label);
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
    const emptyDefaultItem={id:'empty-default',label:'찬양 2',_worshipSectionKey:'praise',song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    version.forms.splice(1,0,{id:'prechorus',part_type:'Pre-Chorus',lyrics:'프리코러스'});
    song.metadata={presenter_form:{strength:'song-default'}};
    const emptyBefore=JSON.stringify({song,item:emptyDefaultItem});
    check(input(emptyDefaultItem).value==='' && input(emptyDefaultItem).placeholder==='T-V-PC-C','empty registered preset must not become title-only');
    const emptyPlan=presenterFormPlanForServiceItem(version,emptyDefaultItem,song);
    check(emptyPlan.forms.map(f=>f._presenterTitle?'T':f.id).join(',')==='T,verse,prechorus,chorus','empty metadata keeps complete playback');
    check(JSON.stringify({song,item:emptyDefaultItem})===emptyBefore,'empty preset read mutated data');
    const emptyLinked={...emptyDefaultItem,song_id:null,version_id:null};
    linkServiceItemToPraiseSong(emptyLinked,song,service);
    check(!parseServiceItemMemo(emptyLinked.memo).formPreset,'empty default copied phantom Title on linking');
    applyServiceItemMetadataField(emptyDefaultItem,{dataset:{serviceItemField:'form_hint'},value:'T'},service);
    check(input(emptyDefaultItem).value==='T' && presenterFormPlanForServiceItem(version,emptyDefaultItem,song).forms.length===1,'intentional title-only must remain');
    version.forms.splice(1,1);
    song.metadata={presenter_form:{forms:['C','V1'],strength:'song-default'}};
    const registered={id:'registered',label:'찬양 1',_worshipSectionKey:'praise',song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    check(input(registered).value==='' && input(registered).placeholder==='C-V1','registered main default filled');
    const linked={...registered,song_id:null,version_id:null};linkServiceItemToPraiseSong(linked,song,service);check(serviceItemFormHint(linked)==='' && input(linked).value==='' && input(linked).placeholder==='C-V1','registered source must not become a manual copy on link');
    const sending={...registered,label:'파송찬양',_worshipSectionKey:'sending'};check(input(sending).value==='' && input(sending).placeholder==='C-V1','registered sending form has no added Title');
    const hymn={...song,praise_types:['hymn'],metadata:{}};const hymnVersion={...version,praise_types:['hymn']};
    const score={...registered,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})};
    check(!presenterScoreFormSequence(score,hymn,hymnVersion).forms.includes('T'),'hymn score default Title');
    for(const [label,key] of [['특송','special_song'],['봉헌특송','offering']]) {
     const special={...score,label,_worshipSectionKey:key};
     const original=JSON.stringify(special);
     check(presenterScoreFormSequence(special,hymn,hymnVersion).forms[0]==='T','declared special hymn rule must explicitly include T '+label);
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
    // Both declared sources exist: the service-specific arrangement wins.
    const declaredService={id:'declared-service',type_id:'young-adult',date:'2026-10-25'};state.services=[declaredService];
    const declaredItem={id:'declared-item',service_id:declaredService.id,label:'파송찬양',_worshipSectionKey:'sending',song_id:song.id,version_id:version.id,
      memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formPresetDisabled:true})};
    song.metadata={presenter_form:{forms:['C','V1'],strength:'song-default'}};
    check(presenterServiceItemDeclaredFormSource(declaredItem,song,version).kind==='service' && input(declaredItem).value==='V-C1-C2','service arrangement must outrank metadata');
    applyServiceItemMetadataField(declaredItem,{dataset:{serviceItemField:'form_hint'},value:'C-T-V1'},declaredService);
    check(input(declaredItem).value==='C-T-V1' && presenterServiceItemFormPreset(version,declaredItem,song).forms.join('-')==='C-T-V1','manual wins and keeps middle T');
    applyServiceItemMetadataField(declaredItem,{dataset:{serviceItemField:'form_hint'},value:''},declaredService);
    check(input(declaredItem).value==='V-C1-C2','clearing manual returns to declared service value');
    const rule={when:{songType:'ccm'},formPreset:{forms:['V1','C'],strength:'default'}};
    const custom={...registered,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formPresetDisabled:true,formPresetRules:[rule]})};
    check(input(custom).value==='V1-C','declared item rule must be a real value');
    const savedRule=serviceElementConfigForSave({},parseServiceItemMemo(custom.memo));
    check(savedRule.formPresetRules.length===1 && !savedRule.formPreset,'clear override must preserve declared rule on save');
    const projectedRule=mergeTemplateProjectionMemo('',custom.memo);
    check(parseServiceItemMemo(projectedRule).formPresetRules.length===1,'template projection must preserve cleared item rules');
    const sourceOnly={...registered,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};
    song.metadata={presenter_form:{forms:['C','T','V1'],strength:'song-default'}};
    check(input(sourceOnly).value==='' && input(sourceOnly).placeholder==='C-T-V1' && presenterServiceItemFormPreset(version,sourceOnly,song).forms.join('-')==='C-T-V1','metadata T position must remain exact');
    for(const inputMode of ['manual_praise','audio_praise'])for(const label of ['찬양 1','특송']) {
     const direct={id:'direct-owner',label,raw_title:'직접 제목',_worshipSectionKey:label==='특송'?'special_song':'praise',
       memo:serializeServiceItemMemo({elementType:'praise',inputMode,slides:['첫 화면','후렴'],formPreset:{forms:['V1','C'],strength:'manual'}})};
     const before=JSON.stringify(direct),slides=buildPresenterCustomSlides(direct,{sectionKey:direct._worshipSectionKey},0);
     check(!slides.some(s=>s.type==='song-title') && slides.length===2,'direct stored form gained inferred T '+label+'/'+inputMode);
     check(JSON.stringify(direct)===before,'direct stored sequence rewritten');
    }
    song.metadata={};state.services=[service];
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
    for(const [kinds,wanted] of [[['Verse','Coda'],'V-Coda'],[['Verse'],'V'],[['Lyrics'],'L']]) {
      const vv={id:'real-score-version',name:'새찬송가',praise_types:['hymn'],forms:kinds.map((part_type,i)=>({id:'part-'+i,part_type,lyrics:'검증 가사'}))};
      const ss={id:'real-score',title:'단일 구성 악보',praise_types:['hymn'],versions:[vv],_relationalVersionsLoaded:true};state.songs=[ss];
      const row={id:'real-score-row',song_id:ss.id,version_id:vv.id,label:'찬양 1',_worshipSectionKey:'praise',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',formPresetDisabled:true,asset:{slides:[{url:'one.png'},{url:'two.png'}]}})};
      const original=JSON.stringify({row,ss});
      check(input(row).value==='' && input(row).placeholder===wanted,'actual single-score structure '+wanted+' '+input(row).outerHTML);
      check(JSON.stringify({row,ss})===original,'score source changed');
      ss.metadata={presenter_form:{forms:['C','V'],titleSequence:true}};
      check(input(row).value==='' && input(row).placeholder==='C-V' && presenterScoreFormSequence(row,ss,vv).forms.join('-')==='C-V','registered form must remain editable and authoritative after clear');
    }
    return 'PASS empty placeholder, default scope, content headings, linking, authored input, clear/save and registered forms';
   }'''),flush=True);browser.close()
finally:server.shutdown();server.server_close()
