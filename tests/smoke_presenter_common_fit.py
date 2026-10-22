"""Common stage-unit fitting, including preview/output parity and readable floors."""
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
      check(Math.abs(normalized/5-Math.round(normalized/5))<.001,'not5px step');
      check(normalized>=PRESENTER_TEXT_FIT[row.role]-.01,'below floor');
      const before=box.style.fontSize;fitPresenterTextBox(box,{role:row.role});
      check(before===box.style.fontSize,'refit drifts');
      sizes.push({size:Math.round(normalized*100)/100,overflow:box.dataset.presenterFitOverflow==='true'});
     }
     check(JSON.stringify(sizes[0])===JSON.stringify(sizes[1])&&JSON.stringify(sizes[0])===JSON.stringify(sizes[2]),'preview/output mismatch '+JSON.stringify({row,sizes}));
     results.push(sizes[0]);
    }
    // Hard floor reports unfit content; shortening it clears the warning and restores base.
    const root=document.createElement('div');root.className='presenter-output-root';root.style.cssText='position:relative;width:1920px;height:1080px;transform:none';
    const box=document.createElement('div');box.className='common-fit-box';box.style.cssText='--test-base:60px;width:200px;height:50px;white-space:nowrap';box.textContent='정말 긴 내용'.repeat(100);root.append(box);host.replaceChildren(root);
    fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)===40&&box.dataset.presenterFitOverflow==='true','no readable floor warning');
    box.textContent='짧게';box.style.height='100px';fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)===60&&!box.dataset.presenterFitOverflow,'warning did not reset');
    // Existing smaller helper copy is never enlarged to the shared floor.
    box.style.setProperty('--test-base','30px');box.textContent='작은 안내';fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)===30,'helper enlarged');
    return {result:'PASS common5px fit,40/70 floors, preview/output parity, retry reset and small-copy preservation',results};
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
