"""Service themes are opt-in by rendered slide kind, never a media fallback."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url+'?output=presenter', wait_until='domcontentloaded')
                page.wait_for_selector('#presenterOutputRoot', state='attached')
                result = page.evaluate('''() => {
                  const payload={chromakey:false,backgroundImages:['theme.png'],serviceType:'sunday-main'};
                  const root=document.getElementById('presenterOutputRoot');
                  const allowed=[
                    {type:'title',elementType:'title',layout:'center_text'},
                    {type:'liturgical-body',elementType:'body_text',layout:'center_text'},
                    {type:'lyrics',elementType:'praise',layout:'lower_bar_text'},
                    {type:'blank',elementType:'blank',layout:'blank'},
                    {type:'ready',elementType:'video',layout:'media',videoSrc:'ready.mp4'},
                    {type:'image',elementType:'image',layout:'media',referenceMedia:true,sectionKey:'sermon'},
                  ];
                  const denied=[null,{}, {type:'unknown'},
                    ...['image','video','audio','file'].map(type=>({type,elementType:type,layout:['audio','file'].includes(type)?'file':'media'})),
                    {type:'image',elementType:'image',layout:'media',referenceMedia:true,sectionKey:'announcements'},
                    {type:'image',elementType:'image',layout:'media',scoreBackground:true},
                    {type:'scripture',elementType:'scripture_text',layout:'lower_bar_text',scriptureContext:'reading'},
                    {...allowed[0],suppressBackgroundImage:true},
                    {...allowed[0],noBackgroundImage:true},
                  ];
                  for(const [list,expected] of [[allowed,true],[denied,false]]) for(const slide of list){
                    const frame=presenterOutputFrameStateForSlide(slide,payload);
                    if(frame.showBackground!==expected) throw Error('Policy: '+JSON.stringify(slide));
                    applyPresenterOutputFrameState(root,frame);
                    if(root.classList.contains('has-background')!==expected||document.body.classList.contains('has-background')!==expected) throw Error('Stale background class');
                    if(Boolean(root.style.getPropertyValue('--presenter-bg-image'))!==expected) throw Error('Stale background CSS');
                    if(Boolean(presenterOutputFrameBackgroundStyle(frame))!==expected) throw Error('Preview policy differs');
                  }
                  for(const slide of allowed){
                    if(presenterOutputFrameStateForSlide({...slide,outputContext:'chromakey'},payload).showBackground) throw Error('Chromakey received theme');
                    if(presenterOutputFrameStateForSlide(slide,{...payload,backgroundImages:[]}).showBackground) throw Error('Inferred theme');
                  }
                  for(const layout of ['media','file']) {
                    root.innerHTML='<div class="presenter-output-layer is-active"><section data-slide-layout="'+layout+'"></section></div>';
                    if(presenterOutputShouldAnimateFrameTransition(root,{cleanOutput:true})) throw Error('Media exit blends theme');
                    root.firstChild.className='presenter-output-layer is-next';
                    if(presenterOutputShouldAnimateFrameTransition(root,{cleanOutput:true})) throw Error('Media entry blends theme');
                  }
                  return {allowed:allowed.length,denied:denied.length};
                }''')
                print('PASS', engine, result, flush=True)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
