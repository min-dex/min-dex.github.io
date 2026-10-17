from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from urllib.parse import urlsplit
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page(viewport={'width':1200,'height':650})
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.goto(url);page.wait_for_function("typeof renderPresenterServicePraiseInput==='function' && typeof state!=='undefined' && !document.body.classList.contains('ui-booting')")
    page.evaluate('''()=>{
     const sid=crypto.randomUUID(),songId=crypto.randomUUID(),vid=crypto.randomUUID();
     const service={id:sid,type_id:'layout-fixture',title:'Fixture'};
     const song={id:songId,title:'교회',_relationalVersionsLoaded:true,praise_types:['ccm'],versions:[{id:vid,name:'대흥교회',forms:[{part_type:'Verse',lyrics:'가사'}]},{id:crypto.randomUUID(),name:'기본',forms:[]}]};
     state.songs=[song];state.services=[service];state.selectedServiceId=sid;
     const item=normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,label:'특송',raw_title:'교회',song_id:songId,version_id:vid,assignee:'카다로스 중창단',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-V2-C-Int-V3-C-Int-C'})});state.serviceItems={[sid]:[item]};
     const model=serviceItemEditorModel(item,{service});model.showAssignee=true;model.assigneeValue='카다로스 중창단';
     document.body.innerHTML='<div style="padding:20px"><h3>특송 · 교회</h3><div class="svc-board-subgroup-controls"><div class="svc-board-subgroup-control-item">'+renderPresenterServicePraiseInput(item,0,model,{headerActions:true})+'</div></div></div>';
    }''')
    for width in [1200,800,600]:
     page.set_viewport_size({'width':width,'height':650})
     page.wait_for_timeout(100)
     print(engine,width,page.evaluate('''()=>{
      const host=document.querySelector('.svc-board-subgroup-controls');const mode=host.querySelector('.svc-praise-input-mode-control');const ver=host.querySelector('.svc-song-picker--linked .svc-song-version-control');
      if(!mode||!ver)throw Error('missing picker');
      if(host.querySelector('.svc-progression-media'))throw Error('duplicate progression');
      for(const wrapper of [mode,ver])if(getComputedStyle(wrapper,'::after').right!=='12px')throw Error('arrow inset');
      const boxes=[...host.querySelectorAll('input,select')].map(el=>({el,r:el.getBoundingClientRect()}));
      for(const {r} of boxes)if(r.width<=0||r.right>host.getBoundingClientRect().right+1)throw Error('overflow');
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i].r,b=boxes[j].r;if(Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)throw Error('overlap');}
      return 'PASS aligned arrows, no overlap, one progression control';
     }'''),flush=True)
     page.screenshot(path=f'/tmp/mindex-praise-layout-{engine}-{width}.png')
   finally:browser.close()
finally:server.shutdown();server.server_close()
