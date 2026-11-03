from pathlib import Path
import tempfile
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1280, 'height': 720})
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof runPresenterAction==='function' && typeof compactSearchValue==='function'")
                print(engine, page.evaluate('''() => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const sid='emergency-fixture';
                  const lyric={id:'lyric',type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:'비상 모드 가사',title:'찬양',backgroundVideo:'missing.mp4',formBackgroundImage:'missing.png',songPosition:{title:'찬양',steps:['V'],index:0}};
                  const scripture={id:'reading',type:'scripture',elementType:'scripture_text',layout:'lower_bar_text',text:'1 말씀을 읽습니다',title:'요한복음 1:1',scriptureContext:'reading',scriptureReadingFinal:true};
                  const title={id:'title',type:'title-content',elementType:'title_content',layout:'center_text',title:'설교 제목',bodyText:'설교자',outputContext:'clean'};
                  const slides=[lyric,scripture,title];const before=JSON.stringify(slides);
                  const payload={serviceId:sid,slides,index:0,chromakey:false,backgroundImages:['missing-bg.png'],emergencyMode:true};
                  const root=document.createElement('main');root.id='emergencyTestRoot';root.className='presenter-output-root';root.style.cssText='position:fixed;inset:0;width:1280px;height:720px;transform:none;z-index:2147483647';document.body.append(root);
                  for(const slide of slides){
                    const view=presenterEmergencySlideView(slide,true),f=presenterOutputFrameStateForSlide(slide,payload);
                    check(!f.noChromakey&&f.emergencyMode&&!f.showBackground&&!f.backgroundVideo,'wrong emergency frame');
                    check(presenterSlideLayout(view)==='lower_bar_text','not chromakey layout');
                    root.className='presenter-output-root '+presenterOutputFrameClassNames(f);root.innerHTML=renderPresenterSlideFrame(view,{noChromakey:f.noChromakey,emergencyMode:true});
                    check(getComputedStyle(root).getPropertyValue('--presenter-chromakey').trim()==='#000','not black');
                    check(!root.querySelector('video,.presenter-lyric-service-name,.presenter-service-design-mark,.presenter-scripture-reading'),'decoration leaked');
                    check(root.textContent.includes(slide.title==='설교 제목'?'설교 제목':slide.text),'content lost');
                    const normal=presenterOutputFrameStateForSlide(slide,{...payload,emergencyMode:false});check(!normal.emergencyMode,'normal mode leaked');
                  }
                  check(JSON.stringify(slides)===before,'authored slides changed');
                  const safety=presenterSafetyBlankSlide('transparent');check(!presenterOutputFrameStateForSlide(safety,payload).emergencyMode,'transparent overridden');
                  const media={id:'video',type:'video',elementType:'video',layout:'media',videoSrc:'fixture.mp4',text:'fixture.mp4'};
                  const f=presenterOutputFrameStateForSlide(media,payload),n=presenterOutputFrameStateForSlide(media,{...payload,emergencyMode:false});
                  check(presenterEmergencySlideView(media,true)===media,'media changed');
                  check(presenterOutputFrameKey(payload,media,f)===presenterOutputFrameKey(payload,media,n),'media would restart');
                  check(normalizePresenterPayload(payload).emergencyMode&&!normalizePresenterPayload({...payload,emergencyMode:undefined}).emergencyMode,'transport flag lost');
                  state.presenter.serviceId=sid;state.presenter.slides=slides;state.presenter.index=1;state.presenter.emergencyMode=false;state.presenter.liveScripture={active:true,slide:scripture};
                  const music=state.serviceMusic.audio,items=JSON.stringify(state.serviceItems),live=state.presenter.liveScripture;
                  const oldLive=presenterControllerIsLive,oldPublish=publishPresenterState,oldRender=renderPresenterControlState;let sent=0;
                  presenterControllerIsLive=id=>id===sid;publishPresenterState=()=>sent++;renderPresenterControlState=()=>{};
                  try {runPresenterAction('emergency',sid);check(state.presenter.emergencyMode&&sent===1,'toggle on failed');runPresenterAction('emergency','other');check(sent===1,'foreign service toggled');runPresenterAction('emergency',sid);check(!state.presenter.emergencyMode&&sent===2,'toggle off failed');}
                  finally {presenterControllerIsLive=oldLive;publishPresenterState=oldPublish;renderPresenterControlState=oldRender;}
                  check(state.presenter.index===1&&state.presenter.liveScripture===live&&state.serviceMusic.audio===music&&JSON.stringify(state.serviceItems)===items,'toggle changed output/content/audio');
                  root.remove();return 'PASS black chromakey views, background suppression, media identity, safety precedence, payload and reversible controller toggle';
                }'''))
                page.evaluate("""() => {
                  const sid='emergency-live-fixture';
                  state.services=[{id:sid,type_id:'external',date:'2026-11-03',title:'테스트 예배'}];
                  state.presenter.serviceId=sid;state.presenter.emergencyMode=false;
                  window.emergencyLiveSlide={id:'same-lyric',type:'lyrics',elementType:'praise',layout:'lower_bar_text',title:'찬양',text:'검은 배경 위의 가사'};
                  window.emergencyLivePayload={serviceId:sid,chromakey:false,slides:[emergencyLiveSlide],index:0,emergencyMode:false};
                  const root=document.createElement('main');root.id='presenterOutputRoot';root.className='presenter-output-root';root.style.zIndex='2147483647';document.body.append(root);
                  renderPresenterOutput(emergencyLivePayload,{animate:false});
                }""")
                page.wait_for_selector('#presenterOutputRoot.no-chromakey .presenter-slide--lyrics')
                page.evaluate("renderPresenterOutput({...emergencyLivePayload,emergencyMode:true},{animate:false})")
                page.wait_for_selector('#presenterOutputRoot.is-emergency-mode:not(.no-chromakey) .presenter-slide--lyrics')
                assert page.evaluate("""() => {
                  const root=document.getElementById('presenterOutputRoot');
                  if(!document.body.classList.contains('is-emergency-mode'))throw Error('letterbox mode missing');
                  state.presenter.emergencyMode=true;
                  const preview=document.createElement('div');preview.innerHTML=renderPresenterSlideMiniPreview(emergencyLiveSlide,state.presenter.serviceId);
                  if(!preview.querySelector('.is-emergency-mode:not(.no-chromakey)'))throw Error('preview mismatch');
                  if(getComputedStyle(root).getPropertyValue('--presenter-output-bar').trim()!=='#000')throw Error('colored lower bar');
                  if(root.textContent.trim()!=='검은 배경 위의 가사')throw Error('output text changed');
                  const oldOpen=isPresenterOutputWindowOpen;
                  isPresenterOutputWindowOpen=()=>true;
                  try {
                    const ui=document.createElement('div');ui.innerHTML=renderPresenterScreenManagement(state.presenter.serviceId,[emergencyLiveSlide]);
                    const button=ui.querySelector('[data-presenter-action="emergency"]');
                    if(button.disabled||button.getAttribute('aria-pressed')!=='true'||!button.textContent.includes('켜짐'))throw Error('button state');
                    ui.innerHTML=renderPresenterScreenManagement('other',[emergencyLiveSlide]);if(!ui.querySelector('[data-presenter-action="emergency"]').disabled)throw Error('other output action enabled');
                  }finally{isPresenterOutputWindowOpen=oldOpen;}
                  return true;
                }""")
                if engine == 'chromium':
                    page.screenshot(path=str(Path(tempfile.gettempdir()) / 'mindex-emergency-mode-preview.png'))
                page.evaluate("renderPresenterOutput({...emergencyLivePayload,emergencyMode:false},{animate:false})")
                page.wait_for_selector('#presenterOutputRoot.no-chromakey:not(.is-emergency-mode) .presenter-slide--lyrics')
                print(engine, 'PASS real output on/off, preview parity and live-only button state')
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
