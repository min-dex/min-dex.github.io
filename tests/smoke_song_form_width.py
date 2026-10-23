"""Actual song editor allocates space to forms, without a disconnect control."""
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1600,'height':700})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterBoardSubgroupInputControls==='function' && !document.body.classList.contains('ui-booting')")
   for theme in ['light','dark']:
    for db_link in [True,False]:
     page.evaluate('''({theme,dbLink})=>{
      document.body.dataset.theme=theme;
      const service={id:'width-fixture',type_id:'fixture'},song={id:'width-song',title:'나의 주 크고 놀라운 하나님',_relationalVersionsLoaded:true,versions:[{id:'width-version',name:'환영 호응',forms:[{part_type:'Chorus',lyrics:'테스트 가사'}]},{id:'another-version',name:'다른 버전',forms:[{part_type:'Verse',lyrics:'다른 가사'}]}]};
      const item=normalizeServiceItem({id:'width-item',service_id:service.id,label:'찬양 1',song_id:song.id,version_id:'width-version',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'C-C-C-C-C-C-C-C-C-C-C-C-C-C-C-C',connectedPraise:{groupId:'width-group',role:'primary',itemIds:['width-item','second']}})});
      state.services=[service];state.songs=[song];state.selectedServiceId=service.id;state.serviceItems={[service.id]:[item]};state.module='service';
      presenterBoardSubgroupInputContexts=()=>[{service,item,index:0}];
      const before=JSON.stringify({service,song,item});
      document.body.innerHTML='<main id="servicePresenterControls" style="position:fixed;inset:0;background:var(--bg);padding:20px;overflow:auto"><div id="width-host"></div></main>';
      const host=document.querySelector('#width-host');
      host.innerHTML=renderPresenterBoardSubgroupInputControls(service.id,{slides:[]},{headerDbLink:!dbLink});refreshIcons(host);
      if(before!==JSON.stringify({service,song,item}))throw Error('render changed data');
      if(host.querySelector('[data-service-song-clear]'))throw Error('disconnect remains');
      if(!host.querySelector('[data-service-medley-unlink]'))throw Error('medley unlink lost');
      window.widthBefore=JSON.stringify({service,song,item});
     }''',{'theme':theme,'dbLink':db_link})
     for width in [1500,1200,1100,800,520,360]:
      page.locator('#width-host').evaluate('(e,w)=>e.style.width=w+"px"',width)
      result=page.evaluate('''()=>{const host=document.querySelector('#width-host'),title=host.querySelector('.svc-edit-title'),form=host.querySelector('.svc-form-hint'),row=host.querySelector('.svc-inline-song');const t=title.getBoundingClientRect(),f=form.getBoundingClientRect(),r=row.getBoundingClientRect();return {title:t.width,form:f.width,sameRow:Math.abs(t.y-f.y)<1,overflow:row.scrollWidth>row.clientWidth+1,formFull:Math.abs(f.width-r.width)<1}}''')
      assert not result['overflow'],(engine,theme,db_link,width,result)
      if width>1120:assert result['sameRow'] and result['form']>=219 and abs(result['form']-result['title'])<1,(engine,width,result)
      else:assert not result['sameRow'] and result['formFull'],(engine,width,result)
      if width in [1500,520] and not db_link:page.screenshot(path=f'/tmp/mindex-song-width-{engine}-{theme}-{width}.png')
     title=page.locator('#width-host .svc-edit-title');form=page.locator('#width-host .svc-form-hint')
     title.fill('미저장 제목');form.fill('V1-C-C-Tag');form.focus()
     page.locator('#width-host').evaluate('e=>e.style.width="1500px"')
     assert title.input_value()=='미저장 제목' and form.input_value()=='V1-C-C-Tag'
     assert form.evaluate('e=>document.activeElement===e')
     assert page.evaluate("widthBefore===JSON.stringify({service:state.services[0],song:state.songs[0],item:state.serviceItems['width-fixture'][0]})")
   browser.close();print('PASS',engine,'actual song editor, wide/narrow form sizing, DB variants, medley control, drafts/focus retained')
finally:server.shutdown()
