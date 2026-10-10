"""Announcement-only typography, exact source retention and highlight overlap."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1440,'height':900})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("typeof renderPresenterHighlightedText === 'function' && typeof normalizeServiceTextHighlights === 'function' && typeof buildPresenterSlidesForServiceItem === 'function'")
   print(engine,page.evaluate('''() => {
    const check=(v,m)=>{if(!v)throw Error(m)};
    const host=document.createElement('div');host.style.cssText='font-size:40px;background:#111;color:white;padding:30px';document.body.prepend(host);
    const texts=['모임 안내 (오후 2시, 교육관)','안내(가족(어린이 포함)) 및 （별도 신청）','안내 (미완성','안내 <img src=x onerror=alert(1)> (문의 & 신청)','모임 (오후 2시) 안내'];
    for(const text of texts) {
     const slide={announcementItems:[{lines:[text]}],textHighlights:[{text:'오후 2시) 안내',color:'#ff0000',bold:true}]};
     const snapshot=JSON.stringify(slide);
     host.innerHTML=renderPresenterHighlightedText(text,slide);
     check(host.textContent===text,'text changed');
     check(!host.querySelector('img'),'unsafe HTML');
     check(JSON.stringify(slide)===snapshot,'slide mutated');
     check(!host.querySelector('.presenter-announcement-paren .presenter-announcement-paren'),'nested shrinking');
     for(const span of host.querySelectorAll('.presenter-announcement-paren')) check(Math.abs(parseFloat(getComputedStyle(span).fontSize)/parseFloat(getComputedStyle(span.parentElement).fontSize)-.8)<.001,'ratio');
     if(text.includes('미완성'))check(!host.querySelector('.presenter-announcement-paren'),'unmatched shrunk');
     if(text==='모임 (오후 2시) 안내')check(host.querySelector('.presenter-text-highlight').textContent==='오후 2시) 안내','highlight split changed');
     check(!renderPresenterHighlightedText(text,{textHighlights:slide.textHighlights}).includes('presenter-announcement-paren'),'other text shrunk');
    }
    for(const type of ['young-adult','sunday-main']) {
     const service={id:'ad-parenthesis',type_id:type};
     const text='1. 모임 안내 (오후 2시, 교육관)';
     const item={id:'ad',label:'광고',raw_title:text,_worshipSectionKey:'announcements',memo:serializeServiceItemMemo({elementType:'body',inputMode:'text'})};
     const before=JSON.stringify(item);
     const slide=buildPresenterSlidesForServiceItem(item,service,0).find(x=>x.announcementItems?.length);
     check(slide,'announcement slide missing');
     host.className=type==='young-adult'?'presenter-output-root no-chromakey':'presenter-output-root';
     host.innerHTML=`<div class="presenter-slide presenter-slide--${slide.type}">${renderPresenterSlideBody(slide)}</div>`;
     const paren=host.querySelector('.presenter-announcement-paren');check(paren,'output parentheses missing');
     check(Math.abs(parseFloat(getComputedStyle(paren).fontSize)/parseFloat(getComputedStyle(paren.parentElement).fontSize)-.8)<.001,'output ratio '+type);
     check(JSON.stringify(item)===before,'stored source changed');
    }
    return 'PASS 80% output, nested/fullwidth/unmatched pairs, escaping, overlapping highlights, unchanged source and other text';
   }'''),flush=True)
   browser.close()
finally: server.shutdown()
