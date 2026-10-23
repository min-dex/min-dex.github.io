"""Isolated Title sequence editing/reopen; no output window or production writes."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=browser.new_page(viewport={'width':1280,'height':900})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof applyServiceItemMetadataField==='function' && !document.body.classList.contains('ui-booting')")
   result=page.evaluate('''() => {
    const check=(ok,message)=>{if(!ok)throw Error(message)};
    const version={id:'title-version',name:'기본',_worshipVersionPersisted:true,praise_types:['ccm'],forms:[
      {id:'verse',part_type:'Verse',part_number:1,lyrics:'첫째 줄\\n\\n홀로 있는 줄\\n\\n세 줄\\n둘째\\n셋째'},
      {id:'chorus',part_type:'Chorus',lyrics:'후렴 가사'}]};
    const song={id:'title-song',_relationalVersionsLoaded:true,title:'제목 순서 검증',praise_types:['ccm'],versions:[version]};
    const item={id:'title-item',label:'찬양',raw_title:song.title,song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'T-V1-C',formPreset:{forms:['T','V1','C'],strength:'manual',titleSequence:true}})};
    const section={sectionKey:'praise',sectionLabel:'찬양'};
    const render=()=>{const plan=presenterFormPlanForServiceItem(version,item,song);check(!plan.warnings.length,JSON.stringify(plan.warnings));let slides=presenterLyricsSlidesForServiceItem({item,section,index:0,song,version,displayText:song.title,label:item.label,forms:plan.forms,formWarnings:plan.warnings});return slides;};
    const before=JSON.stringify({item,version});
    const legacy=render();check(legacy[0].type==='song-title','authored leading title retained');check(legacy.length===5,'authored paragraphs preserved');
    check(before===JSON.stringify({item,version}),'read did not migrate data');
    for(const raw of ['t','T','title','TITLE',' Title ']) check(normalizeServiceFormHint(raw+' - Verse 1 - Tags')==='T-V1-Tags','normalization');
    check(canonicalServiceFormToken('T')==='T' && canonicalServiceFormToken('Tag')==='Tag','Tag unchanged');
    const legacyTitle={id:'saved-title',type:'song-title',formKey:'title:0',formLabel:'Title',marker:'Title'};
    const oldTitleBefore=JSON.stringify(legacyTitle);
    check(presenterFormGroupLabel(legacyTitle)==='Title','legacy Title thumbnail label');
    check(presenterProgressionPlan(item,[legacyTitle]).groups[0].label==='T','legacy Title photo placement label');
    check(JSON.stringify(legacyTitle)===oldTitleBefore,'legacy Title display rewrote slide');
    const edit=value=>applyServiceItemMetadataField(item,{dataset:{serviceItemField:'form_hint'},value},{});
    check(serviceItemEffectiveFormHint(item)==='T-V1-C','legacy sequence exposes title');
    for(const label of ['파송찬양','마침찬양','결단찬양']) {
      const title=presenterSongTitleSlide({...item,label},{sectionKey:'response_song'},song,version,song.title,0);
      check(title.type==='title-assignee' && title.formLabel==='T' && title.contentTitle==='♪ '+song.title,'order/content title for '+label);
    }
    const fresh={...item};
    applyServiceItemMetadataField(fresh,{dataset:{serviceItemField:'form_hint'},value:'V1-C'},{});
    check(presenterFormPlanForServiceItem(version,fresh,song).forms.every(f=>!f._presenterTitle),'first edit can omit Title');
    const withoutTitle=presenterLyricsSlidesForServiceItem({item:fresh,section,index:0,song,version,displayText:song.title,label:fresh.label,forms:presenterFormPlanForServiceItem(version,fresh,song).forms,formWarnings:[]});
    check(legacy.filter(s=>s.type!=='song-title').map(s=>s.formKey).join('|')===withoutTitle.map(s=>s.formKey).join('|'),'Title shifts existing content keys');
    check(presenterProgressionPlan(item,legacy).signature===presenterProgressionPlan(item,withoutTitle).signature,'Title invalidates existing photo placement');
    edit('v1 - t - c - T');
    let slides=render();check(slides.map(s=>s.type).join(',')==='lyrics,lyrics,lyrics,song-title,lyrics,song-title','middle/repeated title order');
    check(new Set(slides.map(s=>s.id)).size===slides.length,'unique slide IDs');
    check(parseServiceItemMemo(item.memo).formHint==='V1-T-C-T','stored canonical input');
    item.memo=serializeServiceItemMemo(parseServiceItemMemo(item.memo));check(render().length===6,'reopen preserves title order');
    edit('V1-C');check(render().every(s=>s.type==='lyrics'),'removed Title stays removed');
    check(parseServiceItemMemo(item.memo).formPreset.titleSequence,'explicit mode survives deletion');
    item.memo=serializeServiceItemMemo(parseServiceItemMemo(item.memo));check(render().length===4,'reopen after removal');
    edit('T');check(render().length===1 && render()[0].type==='song-title','title only');
    edit('');check(serviceItemEffectiveFormHint(item)==='', 'clear restores default placeholder');
    const config=serviceElementConfigForSave({},parseServiceItemMemo(item.memo));
    check(!config.formPreset && config.formPresetDisabled,'empty input stores no inferred sequence');
    const reopened=groupWorshipElements([{id:'sec',service_id:'svc',title:'찬양',section_key:'praise'}],[{id:'el',section_id:'sec',title:song.title,element_type:'praise',config}]).svc[0];
    check(!parseServiceItemMemo(reopened.memo).formPreset,'empty input DB readback');
    check(!parseServiceItemMemo(mergeTemplateProjectionMemo('',reopened.memo)).formPreset,'empty template projection');
    const unsplit=[{id:'raw',part_type:'Lyrics',lyrics:'한 줄\\n\\n세 줄\\n둘째\\n셋째'}];
    const resolved=resolvePresenterFormPresetSequence(unsplit,['T','V1','T','C']);
    check(resolved.items.length===4 && resolved.items[1].lyrics==='한 줄' && resolved.items[3].lyrics==='세 줄\\n둘째\\n셋째','Title never consumes unsplit lyrics');
    const sources=[{url:'v1.png',formLabel:'V1'},{url:'c.png',formLabel:'C'}];
    edit('V1-T-C-T');
    const score=presenterScoreImageSourcesForFormSequence(sources,presenterScoreFormsFromImageSources(sources),[],item,song,version);
    check(score.imageSources.map(s=>s._presenterTitle?'T':s.url).join(',')==='v1.png,T,c.png,T','score title order');
    const unlabelled=presenterScoreImageSourcesForFormSequence(sources.map(({url})=>({url})),[],[],item,song,version);
    check(unlabelled.imageSources.map(s=>s._presenterTitle?'T':s.url).join(',')==='v1.png,c.png,T' && unlabelled.imageSources[0].titleSequenceWarning,'unlabelled score retains every page and warns on ambiguous middle Title');
    edit('T-V1-C-T');
    const manyPages=[...sources,{url:'extra.png'}].map(({url})=>({url}));
    const unchangedDeck=presenterScoreImageSourcesForFormSequence(manyPages,[],[],item,song,version);
    check(unchangedDeck.imageSources.map(s=>s._presenterTitle?'T':s.url).join(',')==='T,v1.png,c.png,extra.png,T','unlabelled deck pages retained between titles');
    const portable=serializePortableServiceSourceItem({label:'찬양',value:song.title,formHint:'V1-C',titleSequence:true,asset:{},audio:{}});
    check(parsePortableServiceSourceText(portable.join('\\n'))[0].titleSequence,'portable source preserves explicit title mode');
    edit('T-V1-Int-C');
    const interlude=render().find(s=>s.type==='blank');
    check(interlude && interlude.text==='' && interlude.layout===PRESENTER_SLIDE_LAYOUTS.BLANK,'interlude output must stay blank');
    const annotated=annotatePresenterFormStarts([{slide:interlude,slideIndex:3}]).entries;
    const interludeHtml=renderPresenterBoardSlideBlocks(annotated,-1,'fixture');
    check(interludeHtml.includes('        Interlude') && interludeHtml.includes('data-form-plain="true"'),'real blank interlude caption missing '+JSON.stringify({interlude,annotated,interludeHtml}));
    for(const alias of ['Int','Interlude','Instrumental','간주']) check(presenterFormGroupLabel({formLabel:alias})==='Interlude','interlude alias '+alias);
    check(normalizeServiceFormHint('Interlude')==='Int','canonical interlude input changed');
    const ordinaryBlank={...interlude,formLabel:'',title:'빈 화면',marker:''};
    check(!presenterSlideSupportsFormGrouping(ordinaryBlank),'ordinary blank gained form caption');
    check(presenterFormGroupLabel(presenterElementTrailingBlankSlide(interlude,0))==='','trailing blank inherited interlude caption');
    const manualInterlude={...item,song_id:null,version_id:null,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',slides:['첫 화면','후렴'],formPreset:{forms:['V1','Int','C'],titleSequence:true,strength:'manual'}})};
    const manualBlank=buildPresenterCustomSlides(manualInterlude,section,0).find(s=>s.type==='blank');
    check(manualBlank && presenterFormGroupLabel(manualBlank)==='Interlude' && manualBlank.text==='','direct interlude caption/output');
    edit('T-V1-C');slides=render();
    const service={id:'title-service',type_id:'fixture',date:'2026-10-25',title:'격리 검증'};
    item.service_id=service.id;item.sort_order=1;
    state.songs=[song];state.services=[service];state.serviceItems={[service.id]:[item]};
    state.module='presenter';state.selectedServiceId=service.id;state.serviceTypes=[{id:'fixture',name:'청년부 예배'}];
    state.client=state.client||{};state.auth.session={user:{id:'offline'}};state.connectionError='';state.serviceError='';
    state.presenter.serviceId=service.id;state.presenter.slides=slides;state.presenter.index=0;
    publishPresenterState=()=>{};
    const full=buildPresenterSlidesForServiceItem(item,service,0);
    check(full.filter(s=>s.formLabel==='T').length===1,'actual builder Title count '+JSON.stringify(full.map(s=>s.type)));
    check(full.filter(s=>s.type==='lyrics').length===4,'actual builder lyrics');
    document.body.dataset.module='presenter';document.body.dataset.theme='dark';
    const host=document.createElement('main');host.style.cssText='padding:24px;width:100%;background:var(--bg)';
    host.innerHTML=renderServiceFormHintInput(item,0)+renderPresenterSlideBoard(full,0,service.id);
    document.body.replaceChildren(host);
    const direct={...item,song_id:null,version_id:null,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',slides:['직접 한 줄','직접 두 줄\\n둘째 줄'],formPreset:{forms:['V1','T','C'],titleSequence:true,strength:'manual'}})};
    const directSlides=buildPresenterCustomSlides(direct,section,0);
    check(directSlides.length===3 && directSlides[1].formLabel==='T' && directSlides[2].text==='직접 두 줄\\n둘째 줄','direct slide boundaries');
    for(const inputMode of ['manual_praise','audio_praise']) {
      for(const [label,key,wanted] of [['찬양 1','praise',1],['특송','special_song',1],['봉헌찬송','offering',0],['결단찬양','response_song',0]]) {
        const directItem={id:`direct-${inputMode}-${key}`,label,raw_title:'직접 입력 제목',_worshipSectionKey:key,memo:serializeServiceItemMemo({elementType:'praise',inputMode,slides:['첫 화면','둘째 화면'],formPresetDisabled:true,formPreset:{titleSequence:true}})};
        const original=JSON.stringify(directItem);const directSection={sectionKey:key,sectionTitle:label};
        const output=buildPresenterCustomSlides(directItem,directSection,0);
        check(output.filter(s=>s.type==='song-title').length===wanted,'direct title restored '+inputMode+'/'+label);
        check(output.filter(s=>s.type==='lyrics').map(s=>s.text).join('|')==='첫 화면|둘째 화면','direct page boundaries preserved');
        const entries=annotatePresenterFormStarts(output.map((slide,slideIndex)=>({slide,slideIndex}))).entries;
        const blocks=presenterBoardSlideBlocks(entries);check(blocks.filter(b=>b.key).every(b=>b.label==='Title'),'unlabelled direct pages received form boxes');
        const html=renderPresenterBoardSlideBlocks(entries,0,service.id);check(!html.includes('data-form-color'),'unlabelled direct pages received colored backgrounds');
        check(JSON.stringify(directItem)===original,'direct data rewritten');
      }
    }
    const generic={id:'generic',elementType:PRESENTER_ELEMENT_TYPES.PRAISE,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,type:'lyrics',formKey:'lyrics:1',formLabel:'Lyrics',text:'가사'};
    check(!presenterSlideSupportsFormGrouping(generic),'generic Lyrics is not a form distinction');
    const named={...generic,formLabel:'Verse',formKey:'verse:1'};
    check(presenterSlideSupportsFormGrouping(named),'real form grouping lost');
    const scorePage={...generic,formLabel:'',sourceType:'score'};
    check(presenterSlideSupportsFormGrouping(scorePage),'score grouping eligibility lost');
    const scoreDeck=[{...scorePage,id:'score-a',elementId:'score-owner',formKey:'raw-score-key'},{...scorePage,id:'score-b',elementId:'score-owner',formKey:''}];
    const scoreEntries=annotatePresenterFormStarts(scoreDeck.map((slide,slideIndex)=>({slide,slideIndex}))).entries;
    check(presenterBoardSlideBlocks(scoreEntries).length===1 && presenterBoardSlideBlocks(scoreEntries)[0].entries.length===2,'unlabelled score must be one whole-score block');
    scoreDeck[0].formLabel='Verse';
    const namedScore=annotatePresenterFormStarts(scoreDeck.map((slide,slideIndex)=>({slide,slideIndex}))).entries;
    check(presenterBoardSlideBlocks(namedScore).length===1 && presenterBoardSlideBlocks(namedScore)[0].entries.length===2,'inherited score group lost');

    check(JSON.stringify(version)===JSON.stringify(JSON.parse(before).version),'source forms unchanged');
    return {types:slides.map(s=>s.type),sourceUntouched:true};
   }''')
   page.screenshot(path=f'/tmp/title-songform-{engine}.png',full_page=True)
   print(engine,'PASS',result,flush=True);browser.close()
finally:server.shutdown();server.server_close()
