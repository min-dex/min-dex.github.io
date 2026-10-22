"""Announcement stage typography and independent overflow fit, without output windows."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1920,'height':1080})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof renderPresenterSlideFrame==='function'&&!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''async()=>{
    await document.fonts.ready;
    const check=(ok,message)=>{if(!ok)throw Error(message)};
    const regions={welcome:'오늘도 **환영**합니다.',news:'① **이번 주** 모임 안내',footer:'함께 기도해 주세요.'};
    const slide={type:'liturgical-body',layout:'center_text',elementType:'body_text',sectionKey:'announcements',title:'광고',announcementRegions:regions,announcementItems:presenterAnnouncementItems(regions.news)};
    refs.detailPane.innerHTML='<div id="type-stage" class="presenter-output-root no-chromakey" style="position:relative;width:1920px;height:1080px">'+renderPresenterSlideFrame(slide,{noChromakey:true})+'</div>';
    const stage=document.querySelector('#type-stage');
    for(const width of [1920,960]) {
     stage.style.width=width+'px';stage.style.height=(width*9/16)+'px';
     const scale=width/1920;
     const sizes=()=>[...stage.querySelectorAll('.presenter-announcement-region')].map(e=>parseFloat(getComputedStyle(e).fontSize));
     fitPresenterSongTitleText(stage);
     const actual=sizes();
     [50,60,50].forEach((size,i)=>check(Math.abs(actual[i]-size*scale)<.1,'region size '+i+': '+actual));
     for(const region of stage.querySelectorAll('.presenter-announcement-region')) {
      check(getComputedStyle(region).fontWeight==='600','region weight');
      check(region.scrollHeight<=region.clientHeight+1&&region.scrollWidth<=region.clientWidth+1,'region clipped');
     }
     for(const strong of stage.querySelectorAll('strong'))check(getComputedStyle(strong).fontWeight==='800','emphasis weight');
     check(Math.abs(parseFloat(getComputedStyle(stage.querySelector('.presenter-liturgical-body-heading span')).fontSize)-100*scale)<.1,'title size changed');
    }
    stage.style.width='1920px';stage.style.height='1080px';
    const news=stage.querySelector('.presenter-announcement-region--news');
    const footer=stage.querySelector('.presenter-announcement-region--footer');
    const anchor=footer.getBoundingClientRect().bottom;
    news.innerHTML=renderPresenterAnnouncementItems(presenterAnnouncementItems('① '+('긴 광고 내용 '.repeat(100))),slide);
    fitPresenterSongTitleText(stage);
    check(news.scrollHeight<=news.clientHeight+1&&news.scrollWidth<=news.clientWidth+1,'long news clipped');
    check(parseFloat(getComputedStyle(news).fontSize)<60,'long news did not fit');
    check(Math.abs(footer.getBoundingClientRect().bottom-anchor)<1,'footer anchor moved');
    check(Math.abs(parseFloat(getComputedStyle(footer).fontSize)-50)<.1,'news resized footer');
    return 'PASS50/60/50px,600/800 weights,100px title, stage scaling and independent long-copy fit';
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
