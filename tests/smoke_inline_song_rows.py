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
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterServicePraiseInput==='function' && typeof state!=='undefined' && !document.body.classList.contains('ui-booting')")
    page.evaluate('''()=>{
     const sid=crypto.randomUUID(),songId=crypto.randomUUID(),vid=crypto.randomUUID();
     const service={id:sid,type_id:'layout-fixture',title:'Fixture'};
     const song={id:songId,title:'교회',_relationalVersionsLoaded:true,praise_types:['ccm'],versions:[{id:vid,name:'대흥교회',forms:[{part_type:'Verse',lyrics:'가사'}]},{id:crypto.randomUUID(),name:'기본',forms:[]}]};
     state.songs=[song];state.services=[service];state.selectedServiceId=sid;
     const item=normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,label:'특송',raw_title:'교회',song_id:songId,version_id:vid,assignee:'카다로스 중창단',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-V2-C-Int-V3-C-Int-C'})});state.serviceItems={[sid]:[item]};
     const model=serviceItemEditorModel(item,{service});model.showAssignee=true;model.assigneeValue='카다로스 중창단';
     presenterBoardSubgroupInputContexts=()=>[0,1,2].map(index=>({item:{...item,id:'row'+index,connectedPraise:{groupId:'medley',role:index?'secondary':'primary'},label:'찬양 '+(index+1),assignee:''},index,service}));
     window.renderSingleSong=()=>{
      const context={item:{...item,label:'찬양 5',assignee:''},index:0,service};
      presenterBoardSubgroupInputContexts=()=>[context];
      presenterBoardSubgroupItemContext=()=>context;
      presenterBoardSubgroupDisplay=()=>({label:'찬양 5',title:'교회'});
      document.querySelector('#fixture').innerHTML=renderPresenterBoardSubgroup({slides:[],name:'찬양 5'},-1,sid,{showHead:true});
     };
     document.body.innerHTML='<main id="fixture" style="padding:20px">'+renderPresenterBoardSubgroupInputControls(sid,{slides:[]})+'</main>';
    }''')
    for width in [1600,1200,1100,1000,800,600]:
     page.set_viewport_size({'width':width,'height':900})
     page.wait_for_timeout(100)
     page.screenshot(path=f'/tmp/mindex-inline-{engine}-{width}.png')
     print(engine,width,page.evaluate('''()=>{
      const host=document.querySelector('.svc-board-subgroup-controls');const issues=[];
      for(const row of host.querySelectorAll('.svc-inline-song')) {
       const controls=[...row.querySelectorAll('input:not([type=file]),select,button,summary,label.svc-board-subgroup-audio-upload')].filter(e=>e.checkVisibility()&&!e.closest('[hidden]')&&e.getBoundingClientRect().width);
       const q=host.getBoundingClientRect();
       for(const e of controls){const r=e.getBoundingClientRect();if(r.left<q.left-1||r.right>q.right+1)issues.push('outside '+e.className)}
       for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){let a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;let r=a.getBoundingClientRect(),t=b.getBoundingClientRect();if(Math.min(r.right,t.right)-Math.max(r.left,t.left)>2&&Math.min(r.bottom,t.bottom)-Math.max(r.top,t.top)>2)issues.push('overlap '+a.className+' '+b.className)}
       if(host.clientWidth>=961){const top=row.querySelector('.svc-edit-title').getBoundingClientRect().top;for(const e of controls)if(!e.closest('.svc-presenter-input-field--assignee')&&Math.abs(e.getBoundingClientRect().top-top)>12)issues.push('extra row '+e.outerHTML.slice(0,180)+' '+e.getBoundingClientRect().top+' vs '+top)}
      }
      if(!host.querySelector('.svc-inline-song'))issues.push('missing inline rows');
      if(issues.length)throw Error(issues.join(';'));return 'PASS bounds overlap and desktop single row';
     }'''),flush=True)
     page.screenshot(path=f'/tmp/mindex-inline-{engine}-{width}.png')
    page.set_viewport_size({'width':1200,'height':900})
    page.locator('.svc-progression-media > summary').first.click()
    print(engine,page.evaluate('''()=>{
     const row=document.querySelector('.svc-inline-song'),details=row.querySelector('.svc-progression-media');
     if(!details.open)throw Error('photos did not open');
     const title=row.querySelector('.svc-edit-title').getBoundingClientRect(),flow=row.querySelector('.svc-board-subgroup-flow').getBoundingClientRect();
     if(flow.top<title.bottom)throw Error('expanded photos overlap song');
     const host=document.querySelector('.svc-board-subgroup-controls').getBoundingClientRect();
     for(const e of row.querySelectorAll('input:not([type=file]),select,button,summary'))if(e.checkVisibility()){const r=e.getBoundingClientRect();if(r.right>host.right+1||r.left<host.left-1)throw Error('expanded control overflow')}
     return 'PASS expanded photo controls below song';
    }'''),flush=True)
    page.screenshot(path=f'/tmp/mindex-inline-{engine}-expanded.png')
    page.locator('.svc-progression-media > summary').first.click()
    print(engine,page.evaluate('''()=>{
     const row=document.querySelector('.svc-inline-song');
     row.querySelector('.svc-song-picker--linked').remove();
     row.querySelector('.svc-edit-title').value='긴 곡 제목 '.repeat(20);
     const title=row.querySelector('.svc-edit-title').getBoundingClientRect(),form=row.querySelector('.svc-form-hint').getBoundingClientRect(),actions=row.querySelector('.svc-board-subgroup-flow').getBoundingClientRect();
     if(Math.abs(title.top-form.top)>2||Math.abs(title.top-actions.top)>12||form.right>actions.left)throw Error('unlinked desktop layout');
     return 'PASS no reserved version column';
    }'''),flush=True)
    page.evaluate('renderSingleSong()')
    for width in [1600,1200,1100,1000,800,600]:
     page.set_viewport_size({'width':width,'height':900})
     page.wait_for_timeout(100)
     print(engine,width,page.evaluate("""()=>{
      const row=document.querySelector('.svc-inline-song'),head=document.querySelector('.svc-board-subgroup-head-row');
      if(!row||head.querySelector('[data-service-item-commit]'))throw Error('single song kept header actions');
      if(document.querySelectorAll('[data-service-item-commit]').length!==1)throw Error('duplicate/missing save');
      const host=document.querySelector('.svc-board-subgroup-controls'),q=host.getBoundingClientRect();
      const controls=[...row.querySelectorAll('input:not([type=file]),select,button,summary,label.svc-board-subgroup-audio-upload')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().width);
      for(const e of controls){const r=e.getBoundingClientRect();if(r.left<q.left-1||r.right>q.right+1)throw Error('single song overflow');}
      if(host.clientWidth>=961){const top=row.querySelector('.svc-edit-title').getBoundingClientRect().top;for(const e of controls)if(Math.abs(e.getBoundingClientRect().top-top)>12)throw Error('single song extra row');}
      return 'PASS single song with visible header, one save and compact controls';
     }"""),flush=True)
     if width==1600:page.screenshot(path=f'/tmp/mindex-single-song-{engine}.png')
   finally:browser.close()
finally:server.shutdown();server.server_close()
