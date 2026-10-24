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
   page.wait_for_function("typeof state !== \"undefined\" && typeof compactSearchValue === \"function\" && !document.body.classList.contains('ui-booting') && (typeof presenterBoardSlideBlocks==='function')")
   print(engine,page.evaluate('''()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const lyric=(key,label)=>({elementId:'song',elementType:'praise',layout:'lower_bar_text',type:'lyrics',formKey:key,formLabel:label,text:'주님을 찬양합니다',title:'찬양'});
    const verse=(range,translation='개역개정')=>({elementId:'bible',elementType:'scripture_text',layout:'lower_bar_text',type:'scripture',referenceBook:'요한복음',referenceRange:range,translationLabel:translation,title:'요한복음 '+range,text:'성경 본문'});
    const blank={elementId:'song',elementType:'blank',layout:'blank',type:'blank',title:'빈 화면'};
    const slides=[lyric('v1:0','Verse 1'),lyric('v1:0','Verse 1'),lyric('c:1','Chorus'),lyric('c:2','Chorus'),blank,verse('3:16–18'),verse('3:16–18'),verse('4:1–2'),verse('4:1–2','새번역')];
    const entries=slides.map((slide,slideIndex)=>({slide:{...slide,id:'slide-'+slideIndex},slideIndex}));
    const continuation=[lyric('v1:0','Verse 1'),lyric('v1:0',''),lyric('c:1','Chorus'),lyric('c:1',''),lyric('c:2',''),blank,lyric('c:1',''),{...lyric('v1:0',''),elementId:'other'}].map((slide,slideIndex)=>({slide,slideIndex}));
    const continuationBefore=JSON.stringify(continuation);
    const grouped=annotatePresenterFormStarts(continuation).entries;
    check(presenterBoardSlideBlocks(grouped).map(b=>b.entries.length).join()==='2,2,1,1,1,1','lyric continuation must share block; no inheritance across form/blank/owner');
    check(grouped.map(e=>e.formLabel).join('|')==='Verse 1||Chorus|||||','lyric labels remain only on starts');
    check(JSON.stringify(continuation)===continuationBefore,'lyric continuation changes source data');
    const score=(owner,key,label)=>({slide:{elementId:owner,elementType:'image',layout:'media',sourceType:'score',formKey:key,formLabel:label,title:'악보'},slideIndex:0});
    const scoreEntries=[score('hymn','',''),score('hymn','v1','Verse 1'),score('hymn','',''),score('hymn','v2','Verse 2'),score('hymn','',''),score('other','','')];
    const scoreBefore=JSON.stringify(scoreEntries);
    const annotatedScores=annotatePresenterFormStarts(scoreEntries).entries;
    check(presenterBoardSlideBlocks(annotatedScores).map(b=>b.entries.length).join()==='1,2,2,1','score continuation/owner boundary');
    check(annotatedScores.map(e=>e.formLabel).join('|')==='|Verse 1||Verse 2||','score labels only on starts');
    check(JSON.stringify(scoreEntries)===scoreBefore,'score source mutated');
    const wholeScores=[score('whole','',''),score('whole','raw-page-key',''),score('whole','',''),score('next','',''),score('next','','')];
    const wholeBefore=JSON.stringify(wholeScores);
    const wholeBlocks=presenterBoardSlideBlocks(annotatePresenterFormStarts(wholeScores).entries);
    check(wholeBlocks.map(b=>b.entries.length).join()==='3,2' && wholeBlocks.every(b=>b.key && b.label==='악보'),'unlabelled score whole blocks and owner boundaries');
    check(JSON.stringify(wholeScores)===wholeBefore,'whole score grouping mutated source');
    const wholeHtml=renderPresenterBoardSlideBlocks(annotatePresenterFormStarts(wholeScores).entries,-1,'fixture');
    check((wholeHtml.match(/data-form-color="neutral"/g)||[]).length===2 && !wholeHtml.includes('svc-slide-form-badge'),'whole score gets neutral block without invented form label');
    const noForms=[{slide:{elementId:'direct',elementType:'praise',layout:'lower_bar_text',type:'lyrics',text:'직접 가사'},slideIndex:0}];
    check(!presenterBoardSlideBlocks(noForms)[0].key,'unlabelled direct lyrics must remain unboxed');
    const labels=['Verse 1','Verse 2','Verse 2 A','Verse 2 B','Verse 2 @ A','Pre-Chorus','Chorus','Bridge','Coda','Tag','Tags','Custom'];
    const colors=labels.map((label,i)=>score('hymn','form-'+i,label));
    const colorHtml=renderPresenterBoardSlideBlocks(annotatePresenterFormStarts(colors).entries,-1,'fixture');
    check([...colorHtml.matchAll(/data-form-color="([a-z-]+)"/g)].map(m=>m[1]).join()==='verse,verse,verse,verse,verse,pre-chorus,chorus,bridge,coda,tag,tag,neutral','fixed form colors and variants');
    const crossSections=[verse('3:16'),{...verse('4:1'),elementId:'bible-2',sectionKey:'sermon'}, {...verse('5:1'),elementId:'bible-3',sectionKey:'citation'}];
    const crossBefore=JSON.stringify(crossSections);
    const sections=groupPresenterSlidesBySection(crossSections,'fixture');
    const crossColors=sections.flatMap(g=>g.subgroups).flatMap(g=>[...renderPresenterBoardSlideBlocks(g.slides,-1,'fixture',g.scriptureColorStart).matchAll(/data-form-color="([a-z-]+)"/g)].map(m=>m[1]));
    check(crossColors.join()==='bible-light,bible-dark,bible-light','Bible alternation reset at section/element boundary');
    check(JSON.stringify(crossSections)===crossBefore,'Bible output changed');
    const before=JSON.stringify(entries), blocks=presenterBoardSlideBlocks(entries);
    check(blocks.map(b=>b.entries.length).join()==='2,1,1,1,2,1,1','group boundaries');
    check(!blocks[3].key,'blank grouped');
    check(JSON.stringify(entries)===before,'output data mutated');
    check(blocks.flatMap(b=>b.entries).every((e,i)=>e===entries[i]),'entry identity/order');
    document.body.innerHTML='<div style="padding:20px;width:100%;box-sizing:border-box"><div class="svc-board-grid" id="blocks"></div></div>';
    document.documentElement.className='';document.body.className='';document.body.style.cssText='display:block;margin:0;background:var(--bg)';
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
    check(groups[0].querySelector('.svc-slide-form-badge').textContent.trim()==='Title','controller Title caption abbreviated');
    check(presenterFormGroupLabel({formLabel:'T'})==='Title' && presenterFormGroupLabel({formLabel:'Title'})==='Title','controller title aliases');
    check(presenterFormPresetDisplayLabel('Title')==='T','canonical input title token changed');
    check(groups[1].dataset.formColor==='verse' && groups[3].dataset.formColor==='chorus','Title/Int consumed lyric colors');
    check(plain.querySelectorAll('.svc-slide-form-badge').length===4,'plain group labels lost');
    check([...plain.querySelectorAll('.svc-slide-thumb')].map(e=>e.dataset.presenterIndex).join()==='20,21,22,23','plain group click targets changed');
    const palette=document.createElement('div');palette.id='palette';palette.className='svc-board-grid';
    palette.innerHTML=colorHtml+renderPresenterBoardSlideBlocks(entries.slice(5),-1,'fixture');
    document.body.prepend(palette);
    check([...palette.querySelectorAll('.svc-board-slide-block')].slice(-3).map(e=>e.dataset.formColor).join()==='bible-light,bible-dark,bible-light','Bible reference/translation alternation');
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
       const palette=document.getElementById('palette');
       const formBlocks=[...palette.querySelectorAll('.svc-board-slide-block')];
       const color=block=>getComputedStyle(block).getPropertyValue('--form-color').trim();
       const expected=['#d65a62','#248449','#4f65d5','#21a6d2','#b864b5','#c5a12d'];
       if([0,5,6,7,8,9].some((i,j)=>color(formBlocks[i])!==expected[j]))throw Error('form palette');
       if(new Set(formBlocks.slice(0,5).map(color)).size!==1)throw Error('Verse variants differ in color');
       if(color(formBlocks[9])!==color(formBlocks[10]))throw Error('Tag/Tags differ');
       for(let i=1;i<5;i++) {
         const a=formBlocks[i-1].querySelector('.svc-board-block-background').getBoundingClientRect();
         const b=formBlocks[i].querySelector('.svc-board-block-background').getBoundingClientRect();
         if(!(b.left>a.right || b.top>a.bottom))throw Error('same-color blocks joined');
       }
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
     if width==1100:page.locator('#palette').screenshot(path=f'/tmp/mindex-slide-blocks-{engine}-{theme}.png')
   browser.close()
finally:server.shutdown()
