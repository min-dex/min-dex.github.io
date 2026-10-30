"""First-line alias input through native atomic save; isolated memory RPC only."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from pathlib import Path
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page()
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
    page.add_init_script('window.open=()=>null')
    page.route('**/mindex-release.json*',lambda r:r.fulfill(json={'version':'inline-source-test'}))
    page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof saveWorshipServiceInstance==='function' && !!refs.songList && !document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    print(engine,page.evaluate('''async()=>{
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const uid=()=>crypto.randomUUID(),sid=uid();
                      const service={id:sid,type_id:'fixture',date:'2026-10-30',title:'Fixture',_worshipSourceRef:{}};
                      const version={id:uid(),name:'새찬송가',hymn_no:'382',praise_types:['hymn'],forms:[{id:uid(),part_type:'Verse',part_number:1,lyrics:'보존할 첫 줄\\n둘째 줄',sort_order:1}]};
                      const hymn=MindexSingleSong.fromLegacySong({id:uid(),title:'너 근심 걱정 말아라',hymn_no:'382',praise_types:['hymn'],versions:[version]},version,'SONG-HYMN-N382-0001');
                      const bad=MindexSingleSong.fromLegacySong({id:uid(),title:'382',praise_types:['ccm']},{id:uid(),name:'기본',forms:[]},'SONG-CONT-0445-0001');
                      hymn.revision=1;bad.revision=1;
                      const records=[hymn,bad],recordBefore=JSON.stringify(records);
                      let creates=0;
                      const repo=MindexSingleSong.createRepository({read:async()=>structuredClone(records),commit:async()=>{creates++;throw Error('unexpected praise mutation')}});
                      installSingleSongSession(records,repo);songCatalogLoaded=true;
                      state.services=[service];state.selectedServiceId=sid;
                      state.dirty.service=false;state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
                      state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();state.serviceAliasSupported=true;
                      const items=[normalizeServiceItem({id:uid(),service_id:sid,label:'찬양 1',raw_title:'',
                        _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',_worshipSlotKey:'praise.1',_worshipElementTemplateModified:true,
                        memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1',audioTiming:{version:1,audioUrl:'/fixture.mp3',audioFingerprint:'fixture-sha',duration:10,lyricsFingerprint:'fixture-lyrics',starts:[0,5],enabled:true}})},0)];
                      const originalTiming=JSON.stringify(parseServiceItemMemo(items[0].memo).audioTiming);
                      const typed={inputMode:true,contentState:true};
                      worshipElementTypedStateColumns=async()=>typed;
                      refreshPresenterForService=()=>{};
                      const rows=buildWorshipPersistenceRows(service,items,{}, {},{elementTypedStateColumns:typed,singleSongCatalog:state.singleSongCatalog,singleSongStorage:"native"});
                      sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
                      state.worshipSections=structuredClone(rows.sections);state.worshipElements=structuredClone(rows.elements);
                      state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};
                      const initial={serviceId:sid,serviceTypeId:'fixture',serviceDate:service.date,
                        metadataPatch:{title:'Fixture'},
                        sections:rows.sections.map(({id,service_id,created_at,updated_at,...patch})=>({id,patch})),
                        elements:rows.elements.map(({id,section_id,created_at,updated_at,...patch})=>({id,sectionId:section_id,patch})),
                        document:buildServiceDocumentSnapshot(service,state.serviceItems[sid])};
                      let db={revision:'1',service:{id:sid,service_type_id:'fixture',service_date:service.date,title:'Fixture',source_ref:{mindexServiceDocument:initial.document}},
                        ...structuredClone(rows),slides:[]};
                      service._worshipSourceRef=structuredClone(db.service.source_ref);
                      const writes=[];let failure=false,duringSave=null;
                      state.client={from(){throw Error('Legacy table write attempted')},rpc:async(name,{sid:readId,req})=>{
                        if(name==='get_worship_service_v1')return {data:structuredClone(db)};
                        check(name==='save_worship_service_v1','wrong RPC');
                        if(failure)return {error:{code:'P0001',message:'INJECTED_FAILURE'}};
                        check(req.expectedRevision===db.revision,'stale token');writes.push(structuredClone(req));
                        for(const [key,patches] of [['sections',req.sectionPatches],['elements',req.elementPatches]]) {
                          for(const change of patches){const row=db[key].find(x=>x.id===change.id);Object.assign(row,change.patch);
                            for(const [field,keys] of Object.entries(change.removeKeys||{}))for(const key of keys)delete row[field][key];}
                        }
                        db.sections.push(...req.newSections.map(x=>({id:x.id,service_id:sid,...x.patch})));
                        db.elements.push(...req.newElements.map(x=>({id:x.id,section_id:x.sectionId,...x.patch})));
                        for(const move of req.elementMoves)db.elements.find(x=>x.id===move.id).section_id=move.sectionId;
                        db.elements=db.elements.filter(x=>!req.deleteElementIds.includes(x.id));
                        db.sections=db.sections.filter(x=>!req.deleteSectionIds.includes(x.id));
                        Object.assign(db.service,req.metadataPatch);
                        db.service.source_ref={...db.service.source_ref,mindexServiceDocument:req.document};
                        db.revision=String(Number(db.revision)+1);
                        if(duringSave){const callback=duringSave;duringSave=null;callback();}
                        return {data:{aggregate:structuredClone(db),committedRevision:db.revision,replayed:false}};
                      }};
                      state.singleSongClient=state.client;
                      const client=await worshipAtomicClient();await client.read(sid);

                      const song=state.songs.find(row=>row.id===hymn.id);
                      const labelled={id:'SONG-CONT-0800-0001',_singleSongRecord:true,title:'예수로 나의 구주 삼고',versions:[{id:'SONG-CONT-0800-0001',name:'별도 가사',version_label:'별도 가사',forms:[]}]};
                      const oldHymn={id:'SONG-HYMN-T204-0001',_singleSongRecord:true,title:'예수를 나의 구주 삼고',hymn_no:'통 204',versions:[{id:'SONG-HYMN-T204-0001',name:'통일 204 예수로 나의 구주 삼고',raw_section_name:'통일 204 예수로 나의 구주 삼고',forms:[]}]};
                      const displayBefore=JSON.stringify([labelled,oldHymn]);
                      check(versionDisplayName(labelled,labelled.versions[0])==='별도 가사','explicit native label hidden');
                      check(versionDisplayName(oldHymn,oldHymn.versions[0])==='통일찬송가','old hymnal label not compact');
                      check(versionDisplayName(oldHymn,{name:'영어',raw_section_name:'영어'})==='영어','custom hymn label lost');
                      check(praiseVariantLabel(labelled,[labelled,oldHymn])==='별도 가사','picker label differs');
                      check(JSON.stringify([labelled,oldHymn])===displayBefore,'display mutated stored names');

                      check(praiseFirstLineAliases(song)[0]==='보존할 첫 줄','first line missing');
                      const firstMatch=getSongSearchMatch(song,getSearchTokens('보존할 첫 줄'),{includeLyrics:false});
                      check(firstMatch?.field.label==='첫 소절','summary search did not index alias');
                      check(resolvePresenterPreparationSong('보존할첫줄',items[0],service)?.id===hymn.id,'spacing alias failed');
                      check(!resolvePresenterPreparationSong('보존할',items[0],service),'partial alias auto selected');
                      let blocked=false;
                      try{await createBlankPraiseSongForServiceInput('보존할',service,items[0])}catch(error){blocked=/첫 소절/.test(error.message)}
                      check(blocked&&creates===0,'partial alias created duplicate');
                      const clone=structuredClone(song);clone.id='SONG-CONT-0900-0001';clone.title='다른 곡';clone.versions[0].id=clone.id;
                      state.songs.push(clone);clearSearchCaches();
                      check(!resolvePresenterPreparationSong('보존할 첫 줄',items[0],service),'ambiguous alias auto selected');
                      blocked=false;try{await createBlankPraiseSongForServiceInput('보존할 첫 줄',service,items[0])}catch(error){blocked=/첫 소절/.test(error.message)}
                      check(blocked&&creates===0,'ambiguous alias created duplicate');
                      clone.title='보존할 첫 줄';clearSearchCaches();
                      check(resolvePresenterPreparationSong('보존할 첫 줄',items[0],service)?.id===clone.id,'exact title did not beat alias');
                      state.songs=state.songs.filter(row=>row!==clone);clearSearchCaches();
                      check(!resolvePraiseFirstLine('보존할 첫 줄',{memo:serializeServiceItemMemo({inputMode:'children_audio'})},service).song,'audio-ineligible alias selected');
                      const marked={versions:[{forms:[
                        {part_type:'Verse',lyrics:'  \\n[Verse 1]\\n1. <b>첫 소절!</b>\\n다음 줄'},
                        {part_type:'Chorus',lyrics:'\\nSing to the Lord\\nsecond line'},
                        {part_type:'Bridge',lyrics:'제외할 브리지'},
                        {part_type:'Chorus',lyrics:''}]}]};
                      check(JSON.stringify(praiseFirstLineAliases(marked))===JSON.stringify(['첫 소절!','Sing to the Lord']),'marker/multilingual/empty handling');
                      state.module='presenter';state.serviceTypes=[{id:'fixture',name:'검증 예배'}];state.serviceError='';state.connectionError='';state.search='';
                      document.body.dataset.module='presenter';document.body.classList.remove('ui-booting');
                      renderServiceList();renderPresenterDetail();
                      for(const toggle of refs.songList.querySelectorAll('[data-presenter-inline-toggle]'))toggle.click();
                      const field=refs.songList.querySelector('[data-presenter-preparation-field-label="찬양 1"], [data-presenter-preparation-field-label="찬양1"]');
                      check(field,'real praise input missing: '+refs.songList.innerHTML.slice(-2000));
                      const beforeOutput=JSON.stringify(state.presenter);
                      field.focus();field.value='9999';field.dispatchEvent(new Event('input',{bubbles:true}));
                      const untouched=JSON.stringify(state.serviceItems[sid]);
                      check(!await applyPresenterPreparationInput(sid),'unknown hymn accepted');
                      check(JSON.stringify(state.serviceItems[sid])===untouched&&writes.length===0,'unknown hymn changed worship');
                      check(JSON.stringify(presenterPreparationDraftForService(sid)).includes('9999'),'unknown input lost');
                      field.value='보존할 첫 줄';field.dispatchEvent(new Event('input',{bubbles:true}));
                      state.songs=[];clearSearchCaches();songCatalogLoaded=false;
                      check(await applyPresenterPreparationInput(sid),'real apply failed');
                      check(state.serviceItems[sid][0].song_id===hymn.id,'apply selected false numeric title');
                      const draftBefore=JSON.stringify(state.serviceItems[sid]);failure=true;
                      try{await saveWorshipServiceInstance(service);throw Error('failure accepted')}catch(e){check(e.message==='INJECTED_FAILURE',e.message)}
                      check(JSON.stringify(state.serviceItems[sid])===draftBefore,'failure lost input');
                      failure=false;await saveWorshipServiceInstance(service);
                      check(writes.length===1&&db.elements[0].praise_record_id===hymn.id,'native atomic reference wrong');
                      state.serviceItems[sid]=groupWorshipElements(db.sections,db.elements)[sid];
                      delete state.presenterPreparationDrafts[sid];renderServiceList();renderPresenterDetail();
                      check(state.serviceItems[sid][0].song_id===hymn.id,'rehydrate lost hymn reference');
                      const emptyPicker=document.querySelector('.svc-board-subgroup-controls .svc-song-picker--linked');
                      check(emptyPicker && !emptyPicker.textContent.trim(),'single-variant fixture has unexpected picker content: '+(emptyPicker?.outerHTML||document.querySelectorAll('.svc-song-picker--linked').length));
                      check(emptyPicker.getClientRects().length===0,'empty variant picker still occupies controller title/form space');

                      const savedMemo=parseServiceItemMemo(state.serviceItems[sid][0].memo);
                      check(savedMemo.formHint==='V1'&&JSON.stringify(savedMemo.audioTiming)===originalTiming,'form/timing changed '+JSON.stringify(savedMemo));
                      check(JSON.stringify(records)===recordBefore&&creates===0,'shared praise data changed');
                      check(JSON.stringify(state.presenter)===beforeOutput,'output state changed');
                      check(getGlobalPraiseResults(getSearchTokens('보존할 첫 줄')).some(x=>x.song.id===hymn.id),'global alias missing');
                      check(getSongSearchMatch(song,getSearchTokens('둘째 줄'))?.field.label==='가사','full lyric search changed');
                      check(!getSongSearchMatch(song,getSearchTokens('둘째 줄'),{includeLyrics:false}),'full body leaked into summary');
                      clone.title='다른 곡';state.songs.push(clone);clearSearchCaches();
                      state.module='service';state.servicePrepEditorOpenId=sid;render();
                      const pickerField=document.querySelector('.svc-prep-editor [data-service-item-field="raw_title"]');
                      check(pickerField,'real picker field missing');
                      pickerField.value='보존할 첫 줄';pickerField.dispatchEvent(new Event('input',{bubbles:true}));
                      await new Promise(resolve=>setTimeout(resolve,350));
                      check(document.querySelectorAll('.svc-prep-editor [data-service-song-select]').length>=2,'ambiguous choices missing');
                      const choice=document.querySelector('.svc-prep-editor [data-service-song-select="'+hymn.id+'"]');
                      check(choice,'explicit candidate missing');choice.click();
                      await new Promise(resolve=>setTimeout(resolve,100));
                      check(state.serviceItems[sid][0].song_id===hymn.id,'explicit candidate identity wrong');
                      check(JSON.stringify(records)===recordBefore&&creates===0,'candidate selection mutated praise');
                      state.module='praise';state.servicePrepEditorOpenId=null;state.search='';render();
                      refs.searchInput.value='보존할 첫 줄';refs.searchInput.dispatchEvent(new Event('input',{bubbles:true}));
                      await new Promise(resolve=>setTimeout(resolve,350));
                      const searchChoice=document.querySelector('[data-global-song-id="'+hymn.id+'"], [data-song-id="'+hymn.id+'"]');
                      check(searchChoice,'actual search result missing');searchChoice.click();
                      await new Promise(resolve=>setTimeout(resolve,150));
                      check(state.selectedSongId===hymn.id,'actual search selected alias as a new record');
                      check(JSON.stringify(records)===recordBefore&&creates===0,'search changed original records');


                      return 'PASS real first-line input / apply / native atomic failure retry / rehydrate; no praise writes';
    }'''),flush=True)
    page.unroute_all(behavior='wait')
   finally:browser.close()
finally:server.shutdown()
