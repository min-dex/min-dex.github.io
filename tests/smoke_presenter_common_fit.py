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
    // Past all-generations Cadaros special-song title: padded bar is nudged,
    // but the visible title remains safely inside the stage.
    for (const width of [1920,640,240]) {
      const root=document.createElement('main');root.className='presenter-output-root';
      root.style.cssText=`position:relative;width:${width}px;height:${width*1080/1920}px;transform:none`;
      root.innerHTML=renderPresenterSlideFrame({type:'song-title',elementType:'praise',layout:'lower_bar_text',captionTheme:'cadaros',title:'교회',text:'교회',sectionKey:'special_song'});
      host.replaceChildren(root);fitPresenterSongTitleText(root);
      const title=root.querySelector('.presenter-slide-text');
      check(!title.dataset.presenterFitOverflow,'Cadaros title false overflow '+width);
      title.innerHTML='<span>'+('교회'.repeat(200))+'</span>';
      check(!presenterTextFits(title,'title'),'real title overflow missing '+width);
    }
    // Long text can shrink below the former floor; shortening restores the base.
    const root=document.createElement('div');root.className='presenter-output-root';root.style.cssText='position:relative;width:1920px;height:1080px;transform:none';
    const box=document.createElement('div');box.className='common-fit-box';box.style.cssText='--test-base:60px;width:200px;height:50px;white-space:nowrap';box.textContent='정말 긴 내용'.repeat(20);root.append(box);host.replaceChildren(root);
    fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)<40&&!box.dataset.presenterFitOverflow,'old floor retained');
    box.textContent='짧게';box.style.height='100px';fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)===60&&!box.dataset.presenterFitOverflow,'warning did not reset');
    // Existing smaller helper copy is never enlarged to the shared floor.
    box.style.setProperty('--test-base','30px');box.textContent='작은 안내';fitPresenterTextBox(box);check(parseFloat(getComputedStyle(box).fontSize)===30,'helper enlarged');
    root.className='presenter-output-root no-chromakey';
    for(const kind of ['pair','solo','sermon','order-content','three-part']) {
      const sermon=kind==='sermon';
      const slide={type:'title-assignee',elementType:PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,label:sermon?'설교':'대표기도',title:'함께 드리는 감사의 기도 제목입니다'.repeat(3),assignee:'홍길동 집사와 함께하는 예배 준비 위원회 대표'.repeat(2),...(sermon?{sectionKey:'sermon',contentTitle:'함께 드리는 감사의 말씀 제목입니다'.repeat(3)}:{}),...(['order-content','three-part'].includes(kind)?{orderTitle:'순서 제목'.repeat(8),contentTitle:'함께 부르는 찬양의 긴 제목'.repeat(4)}:{}),...(['solo','order-content'].includes(kind)?{assignee:''}:{})};
      root.innerHTML=renderPresenterSlideFrame(slide,{noChromakey:true});
      fitPresenterSermonTitleText(root);
      const beforeFit=root.innerHTML;fitPresenterSermonTitleText(root);check(root.innerHTML===beforeFit,'order/person refit drifts');
      for(const node of root.querySelectorAll('.presenter-title-assignee-title,.presenter-title-assignee-content,.presenter-title-assignee-person')) {
        check(presenterTextFits(node,'title'),'order/person overflow '+JSON.stringify({sermon,cls:node.className,size:getComputedStyle(node).fontSize,w:node.clientWidth,sw:node.scrollWidth}));
        const bounds=node.getBoundingClientRect(),stage=root.getBoundingClientRect();
        check(bounds.left>=stage.left-1 && bounds.right<=stage.right+1,'order/person outside stage '+JSON.stringify({sermon,cls:node.className,bounds:bounds.toJSON(),stage:stage.toJSON()}));
      }
    }
    const E=PRESENTER_ELEMENT_TYPES,L=PRESENTER_SLIDE_LAYOUTS;
    const supplemental=[
      {name:'subtitle',selector:'.presenter-fullscreen-song-detail',slide:{type:'song-title',elementType:E.PRAISE,layout:L.LOWER_BAR_TEXT,songTitle:'찬양 제목',songTitleContent:{title:'찬양 제목',detail:('함께 부르는 찬양의 원제와 부제 설명 ').repeat(40),detailKind:'subtitle'}}},
      {name:'body',selector:'.presenter-title-content-body',slide:{type:'title-content',elementType:E.TITLE_CONTENT,layout:L.CENTER_TEXT,title:'안내',bodyText:Array.from({length:15},(_,i)=>(i+1)+' 예배를 준비하며 함께 나눌 안내 내용입니다.').join('\\n')}},
      {name:'header',selector:'.presenter-scripture-reading-ref,.presenter-scripture-reading-version',slide:{type:'scripture',elementType:E.SCRIPTURE_TEXT,layout:L.LOWER_BAR_TEXT,scriptureContext:'reading',title:('요한계시록 21:1–22:21, ').repeat(7),translationLabel:'New Revised Standard Version Updated Edition',text:'1 성경 본문'}},
      {name:'assignee',selector:'.presenter-assignee-tab',slide:{type:'title-assignee',elementType:E.TITLE_ASSIGNEE,layout:L.LOWER_BAR_TEXT,sectionKey:'scripture_reading',label:'성경봉독',title:'성경봉독',scriptureReadingAssignee:'홍길동 집사 · 김민수 집사 · 이영희 집사 · 박민수 집사',assignee:'다같이'}},
      {name:'ready',selector:'.presenter-ready-screen-message',slide:{type:'ready',readyServiceName:('2026년검단우리교회온세대추수감사절감사찬양예배').repeat(5)}},
      {name:'waiting',chromakey:true,selector:'.presenter-waiting-loop-title',slide:{type:'ready',presenterRole:'waiting_loop',outputContext:'chromakey',readyServiceName:('2026년검단우리교회온세대추수감사절감사찬양예배').repeat(15)}},
      {name:'freeform',selector:'.presenter-slide-text',slide:{type:'component',elementType:E.FREEFORM,layout:L.CENTER_TEXT,title:'',text:'함께 드리는 예배의 안내 문장입니다.'.repeat(8)}}
    ];
    const supplementalResults=[];
    for(const row of supplemental){
      const sizes=[];
      for(const mini of [false,true]){
        root.className='presenter-output-root'+(row.chromakey?'':' no-chromakey')+(mini?' svc-slide-mini-canvas':'');
        root.style.cssText=`position:relative;left:0;top:0;width:1920px;height:1080px;transform:${mini?'scale(.2)':'none'}`;
        root.innerHTML=renderPresenterSlideFrame(row.slide,{noChromakey:!row.chromakey});
        const nodes=[...root.querySelectorAll(row.selector)];check(nodes.length>0,'missing fixture '+row.name);
        const base=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
        fitPresenterSongTitleText(root);fitPresenterSermonTitleText(root);
        const fitted=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
        check(fitted.some((n,i)=>n<base[i]),'not fitted '+row.name);
        const stage=root.getBoundingClientRect(),tolerance=stage.width/1920;
        nodes.forEach((n,i)=>{
          check(!n.dataset.presenterFitOverflow,'still overflowing '+row.name);
          check(n.scrollWidth<=n.clientWidth+1,'horizontal overflow '+row.name);
          const rect=n.getBoundingClientRect();
          check(rect.left>=stage.left-tolerance&&rect.right<=stage.right+tolerance&&rect.top>=stage.top-tolerance&&rect.bottom<=stage.bottom+tolerance,'outside stage '+row.name);
          check(Number.isInteger(fitted[i])&&fitted[i]<=base[i],'bad grid '+row.name);
        });
        fitPresenterSongTitleText(root);fitPresenterSermonTitleText(root);
        check(JSON.stringify(fitted)===JSON.stringify(nodes.map(n=>parseFloat(getComputedStyle(n).fontSize))),'supplemental refit drift '+row.name);
        sizes.push(fitted);
        // Editing back to short text restores the authored base at the same node.
        nodes.forEach(n=>n.textContent='짧게');fitPresenterSermonTitleText(root);
        nodes.forEach((n,i)=>check(parseFloat(getComputedStyle(n).fontSize)===base[i],'short content shrunk '+row.name+JSON.stringify({base:base[i],after:getComputedStyle(n).fontSize,h:n.clientHeight,sh:n.scrollHeight,html:n.outerHTML})));
      }
      check(JSON.stringify(sizes[0])===JSON.stringify(sizes[1]),'supplemental preview/output mismatch '+row.name);
      supplementalResults.push({name:row.name,sizes:sizes[0]});
    }
    results.push({supplemental:supplementalResults});
    return {result:'PASS common1px fit, no readability floors, preview/output parity, retry reset and small-copy preservation',results};
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
