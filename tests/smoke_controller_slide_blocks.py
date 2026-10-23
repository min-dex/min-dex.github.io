"""Controller grouping preserves source/order and separates repeated runs and ranges."""
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch(headless=True)
   page=browser.new_page(viewport={'width':1000,'height':900})
   page.add_init_script('Element.prototype.requestFullscreen=async()=>{};Element.prototype.webkitRequestFullscreen=()=>{};window.open=()=>null')
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?output=presenter',wait_until='domcontentloaded')
   page.wait_for_function("typeof presenterBoardSlideBlocks==='function'")
   print(engine,page.evaluate('''()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const lyric=(key,label)=>({elementId:'song',elementType:'praise',layout:'lower_bar_text',type:'lyrics',formKey:key,formLabel:label,text:'주님을 찬양합니다',title:'찬양'});
    const verse=(range,translation='개역개정')=>({elementId:'bible',elementType:'scripture_text',layout:'lower_bar_text',type:'scripture',referenceBook:'요한복음',referenceRange:range,translationLabel:translation,title:'요한복음 '+range,text:'성경 본문'});
    const blank={elementId:'song',elementType:'blank',layout:'blank',type:'blank',title:'빈 화면'};
    const slides=[lyric('v1:0','Verse 1'),lyric('v1:0','Verse 1'),lyric('c:1','Chorus'),lyric('c:2','Chorus'),blank,verse('3:16–18'),verse('3:16–18'),verse('4:1–2'),verse('4:1–2','새번역')];
    const entries=slides.map((slide,slideIndex)=>({slide:{...slide,id:'slide-'+slideIndex},slideIndex}));
    const score=(owner,key,label)=>({slide:{elementId:owner,elementType:'image',layout:'media',sourceType:'score',formKey:key,formLabel:label,title:'악보'},slideIndex:0});
    const scoreEntries=[score('hymn','',''),score('hymn','v1','Verse 1'),score('hymn','',''),score('hymn','v2','Verse 2'),score('hymn','',''),score('other','','')];
    const scoreBefore=JSON.stringify(scoreEntries);
    const annotatedScores=annotatePresenterFormStarts(scoreEntries).entries;
    check(presenterBoardSlideBlocks(annotatedScores).map(b=>b.entries.length).join()==='1,2,2,1','score continuation/owner boundary');
    check(annotatedScores.map(e=>e.formLabel).join('|')==='|Verse 1||Verse 2||','score labels only on starts');
    check(JSON.stringify(scoreEntries)===scoreBefore,'score source mutated');
    const colors=Array.from({length:8},(_,i)=>score('hymn','v'+i,'Verse '+(i+1)));
    const colorHtml=renderPresenterBoardSlideBlocks(annotatePresenterFormStarts(colors).entries,-1,'fixture');
    check([...colorHtml.matchAll(/data-form-color="(\d)"/g)].map(m=>m[1]).join()==='0,1,2,3,4,5,0,1','ordered six-color cycle');
    const before=JSON.stringify(entries), blocks=presenterBoardSlideBlocks(entries);
    check(blocks.map(b=>b.entries.length).join()==='2,1,1,1,2,1,1','group boundaries');
    check(!blocks[3].key,'blank grouped');
    check(JSON.stringify(entries)===before,'output data mutated');
    check(blocks.flatMap(b=>b.entries).every((e,i)=>e===entries[i]),'entry identity/order');
    document.body.innerHTML='<div style="padding:20px;width:100%;box-sizing:border-box"><div class="svc-board-grid" id="blocks"></div></div>';
    document.body.classList.remove('ui-booting');document.body.style.cssText='display:block;margin:0;background:var(--bg)';
    document.getElementById('blocks').innerHTML=renderPresenterBoardSlideBlocks(annotatePresenterFormStarts(entries).entries,1,'fixture');
    const buttons=[...document.querySelectorAll('.svc-slide-thumb')];
    check(buttons.map(b=>b.dataset.presenterIndex).join()==='0,1,2,3,4,5,6,7,8','navigation indexes');
    check(buttons[1].getAttribute('aria-current')==='step','active slide');
    check(document.querySelectorAll('.svc-board-slide-block').length===6,'rendered blocks');
    const plain=document.createElement('div');plain.id='plain-blocks';plain.className='svc-board-grid';
    const mixed=['Title','Verse 1','Int','Chorus'].map((label,i)=>({slide:{...lyric(label+':'+i,label),id:'plain-'+i},slideIndex:20+i}));
    plain.innerHTML=renderPresenterBoardSlideBlocks(annotatePresenterFormStarts(mixed).entries,-1,'fixture');
    document.body.append(plain);
    const groups=[...plain.querySelectorAll('.svc-board-slide-block')];
    check(groups.length===4 && groups[0].dataset.formPlain==='true' && groups[2].dataset.formPlain==='true','Title/Int plain grouping');
    check(groups[1].dataset.formColor==='0' && groups[3].dataset.formColor==='1','Title/Int consumed lyric colors');
    check(plain.querySelectorAll('.svc-slide-form-badge').length===4,'plain group labels lost');
    check([...plain.querySelectorAll('.svc-slide-thumb')].map(e=>e.dataset.presenterIndex).join()==='20,21,22,23','plain group click targets changed');
    return 'PASS form boundaries, source/order, grid geometry, plain Title/Int and click targets';
   }'''),flush=True)
   for width in [320,700,1100]:
    page.set_viewport_size({'width':width,'height':900})
    for theme in ['dark','light']:
     page.evaluate('(theme)=>{applyTheme(theme);updatePresenterBoardBlockBackgrounds(document)}',theme)
     page.evaluate('''()=>{
       const plain=document.getElementById('plain-blocks');
       for(const block of plain.querySelectorAll('[data-form-plain]')) {
         if(block.querySelector('.svc-board-block-background'))throw Error('Title/Int background box remains');
         const label=block.querySelector('.svc-slide-form-badge');
         if(!label || getComputedStyle(label).backgroundColor!=='rgba(0, 0, 0, 0)')throw Error('Title/Int label is boxed');
       }
       if(plain.querySelectorAll('.svc-board-block-background').length<2)throw Error('lyric group backgrounds lost');
       const grid=document.getElementById('blocks');
       for(const meta of grid.querySelectorAll('.svc-slide-thumb-meta')) {
         const number=meta.querySelector('.svc-slide-thumb-no'), badge=meta.querySelector('.svc-slide-form-badge');
         const nr=number.getBoundingClientRect(), mr=meta.getBoundingClientRect();
         if(Math.abs(nr.right-(mr.right-1))>0.1)throw Error('number not fixed at right edge');
         if(badge && (badge.getBoundingClientRect().right>nr.left || Math.abs(badge.getBoundingClientRect().left-(mr.left+1))>0.1))throw Error('badge not at left edge');
       }
       const baseline=grid.cloneNode(true); baseline.id='baseline';
       for(const block of baseline.querySelectorAll('.svc-board-slide-block')) block.replaceWith(...block.querySelectorAll(':scope > .svc-slide-thumb-wrap'));
       grid.after(baseline);
       const boxes=root=>{const origin=root.getBoundingClientRect();return [...root.querySelectorAll('.svc-slide-thumb-wrap')].map(e=>{const r=e.getBoundingClientRect();return [r.x-origin.x,r.y-origin.y,r.width,r.height]})};
       const actual=boxes(grid), original=boxes(baseline);
       if(actual.some((box,i)=>box.some((v,j)=>Math.abs(v-original[i][j])>0.1)))throw Error('original grid geometry changed');
       baseline.remove();
       const backgrounds=[...grid.querySelectorAll('.svc-board-block-background')];
       if(backgrounds.length<6 || backgrounds.some(e=>getComputedStyle(e).position!=='absolute'||getComputedStyle(e).pointerEvents!=='none'))throw Error('background enters layout or intercepts clicks');
     }''')
     assert page.evaluate('''()=>[...document.querySelectorAll('.svc-board-grid,.svc-board-slide-block')].every(e=>e.scrollWidth<=e.clientWidth+1)'''),(engine,width,theme)
     if width==700:page.screenshot(path=f'/tmp/mindex-slide-blocks-{engine}-{theme}.png')
   browser.close()
finally:server.shutdown()
