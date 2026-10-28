"""Required empty inputs stay editable without entering the output sequence."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium


server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function('typeof state !== "undefined" && !document.body.classList.contains("ui-booting")')
            result = page.evaluate('''async () => {
              const check=(value,message)=>{if(!value)throw Error(message)};
              let missingCount=0;
              for(const type_id of ['sunday-first','sunday-second','sunday-main','sunday-afternoon',
                'wednesday','friday','monthly','children','nursery','youth','young-adult','special','holy-week-dawn','omer']) {
                const service={id:'empty-'+type_id,type_id,date:'2099-10-25'};
                state.services.push(service);state.loadedWorshipServiceIds.add(service.id);
                const scaffold=buildWorshipServiceScaffold(service.id,type_id,{service,items:[]});
                state.serviceItems[service.id]=groupWorshipElements(scaffold.sections,scaffold.elements)[service.id]||[];
                const items=getServiceItems(service.id),before=JSON.stringify(items);
                const slides=buildServicePresenterSlidesUncached(service.id,{allowHydration:false});
                const board=document.createElement('div');board.innerHTML=renderPresenterSlideBoard(slides,0,service.id);
                for(const [index,item] of items.entries()) {
                  if(isServicePreparationItemForEditor(item,parseServiceItemMemo(item.memo)))continue;
                  const song=presenterSongForServiceItem(item,serviceItemDisplayText(item),item.label||'',service);
                  const content=resolvePresenterServiceItemContentState(item,parseServiceItemMemo(item.memo),song,service);
                  if(!content.required)continue;
                  missingCount++;
                  check(buildPresenterSlidesForServiceItem(item,service,index,{allowHydration:false}).length===0,type_id+': empty output '+item.label);
                  check(!slides.some(slide=>presenterSlideBelongsToItem(slide,item)),type_id+': empty item owns output');
                  check(board.querySelector(`[data-service-element-id="${item.id}"]`),type_id+': editor row lost '+item.label);
                  const outline=document.createElement('div');outline.innerHTML=renderServiceOutlineChildRow(service,item,index,-1,slides);
                  check(outline.querySelector('.service-outline-badge'),type_id+': missing badge lost');
                }
                check(JSON.stringify(getServiceItems(service.id))===before,type_id+': stored inputs changed');
              }
              const service={id:'empty-transitions',type_id:'special',date:'2099-10-25'};
              state.services.push(service);state.loadedWorshipServiceIds.add(service.id);
              const item={id:'stable-sermon',service_id:service.id,label:'설교',raw_title:'',assignee:'',
                memo:serializeServiceItemMemo({elementType:'title_person'})};
              state.serviceItems[service.id]=[item];
              const build=()=>buildPresenterSlidesForServiceItem(item,service,0,{allowHydration:false});
              const cached=()=>buildServicePresenterSlides(service.id).filter(slide=>presenterSlideBelongsToItem(slide,item));
              check(build().length===0,'empty sermon emitted a title');
              check(cached().length===0,'empty sermon entered cached sequence');
              item.raw_title='실제 설교';item.assignee='테스트 목사';
              const filled=build();check(filled.length>0,'filled sermon missing');
              check(cached().length>0,'filled sermon did not invalidate cache');
              const snapshot=JSON.stringify(item),reopened=JSON.parse(snapshot);
              check(buildPresenterSlidesForServiceItem(reopened,service,0,{allowHydration:false})[0].id===filled[0].id,'roundtrip lost element identity');
              const survivor={id:'next-real-slide',type:'title',text:'다음 순서'};
              check(reconcilePresenterIndexForSlides([...filled,survivor],filled.length,[survivor])===0,'selection lost next survivor');
              item.raw_title='';item.assignee='';check(build().length===0,'clear regenerated placeholder');
              check(cached().length===0,'clear retained cached placeholder/title/blank');
              check(item.id==='stable-sermon','clear changed source identity');
              const make=(id,label,elementType,raw_title='')=>({id,service_id:service.id,label,raw_title,
                memo:serializeServiceItemMemo({elementType})});
              for(const elementType of ['image','video','audio','file']) {
                const source=make('empty-'+elementType,'자료',elementType);
                check(buildPresenterSlidesForServiceItem(source,service,1,{allowHydration:false}).length===0,'empty media emitted output '+elementType);
              }
              check(buildPresenterSlidesForServiceItem(make('empty-title','제목','title'),service,1,{allowHydration:false}).length===0,'generic title placeholder emitted output');
              for(const source of [make('blank','빈 화면','blank'),make('confession','참회기도','title'),
                make('fixed','고정 순서','title'),make('creed','신앙고백','body')]) {
                check(buildPresenterSlidesForServiceItem(source,service,1,{allowHydration:false}).length>0,'intentional content removed '+source.label);
              }
              const song={id:'empty-test-song',title:'실제 찬양',versions:[{id:'empty-test-version',name:'기본',is_primary:true,
                forms:[{id:'empty-test-v1',part_type:'Verse',part_number:1,lyrics:'실제 가사',sort_order:1}]}]};
              state.songs.push(song);
              const praise={id:'stable-praise',service_id:service.id,label:'찬양 1',raw_title:'실제 찬양',
                song_id:song.id,version_id:song.versions[0].id,_worshipSectionKey:'praise',
                memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formPreset:{forms:['T','V1'],strength:'manual'}})};
              const original=JSON.stringify({song,praise});
              const actual=buildPresenterSlidesForServiceItem(praise,service,2,{allowHydration:false});
              check(actual.some(slide=>slide.type==='song-title'),'explicit real T removed');
              check(actual.some(slide=>slide.text==='실제 가사'),'real verse removed');
              check(JSON.stringify({song,praise})===original,'lyrics/form/version source changed');
              const left=make('navigation-left','앞 순서','title','앞 순서');left.sort_order=1;
              item.sort_order=2;
              const right=make('navigation-right','다음 순서','title','다음 순서');right.sort_order=3;
              state.serviceItems[service.id]=[left,item,right];state.client=null;state.loading=false;
              state.module='presenter';state.selectedServiceId=service.id;
              preparePresenterService(service.id);
              const output={closed:false,postMessage(){}};
              state.presenter.outputSessionId='empty-navigation';state.presenter.outputWindow=output;
              const adapter=MindexRemote.adapter(service.id,'empty-navigation',output);
              const catalog=adapter.browse();check(catalog,'remote catalog unavailable');
              check(catalog.total===state.presenter.slides.length,'remote numbering diverged');
              check(!catalog.items.some(entry=>entry.groupKey===item.id),'remote catalog retained empty item');
              const outline=document.createElement('div');outline.innerHTML=renderServiceOutlineChildRow(service,item,1,-1,state.presenter.slides);
              check(serviceOutlineSlideTarget(outline.querySelector('button'))===null,'empty outline jumps to another output');
              const target=state.presenter.slides.findIndex(slide=>slide.elementId===right.id);
              await adapter.execute('jump',{index:target,key:catalog.key});
              check(state.presenter.index===target,'remote jump missed surviving slide');
              await adapter.execute('prev');check(state.presenter.index===target-1,'remote previous numbering drifted');
              await adapter.execute('next');check(state.presenter.index===target,'remote next numbering drifted');
              const payload=presenterStatePayload(service.id);
              check(payload.slides.length===catalog.total&&!payload.slides.some(slide=>slide.elementId===item.id),'actual output payload includes empty element');
              check(missingCount>20,'template coverage unexpectedly empty');
              return {missingCount,types:14,storedWrites:0};
            }''')
            print('PASS', engine, result, flush=True)
            browser.close()
finally:
    server.shutdown()
