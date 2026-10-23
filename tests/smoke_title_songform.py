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
    const item={id:'title-item',label:'찬양',raw_title:song.title,song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-C',formPreset:{forms:['V1','C'],strength:'manual'}})};
    const section={sectionKey:'praise',sectionLabel:'찬양'};
    const render=()=>{const plan=presenterFormPlanForServiceItem(version,item,song);check(!plan.warnings.length,JSON.stringify(plan.warnings));let slides=presenterLyricsSlidesForServiceItem({item,section,index:0,song,version,displayText:song.title,label:item.label,forms:plan.forms,formWarnings:plan.warnings});if(shouldIncludeSongTitleSlide(item,item.label,song,version))slides.unshift(presenterSongTitleSlide(item,section,song,version,song.title,0));return slides;};
    const before=JSON.stringify({item,version});
    const legacy=render();check(legacy[0].type==='song-title','legacy title retained');check(legacy.length===5,'authored paragraphs preserved');
    check(before===JSON.stringify({item,version}),'read did not migrate data');
    for(const raw of ['t','T','title','TITLE',' Title ']) check(normalizeServiceFormHint(raw+' - Verse 1 - Tags')==='Title-V1-Tags','normalization');
    check(canonicalServiceFormToken('T')==='Title' && canonicalServiceFormToken('Tag')==='Tag','Tag unchanged');
    const edit=value=>applyServiceItemMetadataField(item,{dataset:{serviceItemField:'form_hint'},value},{});
    check(serviceItemEffectiveFormHint(item)==='Title-V1-C','legacy sequence exposes title');
    for(const label of ['파송찬양','마침찬양','결단찬양']) {
      const title=presenterSongTitleSlide({...item,label},{sectionKey:'response_song'},song,version,song.title,0);
      check(title.type==='song-title' && title.formLabel==='Title','uniform title for '+label);
    }
    const fresh={...item};
    applyServiceItemMetadataField(fresh,{dataset:{serviceItemField:'form_hint'},value:'V1-C'},{});
    check(!shouldIncludeSongTitleSlide(fresh,fresh.label,song,version) && presenterFormPlanForServiceItem(version,fresh,song).forms.every(f=>!f._presenterTitle),'first edit can omit Title');
    edit('v1 - t - c - T');
    let slides=render();check(slides.map(s=>s.type).join(',')==='lyrics,lyrics,lyrics,song-title,lyrics,song-title','middle/repeated title order');
    check(new Set(slides.map(s=>s.id)).size===slides.length,'unique slide IDs');
    check(parseServiceItemMemo(item.memo).formHint==='V1-Title-C-Title','stored canonical input');
    item.memo=serializeServiceItemMemo(parseServiceItemMemo(item.memo));check(render().length===6,'reopen preserves title order');
    edit('V1-C');check(render().every(s=>s.type==='lyrics'),'removed Title stays removed');
    check(parseServiceItemMemo(item.memo).formPreset.titleSequence,'explicit mode survives deletion');
    item.memo=serializeServiceItemMemo(parseServiceItemMemo(item.memo));check(render().length===4,'reopen after removal');
    edit('Title');check(render().length===1 && render()[0].type==='song-title','title only');
    edit('');check(!shouldIncludeSongTitleSlide(item,item.label,song,version),'clear retains no auto title');
    const config=serviceElementConfigForSave({},parseServiceItemMemo(item.memo));
    check(config.formPreset?.titleSequence && config.formPresetDisabled,'empty policy saved');
    const reopened=groupWorshipElements([{id:'sec',service_id:'svc',title:'찬양',section_key:'praise'}],[{id:'el',section_id:'sec',title:song.title,element_type:'praise',config}]).svc[0];
    check(parseServiceItemMemo(reopened.memo).formPreset?.titleSequence,'empty policy DB readback');
    check(parseServiceItemMemo(mergeTemplateProjectionMemo('',reopened.memo)).formPreset?.titleSequence,'empty policy template projection');
    const unsplit=[{id:'raw',part_type:'Lyrics',lyrics:'한 줄\\n\\n세 줄\\n둘째\\n셋째'}];
    const resolved=resolvePresenterFormPresetSequence(unsplit,['Title','V1','Title','C']);
    check(resolved.items.length===4 && resolved.items[1].lyrics==='한 줄' && resolved.items[3].lyrics==='세 줄\\n둘째\\n셋째','Title never consumes unsplit lyrics');
    const sources=[{url:'v1.png',formLabel:'V1'},{url:'c.png',formLabel:'C'}];
    edit('V1-Title-C-Title');
    const score=presenterScoreImageSourcesForFormSequence(sources,presenterScoreFormsFromImageSources(sources),[],item,song,version);
    check(score.imageSources.map(s=>s._presenterTitle?'Title':s.url).join(',')==='v1.png,Title,c.png,Title','score title order');
    const unlabelled=presenterScoreImageSourcesForFormSequence(sources.map(({url})=>({url})),[],[],item,song,version);
    check(unlabelled.imageSources.map(s=>s._presenterTitle?'Title':s.url).join(',')==='v1.png,c.png,Title' && unlabelled.imageSources[0].titleSequenceWarning,'unlabelled score retains every page and warns on ambiguous middle Title');
    edit('Title-V1-C-Title');
    const manyPages=[...sources,{url:'extra.png'}].map(({url})=>({url}));
    const unchangedDeck=presenterScoreImageSourcesForFormSequence(manyPages,[],[],item,song,version);
    check(unchangedDeck.imageSources.map(s=>s._presenterTitle?'Title':s.url).join(',')==='Title,v1.png,c.png,extra.png,Title','unlabelled deck pages retained between titles');
    const portable=serializePortableServiceSourceItem({label:'찬양',value:song.title,formHint:'V1-C',titleSequence:true,asset:{},audio:{}});
    check(parsePortableServiceSourceText(portable.join('\\n'))[0].titleSequence,'portable source preserves explicit title mode');
    edit('Title-V1-C');slides=render();
    const service={id:'title-service',type_id:'fixture',date:'2026-10-25',title:'격리 검증'};
    item.service_id=service.id;item.sort_order=1;
    state.songs=[song];state.services=[service];state.serviceItems={[service.id]:[item]};
    state.module='presenter';state.selectedServiceId=service.id;state.serviceTypes=[{id:'fixture',name:'청년부 예배'}];
    state.client=state.client||{};state.auth.session={user:{id:'offline'}};state.connectionError='';state.serviceError='';
    state.presenter.serviceId=service.id;state.presenter.slides=slides;state.presenter.index=0;
    publishPresenterState=()=>{};
    const full=buildPresenterSlidesForServiceItem(item,service,0);
    check(full.filter(s=>s.formLabel==='Title').length===1,'actual builder Title count '+JSON.stringify(full.map(s=>s.type)));
    check(full.filter(s=>s.type==='lyrics').length===4,'actual builder lyrics');
    document.body.dataset.module='presenter';document.body.dataset.theme='dark';
    const host=document.createElement('main');host.style.cssText='padding:24px;width:100%;background:var(--bg)';
    host.innerHTML=renderServiceFormHintInput(item,0)+renderPresenterSlideBoard(full,0,service.id);
    document.body.replaceChildren(host);
    const direct={...item,song_id:null,version_id:null,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',slides:['직접 한 줄','직접 두 줄\\n둘째 줄'],formPreset:{forms:['V1','Title','C'],titleSequence:true,strength:'manual'}})};
    const directSlides=buildPresenterCustomSlides(direct,section,0);
    check(directSlides.length===3 && directSlides[1].formLabel==='Title' && directSlides[2].text==='직접 두 줄\\n둘째 줄','direct slide boundaries');
    check(JSON.stringify(version)===JSON.stringify(JSON.parse(before).version),'source forms unchanged');
    return {types:slides.map(s=>s.type),sourceUntouched:true};
   }''')
   page.screenshot(path=f'/tmp/title-songform-{engine}.png',full_page=True)
   print(engine,'PASS',result,flush=True);browser.close()
finally:server.shutdown();server.server_close()
