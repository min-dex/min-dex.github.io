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
    return 'PASS form occurrence/range/translation boundaries, blank, unchanged source, indexes and active selection';
   }'''),flush=True)
   for width in [320,700,1100]:
    page.set_viewport_size({'width':width,'height':900})
    for theme in ['dark','light']:
     page.evaluate('(theme)=>applyTheme(theme)',theme)
     assert page.evaluate('''()=>[...document.querySelectorAll('.svc-board-grid,.svc-board-slide-block')].every(e=>e.scrollWidth<=e.clientWidth+1)'''),(engine,width,theme)
     if width==700:page.screenshot(path=f'/tmp/mindex-slide-blocks-{engine}-{theme}.png')
   browser.close()
finally:server.shutdown()
