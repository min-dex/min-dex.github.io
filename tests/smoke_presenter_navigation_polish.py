"""Fast outline navigation, quiet visibility, warning text, fallback copy and sermon subtitle."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ("chromium", "webkit"):
            browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof renderPresenterServiceTextInputs==='function' && typeof scrollPresenterBoardToServiceItem==='function'")
            result = page.evaluate("""() => {
              const check=(value,message)=>{if(!value)throw Error(message)};
              const sid='navigation-polish';
              const service={id:sid,type_id:'friday',date:'2026-11-27',title:'금요기도회',source_ref:{presenter_output_context:'clean'}};
              const seedItem={id:'sermon-title',service_id:sid,label:'설교',raw_title:'주 제목',assignee:'설교자',
                _worshipSectionKey:'sermon',_worshipSectionTitle:'설교',_serviceItemIndex:0,
                memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text',sermonSubtitle:'한 줄 부제'})};
              state.services=[service];state.serviceItems={[sid]:[seedItem]};state.loadedWorshipServiceIds=new Set([sid]);
              state.selectedServiceId=sid;state.module='presenter';state.loading=false;
              const itemIndex=getServiceItems(sid).findIndex(candidate=>candidate.id===seedItem.id),item=getServiceItems(sid)[itemIndex];
              check(itemIndex>=0,'sermon fixture missing');
              const memo=parseServiceItemMemo(item.memo);
              check(memo.sermonSubtitle==='한 줄 부제','subtitle parse');
              const controls=document.createElement('div');
              controls.innerHTML=renderPresenterServiceTextInputs(item,itemIndex,serviceItemEditorModel(item,{service}),memo);
              const subtitleField=controls.querySelector('[data-service-item-field="sermon_subtitle"]');
              check(subtitleField?.value==='한 줄 부제','subtitle input');
              subtitleField.value='바뀐 부제';updateServiceItemField(subtitleField,{deferPresenterRefresh:true});
              check(parseServiceItemMemo(getServiceItems(sid)[itemIndex].memo).sermonSubtitle==='바뀐 부제','subtitle update');
              presenterSlideBuildCache.delete(sid);
              const current=getServiceItems(sid)[itemIndex],currentMemo=parseServiceItemMemo(current.memo);
              const sermon=presenterElementSlideFromMemoCore(current,{sectionKey:'sermon',sectionTitle:'설교',sectionHeading:'설교'},itemIndex,currentMemo,current.raw_title,service);
              check(sermon?.sermonSubtitle==='바뀐 부제','fullscreen subtitle missing');
              const frame=document.createElement('div');frame.className='presenter-output-root no-chromakey';
              frame.innerHTML=renderPresenterTitleAssigneeSlide(sermon);
              check(frame.querySelector('.presenter-sermon-subtitle')?.textContent==='바뀐 부제','subtitle markup');
              frame.innerHTML=renderPresenterTitleAssigneeSlide({...sermon,assignee:''});
              check(frame.querySelector('.presenter-sermon-subtitle')?.textContent==='바뀐 부제','subtitle depends on assignee');
              const chroma=presenterElementSlideFromMemoCore(current,{sectionKey:'sermon',sectionTitle:'설교'},itemIndex,currentMemo,current.raw_title,{...service,source_ref:{presenter_output_context:'chromakey'}});
              check(!chroma?.sermonSubtitle,'subtitle leaked into chromakey');
              const savedPresenter={serviceId:state.presenter.serviceId,slides:state.presenter.slides};
              const liveSlides=buildServicePresenterSlidesUncached(sid),directSlideIndex=liveSlides.findIndex(slide=>slide.elementId===current.id);
              check(directSlideIndex>=0,'outline slide fixture missing');
              presenterSlideBuildCache.set(sid,{signature:presenterSlideBuildSourceSignature(sid),slides:liveSlides});
              const outline=document.createElement('button');
              Object.assign(outline.dataset,{serviceOutlineService:sid,serviceOutlineItemIndex:String(itemIndex),serviceOutlineItemId:current.id,serviceOutlineSlide:String(directSlideIndex)});
              const oldMap=buildPresenterSlideItemIndexMap;buildPresenterSlideItemIndexMap=()=>{throw Error('outline rebuilt full slide map')};
              try{check(serviceOutlineSlideTarget(outline)?.slideIndex===directSlideIndex,'outline direct target failed')}finally{buildPresenterSlideItemIndexMap=oldMap}
              const outlineList=document.createElement('div');outlineList.className='service-outline-list';outlineList.append(outline);refs.songList.replaceChildren(outlineList);
              const oldSlidesForService=presenterSlidesForService,oldOutlineItems=getServiceOutlineItems,oldItemScroll=scrollPresenterBoardToServiceItem;
              let slideReads=0,outlineReads=0,reusedScrollContext=false;
              presenterSlidesForService=(serviceId)=>{slideReads++;return serviceId===sid?liveSlides:oldSlidesForService(serviceId)};
              getServiceOutlineItems=(candidate)=>{outlineReads++;return oldOutlineItems(candidate)};
              scrollPresenterBoardToServiceItem=(serviceId,index,options={})=>{
                reusedScrollContext=serviceId===sid&&index===itemIndex&&options.item?.id===current.id&&options.slides===liveSlides;
                return true;
              };
              try{
                handleServiceOutlineSlideClick(outline);
                check(slideReads===1&&outlineReads===1,'outline click repeated normalized reads '+JSON.stringify({slideReads,outlineReads}));
                check(reusedScrollContext,'outline click discarded resolved context');
              }finally{
                presenterSlidesForService=oldSlidesForService;getServiceOutlineItems=oldOutlineItems;scrollPresenterBoardToServiceItem=oldItemScroll;
              }
              const root=document.createElement('div');root.id='servicePresenterControls';
              const subgroup=document.createElement('div');subgroup.className='svc-board-subgroup';subgroup.dataset.serviceItemIndex=String(itemIndex);root.append(subgroup);document.body.append(root);
              const viewport=refs.detailPane,oldViewportRect=viewport.getBoundingClientRect.bind(viewport),oldSubgroupRect=subgroup.getBoundingClientRect.bind(subgroup),oldScroll=scrollWithinPresenterViewport;let scrollCalls=0;
              viewport.getBoundingClientRect=()=>({top:0,bottom:600,left:0,right:900,width:900,height:600});
              subgroup.getBoundingClientRect=()=>({top:-20,bottom:80,left:20,right:500,width:480,height:100});
              scrollWithinPresenterViewport=()=>{scrollCalls++;return true};
              try{check(scrollPresenterBoardToServiceItem(sid,itemIndex,{force:false})&&scrollCalls===0,'partially visible item recentered')}finally{viewport.getBoundingClientRect=oldViewportRect;subgroup.getBoundingClientRect=oldSubgroupRect;scrollWithinPresenterViewport=oldScroll;root.remove();state.presenter.serviceId=savedPresenter.serviceId;state.presenter.slides=savedPresenter.slides}
              const warning=document.createElement('span');warning.className='service-outline-badge';warning.textContent='입력 필요';document.body.append(warning);
              const warningCss=getComputedStyle(warning);
              check(warningCss.backgroundColor==='rgba(0, 0, 0, 0)'&&warningCss.paddingLeft==='0px'&&warningCss.borderRadius==='0px','warning still boxed');
              const oldLive=isPresenterOutputWindowOpen;isPresenterOutputWindowOpen=()=>true;
              const screen=document.createElement('div');screen.innerHTML=renderPresenterScreenManagement(sid,[sermon]);isPresenterOutputWindowOpen=oldLive;
              const fallback=screen.querySelector('[data-presenter-action="emergency"]');
              check(fallback?.textContent.includes('배경 없이')&&fallback.title.includes('배경 영상'),'fallback purpose unclear');
              warning.remove();
              return 'PASS single-pass outline target, partial visibility, subtitle, warning and fallback';
            }""")
            print(engine, result, flush=True)
            browser.close()
finally:
    server.shutdown()
