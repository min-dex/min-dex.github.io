"""Offline fullscreen praise title, video settings and background lifecycle."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1920, 'height': 1080})
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url+'?output=presenter', wait_until='domcontentloaded')
                page.wait_for_function("typeof WORSHIP_BACKGROUND_BASE === 'string' && typeof renderPresenterPresentationControls === 'function'")
                result = page.evaluate('''async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const sections=[{id:'reading-section',service_id:'order-fixture',sort_order:20,section_key:'scripture_reading',title:'성경봉독'},{id:'praise-section',service_id:'order-fixture',sort_order:10,section_key:'praise',title:'찬양'}];
                  const elements=[{id:'reading',section_id:'reading-section',sort_order:1,element_type:'scripture_body',title:'',source_ref:{label:'성경봉독'},config:{inputMode:'scripture',elementType:'scripture_body'}},{id:'second-song',section_id:'praise-section',sort_order:20,element_type:'title_person',title:'둘째 곡',source_ref:{label:'찬양 2'},config:{inputMode:'text',elementType:'title_person'}},{id:'first-song',section_id:'praise-section',sort_order:10,element_type:'title_person',title:'첫째 곡',source_ref:{label:'찬양 1'},config:{inputMode:'text',elementType:'title_person'}}];
                  const before=JSON.stringify([sections,elements]);
                  const grouped=groupWorshipElements(sections,elements)['order-fixture'];
                  check(grouped.map(e=>e.id).join(',')==='first-song,second-song,reading','unordered RPC rows changed service order');
                  check(normalizeServiceItemsInCurrentOrder(grouped).map(e=>e.id).join(',')==='first-song,second-song,reading','hydration compaction changed persisted order');
                  check(JSON.stringify([sections,elements])===before,'grouping mutated server rows');
                  const presentation={backgroundVideo:'tests/fixtures/praise-background.webm'};
                  const memo=serializeServiceItemMemo({elementType:'title_person',presentation,note:'보존'});
                  check(parseServiceItemMemo(memo).presentation.backgroundVideo===presentation.backgroundVideo,'memo lost video');
                  check(parseServiceItemMemo(memo).note==='보존','memo lost text');
                  const config=serviceElementConfigForSave({custom:'keep'},parseServiceItemMemo(memo),{item:{label:'설교',raw_title:'소망',assignee:'이름 목사'}});
                  check(config.presentation.backgroundVideo===presentation.backgroundVideo&&config.custom==='keep','atomic config lost video or unrelated setting');
                  check(!normalizeServicePresentation({backgroundVideo:'javascript:bad.mp4'}),'unsafe source');
                  check(!normalizeServicePresentation({backgroundVideo:'https://example.com/image.png'}),'not video');
                  const lines=serializePortableServiceSourceItem({label:'설교',value:'소망',elementType:'title_person',inputMode:'text',asset:{},audio:{},presentation});
                  const records=parseServiceSourceText('[[설교]]\\n'+lines.join('\\n'));
                  check(records[0].presentation.backgroundVideo===presentation.backgroundVideo,'source roundtrip');
                  const payload={chromakey:false,serviceType:'special'};
                  const song={id:'song',type:'song-title',elementType:PRESENTER_ELEMENT_TYPES.PRAISE,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,songTitle:'제목',songTitleContent:{orderTitle:'찬양 1',title:'제목',detail:'부제',detailKind:'subtitle'}};
                  const songHtml=renderPresenterSlideFrame(song,{noChromakey:true});
                  const holder=document.createElement('div');holder.innerHTML=songHtml;
                  check(holder.querySelector('.presenter-fullscreen-song-heading').textContent==='♬','note missing');
                  check(holder.querySelector('.presenter-title-content-title').textContent==='제목','main title duplicated note');
                  check(!holder.textContent.includes('부제')&&!holder.textContent.includes('찬양 1'),'extra title text');
                  const videoSlide={...song,backgroundVideo:presentation.backgroundVideo};
                  const vf=presenterOutputFrameStateForSlide(videoSlide,payload);
                  check(vf.backgroundVideo===presentation.backgroundVideo,'video missing');
                  check(!presenterOutputFrameStateForSlide({...videoSlide,outputContext:'chromakey'},payload).backgroundVideo,'video leaked into key');
                  check(!presenterOutputFrameStateForSlide({...videoSlide,formBackgroundImage:'photo.png'},payload).backgroundVideo,'video covers photo');
                  check(!presenterOutputFrameStateForSlide({...videoSlide,type:'blank',layout:PRESENTER_SLIDE_LAYOUTS.BLANK},payload).backgroundVideo,'video leaked into blank');
                  check(presenterOutputFrameKey(payload,videoSlide,vf)!==presenterOutputFrameKey(payload,song,presenterOutputFrameStateForSlide(song,payload)),'cache ignores video');
                  const root=document.createElement('div');root.className='presenter-output-root';const still=document.createElement('div');still.className='presenter-output-background';root.append(still);document.body.append(root);
                  applyPresenterBackgroundVideo(root,vf.backgroundVideo);const video=root.querySelector('video');
                  check(video.muted&&video.loop&&video.playsInline,'background audio/loop contract');
                  check(Number(getComputedStyle(video).zIndex)>Number(getComputedStyle(still).zIndex),'existing still covers moving background');
                  await video.play();await new Promise(resolve=>setTimeout(resolve,180));
                  check(!video.paused&&video.currentTime>0,'background did not play');
                  applyPresenterBackgroundVideo(root,vf.backgroundVideo);check(video===root.querySelector('video'),'lyric change restarts video');
                  applyPresenterBackgroundVideo(root,'');check(!root.querySelector('video'),'video not removed');
                  const item={id:'fixture',label:'찬양',memo:serializeServiceItemMemo({elementType:'praise'})};
                  const controls=renderPresenterPresentationControls(item,0,'fixture');
                  check(!controls.includes('카메라 자막')&&controls.includes('data-praise-background-file'),'editable controls');
                  const fixtureId='11111111-1111-4111-8111-111111111111';
                  const target={id:'22222222-2222-4222-8222-222222222222',service_id:fixtureId,label:'찬양',raw_title:'곡',song_id:'linked-song',song_version_id:'linked-version',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',slides:['보존할 가사']})};
                  state.services=[{id:fixtureId,type_id:'special',date:'2026-11-03'}];state.serviceItems[fixtureId]=[target];state.selectedServiceId=fixtureId;
                  const originals={saveServiceItemPatch,renderCurrentServiceModuleDetail,schedulePresenterRefreshForService,showToast,updateSaveState};
                  let saved,notice;
                  try {
                    state.client={storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:'https://example.com/loop.webm'}})})}};
                    saveServiceItemPatch=async(id,index)=>{saved=structuredClone(getServiceItems(id)[index]);return true};
                    renderCurrentServiceModuleDetail=()=>{};schedulePresenterRefreshForService=()=>{};showToast=message=>{notice=message};updateSaveState=()=>{};
                    const input={files:[new File(['fixture'],'loop.webm',{type:'video/webm'})],dataset:{serviceId:fixtureId,serviceItemId:target.id},value:'fixture'};
                    await uploadPresenterPraiseBackground(input);
                    check(saved?.song_id==='linked-song'&&saved.version_id==='linked-version','upload changed song link '+JSON.stringify({saved,notice}));
                    const savedMemo=parseServiceItemMemo(saved.memo);
                    check(savedMemo.slides[0]==='보존할 가사'&&savedMemo.presentation.backgroundVideo==='https://example.com/loop.webm','upload changed lyrics or failed to attach background');
                  } finally {saveServiceItemPatch=originals.saveServiceItemPatch;renderCurrentServiceModuleDetail=originals.renderCurrentServiceModuleDetail;schedulePresenterRefreshForService=originals.schedulePresenterRefreshForService;showToast=originals.showToast;updateSaveState=originals.updateSaveState;}
                  return 'PASS fullscreen title, video config/source roundtrip, playback/isolation/reuse and upload preservation';
                }''')
                print(engine, result)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__': main()
