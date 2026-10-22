"""Offline per-element presentation: one content model, camera/clean, video lifecycle."""
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
                  const presentation={mode:'camera',backgroundVideo:'tests/fixtures/praise-background.webm'};
                  const memo=serializeServiceItemMemo({elementType:'title_person',presentation,note:'보존'});
                  check(parseServiceItemMemo(memo).presentation.mode==='camera','memo lost mode');
                  check(parseServiceItemMemo(memo).note==='보존','memo lost text');
                  const config=serviceElementConfigForSave({custom:'keep'},parseServiceItemMemo(memo),{item:{label:'설교',raw_title:'소망',assignee:'이름 목사'}});
                  check(config.presentation.mode==='camera'&&config.custom==='keep','atomic config lost presentation or unrelated setting');
                  check(!normalizeServicePresentation({backgroundVideo:'javascript:bad.mp4'}),'unsafe source');
                  check(!normalizeServicePresentation({backgroundVideo:'https://example.com/image.png'}),'not video');
                  const lines=serializePortableServiceSourceItem({label:'설교',value:'소망',elementType:'title_person',inputMode:'text',asset:{},audio:{},presentation});
                  const records=parseServiceSourceText('[[설교]]\\n'+lines.join('\\n'));
                  check(records[0].presentation.mode==='camera','source roundtrip');
                  const base={id:'sermon',type:'title-assignee',elementType:'title_assignee',layout:'lower-bar-text',sectionKey:'sermon',sectionTitle:'설교',orderTitle:'설교',contentTitle:'소망',title:'소망',assignee:'이름 목사',presentationMode:'camera',outputContext:'chromakey'};
                  // Use canonical enum values, same as the projected service slides.
                  base.elementType=PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE;base.layout=PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT;
                  const payload={chromakey:false,serviceType:'special'};
                  const frame=presenterOutputFrameStateForSlide(base,payload);
                  check(!frame.noChromakey,'camera did not override fullscreen service');
                  const blank=presenterElementTrailingBlankSlide(base,0,{type_id:'special'});
                  check(!presenterOutputFrameStateForSlide(blank,payload).noChromakey,'camera blank hides camera');
                  const html=renderPresenterSlideFrame(base,{noChromakey:false});
                  check(html.includes('presenter-camera-title')&&html.includes('소망')&&html.includes('이름 목사'),'camera content');
                  const full=normalizeCleanPresenterSlideLayout({...base,outputContext:'clean',presentationMode:'fullscreen'});
                  const fullHtml=renderPresenterSlideFrame(full,{noChromakey:true});
                  check(fullHtml.includes('소망')&&fullHtml.includes('이름 목사')&&!fullHtml.includes('presenter-camera-title'),'fullscreen content parity');
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
                  const root=document.createElement('div');document.body.append(root);
                  applyPresenterBackgroundVideo(root,vf.backgroundVideo);const video=root.querySelector('video');
                  check(video.muted&&video.loop&&video.playsInline,'background audio/loop contract');
                  await video.play();await new Promise(resolve=>setTimeout(resolve,180));
                  check(!video.paused&&video.currentTime>0,'background did not play');
                  applyPresenterBackgroundVideo(root,vf.backgroundVideo);check(video===root.querySelector('video'),'lyric change restarts video');
                  applyPresenterBackgroundVideo(root,'');check(!root.querySelector('video'),'video not removed');
                  const item={id:'fixture',label:'찬양',memo:serializeServiceItemMemo({elementType:'praise'})};
                  const controls=renderPresenterPresentationControls(item,0,'fixture');
                  check(controls.includes('카메라 자막')&&controls.includes('data-praise-background-file'),'editable controls');
                  return 'PASS mode/source roundtrip, shared content, title layout, video isolation/reuse and controls';
                }''')
                print(engine, result)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__': main()
