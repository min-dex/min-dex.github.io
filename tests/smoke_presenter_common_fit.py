"""Common stage-unit fitting, including preview/output parity without readability floors."""
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
   page.wait_for_function("typeof fitPresenterTextBox==='function'&&!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''async()=>{
    await document.fonts.ready;
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    const cases=[
     {role:'body',base:60,text:'광고 문장 '.repeat(12),width:800,height:130},
     {role:'body',base:105,text:'1 찬양 가사 '.repeat(10),width:1300,height:160},
     {role:'body',base:70,text:'성경 본문 '.repeat(20),width:1200,height:160},
     {role:'body',base:55,text:'전례문 본문 '.repeat(15),width:1300,height:200},
     {role:'title',base:150,text:'함께 부르는 긴 찬양 제목입니다'.repeat(2),width:1400,height:200},
     {role:'title',base:100,text:'긴 설교 제목과 하나님의 말씀'.repeat(2),width:1100,height:200}
    ];
    refs.detailPane.innerHTML='<style>.common-fit-box{font:600 var(--test-base) sans-serif;line-height:1.2}</style><div id="common-fit-fixture"></div>';
    const host=document.querySelector('#common-fit-fixture');
    const results=[];
    for(const row of cases) {
     const sizes=[];
     for(const [width,mini] of [[1920,false],[1280,false],[1920,true]]) {
      const scale=width/1920;
      const root=document.createElement('div');root.className='presenter-output-root no-chromakey'+(mini?' svc-slide-mini-canvas':'');
      root.style.cssText=`position:relative;left:0;top:0;transform:${mini?'scale(.2)':'none'};width:${width}px;height:${width*9/16}px;max-width:none;container-type:size`;
      const box=document.createElement('div');box.className='common-fit-box';box.textContent=row.text;
      box.style.cssText=`--test-base:${row.base*scale}px;width:${row.width*scale}px;height:${row.height*scale}px;overflow:hidden;white-space:${row.role==='title'?'nowrap':'normal'};word-break:keep-all`;
      root.append(box);host.replaceChildren(root);
      fitPresenterTextBox(box,{role:row.role});
      const normalized=parseFloat(getComputedStyle(box).fontSize)/scale;
      check(Math.abs(normalized-Math.round(normalized))<.02,'not1px step');
      check(!box.dataset.presenterFitOverflow,'content still overflows');
      const before=box.style.fontSize;fitPresenterTextBox(box,{role:row.role});
      check(before===box.style.fontSize,'refit drifts');
      if(normalized+1<=row.base) {
        box.style.fontSize=`${(normalized+1)*scale}px`;
        check(!presenterTextFits(box,row.role),'fitting did not choose largest grid size');
        box.style.fontSize=before;
      }
      sizes.push({size:Math.round(normalized*100)/100,overflow:box.dataset.presenterFitOverflow==='true'});
     }
     // The 1920px output and thumbnail stages must match exactly. Native
     // viewport glyph/wrap rounding can move the finer fit by one grid unit.
     check(JSON.stringify(sizes[0])===JSON.stringify(sizes[2])&&Math.abs(sizes[0].size-sizes[1].size)<=1.02,'preview/output mismatch '+JSON.stringify({row,sizes}));
     results.push(sizes[0]);
    }
    // Long text can shrink below the former floor; shortening restores the base.
    const root=document.createElement('div');root.className='presenter-output-root';root.style.cssText='position:relative;width:1920px;height:1080px;transform:none';
    const box=document.createElement('div');box.className='common-fit-box';box.style.cssText='--test-base:60px;width:200px;height:50px;white-space:nowrap';box.textContent='정말 긴 내용'.repeat(20);root.append(box);host.replaceChildren(root);
    fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)<40&&!box.dataset.presenterFitOverflow,'old floor retained');
    box.textContent='짧게';box.style.height='100px';fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)===60&&!box.dataset.presenterFitOverflow,'warning did not reset');
    // Existing smaller helper copy is never enlarged to the shared floor.
    box.style.setProperty('--test-base','30px');box.textContent='작은 안내';fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)===30,'helper enlarged');
    root.className='presenter-output-root no-chromakey';
    for(const sermon of [false,true]) {
      const slide={type:'title-assignee',elementType:PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,label:sermon?'설교':'대표기도',title:'함께 드리는 감사의 기도 제목입니다'.repeat(3),assignee:'홍길동 집사와 함께하는 예배 준비 위원회 대표'.repeat(2),...(sermon?{sectionKey:'sermon',contentTitle:'함께 드리는 감사의 말씀 제목입니다'.repeat(3)}:{})};
      root.innerHTML=renderPresenterSlideFrame(slide,{noChromakey:true});
      fitPresenterSermonTitleText(root);
      const beforeFit=root.innerHTML;fitPresenterSermonTitleText(root);check(root.innerHTML===beforeFit,'order/person refit drifts');
      for(const node of root.querySelectorAll('.presenter-title-assignee-title,.presenter-title-assignee-content,.presenter-title-assignee-person')) {
        check(presenterTextFits(node,'title'),'order/person overflow '+JSON.stringify({sermon,cls:node.className,size:getComputedStyle(node).fontSize,w:node.clientWidth,sw:node.scrollWidth}));
        const bounds=node.getBoundingClientRect(),stage=root.getBoundingClientRect();
        check(bounds.left>=stage.left-1 && bounds.right<=stage.right+1,'order/person outside stage '+JSON.stringify({sermon,cls:node.className,bounds:bounds.toJSON(),stage:stage.toJSON()}));
      }
    }
    return {result:'PASS common1px fit, no readability floors, preview/output parity, retry reset and small-copy preservation',results};
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
