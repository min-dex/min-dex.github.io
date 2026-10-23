"""Authored artwork is shared by fullscreen output and thumbnails, without changing content."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as p:
   for engine in ('chromium','webkit'):
    browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
    page=browser.new_page(viewport={'width':1920,'height':1080})
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
    page.goto(url+'?output=presenter');page.wait_for_function("typeof WORSHIP_BACKGROUND_BASE==='string' && typeof renderPresenterOutput==='function'")
    result=page.evaluate('''async()=>{
     const check=(v,m)=>{if(!v)throw Error(m)};
     const design={sectionKeys:['reading','sermon'],background:'#ffffff',foreground:'#292522',accent:'#ad371d',logo:'assets/transition-logos/on-fire.svg',showReadingEnd:false};
     const slide={id:'reading',sectionKey:'reading',elementType:'scripture_text',layout:'lower_bar_text',type:'scripture',scriptureContext:'reading',referenceBook:'시편',referenceRange:'23:1',title:'시편 23:1',translationLabel:'개역개정',scriptureReadingFinal:true,text:'1  여호와는 나의 목자시니 내게 부족함이 없으리로다'};
     const before=JSON.stringify(slide),payload={serviceId:'fixture',serviceType:'special',chromakey:false,presentationDesign:design,slides:[slide],index:0};
     check(normalizePresenterPayload(payload).presentationDesign.accent===design.accent,'payload drops artwork');
     const html=renderPresenterSlideFrame(slide,{noChromakey:true,presentationDesign:design});
     check(html.includes('presenter-slide--service-design')&&!html.includes('Fin.')&&!html.includes('scripture-reading-cross.png'),'old artwork/end marker leaked');
     check(JSON.stringify(slide)===before,'renderer mutated content');
     for(const candidate of [{...slide,sectionKey:'other'},{...slide,type:'blank',layout:'blank'},{...slide,elementType:'image',type:'image'}])
      check(!renderPresenterSlideFrame(candidate,{noChromakey:true,presentationDesign:design}).includes('presenter-slide--service-design'),'design leaked into other content');
     check(!renderPresenterSlideFrame(slide,{noChromakey:false,presentationDesign:design}).includes('presenter-slide--service-design'),'design leaked into keyed output');
     const defaultHtml=renderPresenterSlideFrame(slide,{noChromakey:true});check(defaultHtml.includes('Fin.')&&defaultHtml.includes('scripture-reading-cross.png'),'unconfigured services changed');
     check(presenterOutputFrameKey(payload,slide,presenterOutputFrameStateForSlide(slide,payload))!==presenterOutputFrameKey({...payload,presentationDesign:{...design,accent:'#112233'}},slide,presenterOutputFrameStateForSlide(slide,payload)),'artwork changes reuse stale frame');
     renderPresenterOutput(payload,{});await document.fonts.ready;await new Promise(resolve=>setTimeout(resolve,400));
     const root=document.getElementById('presenterOutputRoot'),section=root.querySelector('.presenter-slide');
     check(getComputedStyle(section).backgroundColor==='rgb(255, 255, 255)','output not paper white');
     const text=root.querySelector('.presenter-scripture-reading-text');check(getComputedStyle(text).wordBreak==='keep-all','reading breaks Korean words');
     const mini=document.createElement('div');mini.innerHTML=renderPresenterSlideFrame(slide,{noChromakey:true,previewStage:true,presentationDesign:design});check(mini.textContent.includes('부족함이 없으리로다')&&!mini.textContent.includes('Fin.'),'preview differs from output');
     const service={id:'fixture',type_id:'special'},item={id:'speaker',label:'설교',raw_title:'',assignee:'이름 목사',memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text'})};
     const missing=presenterMissingContentSlide(item,{sectionKey:'sermon',sectionTitle:'설교',orderTitle:'설교'},0,{state:'missing'},service);
     check(missing.assignee==='이름 목사','empty title hides authored speaker');
     const sermon=normalizeCleanPresenterSlideLayout(missing),sermonHtml=renderPresenterSlideFrame(sermon,{noChromakey:true,presentationDesign:design});
     const holder=document.createElement('div');holder.innerHTML=sermonHtml;check(holder.textContent.includes('이름 목사')&&!holder.querySelector('.presenter-fullscreen-order-heading'),'duplicate empty-title heading or missing speaker');
     check(!normalizePresenterServiceDesign({sectionKeys:[]}), 'empty selection enabled design');
     check(normalizePresenterServiceDesign({...design,accent:'red;display:none',logo:'javascript:bad.svg'}).accent==='#ad371d','unsafe style accepted');
     return 'PASS artwork isolation, default preservation, source nonmutation, payload/cache, preview parity and empty-title speaker';
    }''')
    print(engine,result,flush=True);browser.close()
 finally:server.shutdown()

if __name__=='__main__':main()
