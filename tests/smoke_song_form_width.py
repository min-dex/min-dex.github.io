"""Actual song editor allocates space to forms, without a disconnect control."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
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
      assert page.locator('.svc-form-hint-slot').first.evaluate("e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)' && getComputedStyle(e).paddingLeft==='0px'"),(engine,theme,width)
      assert not result['overflow'],(engine,theme,db_link,width,result)
      if width>1120:assert result['sameRow'] and min(result['form'],result['title'])>=200,(engine,width,result)
      elif width>=800:assert result['sameRow'] and result['form']>=120,(engine,width,result)
      if width in [1500,520] and not db_link:page.screenshot(path=f'/tmp/mindex-song-width-{engine}-{theme}-{width}.png')
     title=page.locator('#width-host .svc-edit-title');form=page.locator('#width-host .svc-form-hint')
     title.fill('미저장 제목');form.fill('V1-C-C-Tag');form.focus()
     page.locator('#width-host').evaluate('e=>e.style.width="1500px"')
     assert title.input_value()=='미저장 제목' and form.input_value()=='V1-C-C-Tag'
     assert form.evaluate('e=>document.activeElement===e')
     form.evaluate("e=>e.setSelectionRange(2,5)")
     page.locator('[data-form-help]').click()
     assert page.locator('.svc-form-help-panel:popover-open').count()==1
     assert form.input_value()=='V1-C-C-Tag'
     assert form.evaluate('e=>document.activeElement===e && e.selectionStart===2 && e.selectionEnd===5')
     assert page.locator('.svc-form-help-panel').inner_text().find('V1@B')>=0
     page.locator('.svc-form-help-panel').screenshot(path=f'/tmp/mindex-form-help-{engine}-{theme}.png')
     page.keyboard.press('Escape')
     assert page.locator('.svc-form-help-panel:popover-open').count()==0
     assert form.evaluate('e=>document.activeElement===e && e.selectionStart===2 && e.selectionEnd===5')
     page.locator('[data-form-help]').focus();page.keyboard.press('Enter')
     assert page.locator('.svc-form-help-panel:popover-open').count()==1
     page.keyboard.press('Escape')
     assert form.evaluate('e=>document.activeElement===e && e.selectionStart===2 && e.selectionEnd===5')

     assert page.evaluate("widthBefore===JSON.stringify({service:state.services[0],song:state.songs[0],item:state.serviceItems['width-fixture'][0]})")
   for mode in ['lyrics_db','manual_praise','audio_praise']:
    for label in ['찬양 1','특송']:
     page.evaluate("""({mode,label})=>{
      const service=state.services[0];
      const item=normalizeServiceItem({id:'natural-item',service_id:service.id,label,raw_title:'나의 주 크고 놀라운 하나님',assignee:'찬양팀',song_id:mode==='lyrics_db'?'width-song':null,version_id:mode==='lyrics_db'?'width-version':null,memo:serializeServiceItemMemo({elementType:'praise',inputMode:mode,formHint:'V1-C-V2-C',slides:['첫 줄\\n둘째 줄']})});
      state.serviceItems[service.id]=[item];
      presenterBoardSubgroupInputContexts=()=>[{service,item,index:0}];
      const before=JSON.stringify(item);
      document.querySelector('#width-host').innerHTML=renderPresenterBoardSubgroupInputControls(service.id,{slides:[]},{headerActions:true});
      refreshIcons();if(before!==JSON.stringify(item))throw Error('render changed data');
     }""",{'mode':mode,'label':label})
     for width in [1200,960,800,600,360]:
      page.locator('#width-host').evaluate('(e,w)=>e.style.width=w+"px"',width)
      page.evaluate("""()=>{
       const row=document.querySelector('.svc-board-subgroup-control-item'),host=document.querySelector('#width-host');
       const nodes=[...row.querySelectorAll('input:not([type=hidden]):not([type=file]),select,button,summary,textarea')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().width);
       const box=row.getBoundingClientRect();
       for(const e of nodes){const r=e.getBoundingClientRect();if(r.left<box.left-1||r.right>box.right+1)throw Error('overflow '+e.outerHTML.slice(0,120));}
       for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(a.contains(b)||b.contains(a))continue;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2)throw Error('overlap');}
       const title=row.querySelector('[data-service-item-field=raw_title]'),mode=row.querySelector('[data-service-item-field=praise_input_mode]');
       if(!title||!mode)throw Error('missing title/mode');
       if(host.clientWidth>=600&&Math.abs(title.getBoundingClientRect().top-mode.getBoundingClientRect().top)>1)throw Error('forced title row');
       if(host.clientWidth>=800){const fields=[title,mode,...row.querySelectorAll('.svc-song-version-control select,.svc-form-hint,[data-service-item-field=assignee]')].filter(e=>e.checkVisibility());if(fields.some(e=>Math.abs(e.getBoundingClientRect().top-title.getBoundingClientRect().top)>1))throw Error('forced field row');}
      }""")
      if width==800:page.locator('#width-host').screenshot(path=f'/tmp/mindex-natural-{engine}-{mode}-{label}.png')
     title=page.locator('#width-host [data-service-item-field=raw_title]');title.fill('미저장 특송 제목');title.focus()
     page.locator('#width-host').evaluate('e=>e.style.width="960px"')
     assert title.input_value()=='미저장 특송 제목' and title.evaluate('e=>document.activeElement===e')
     if mode!='lyrics_db':
      page.locator('.svc-presenter-input-field--lyrics').evaluate("e=>e.classList.remove('is-collapsed')")
      lyrics=page.locator('[data-service-item-field=manual_praise_lyrics]');lyrics.fill('첫 줄\n둘째 줄\n\n다음 슬라이드');lyrics.focus()
      page.locator('#width-host').evaluate('e=>e.style.width="600px"')
      assert lyrics.input_value()=='첫 줄\n둘째 줄\n\n다음 슬라이드' and lyrics.evaluate('e=>document.activeElement===e')
      assert lyrics.evaluate("e=>{const a=e.getBoundingClientRect(),r=e.closest('.svc-board-subgroup-control-item').getBoundingClientRect();return a.left>=r.left-1&&a.right<=r.right+1&&a.width>r.width-10}")
   print('PASS',engine,'direct lyric/audio and special-song natural wrapping, containment, drafts/focus')
   page.evaluate("""()=>{
    const service=state.services[0],item=normalizeServiceItem({id:'empty-search',service_id:service.id,label:'특송',raw_title:'',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})});
    state.serviceItems[service.id]=[item];state.client=null;songCatalogLoaded=true;
    window.searchItemBefore=JSON.stringify(item);
    const model=serviceItemEditorModel(item,{service});
    document.querySelector('#width-host').innerHTML='<div class="svc-board-subgroup-controls"><div class="svc-board-subgroup-control-item">'+renderPresenterServicePraiseInput(item,0,model,{headerActions:true})+'</div></div>';
   }""")
   field=page.locator('#width-host [data-service-item-field=raw_title]')
   assert page.locator('[data-service-song-create]').count()==0
   for query,creation in [('zzzz등록확인용찬양',1),('나의 주 크고 놀라운 하나님',0),('',0)]:
    field.fill(query);field.evaluate('e=>scheduleServiceSongPickerPreview(e)');page.wait_for_timeout(250)
    assert page.locator('[data-service-song-create]').count()==creation,(engine,query)
    if creation:
     assert page.locator('[data-service-song-create]').inner_text()=='새 곡 등록'
     page.locator('#width-host').evaluate('e=>e.style.width="360px"')
     assert page.locator('[data-service-song-create]').evaluate("e=>{const a=e.getBoundingClientRect(),r=e.closest('.svc-board-subgroup-controls').getBoundingClientRect();return a.left>=r.left-1&&a.right<=r.right+1}")
     page.locator('#width-host').evaluate('e=>e.style.width="960px"')
   assert page.evaluate("searchItemBefore===JSON.stringify(state.serviceItems[state.selectedServiceId][0])")
   print('PASS',engine,'live search creation appears/disappears without committing draft')
   page.evaluate("""()=>{
    const service=state.services[0],song=state.songs[0],version=song.versions[0];
    const item=normalizeServiceItem({id:'error-form',service_id:service.id,label:'찬양 1',song_id:song.id,version_id:version.id,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V999A-C',formPreset:{forms:['V999A','C'],strength:'manual',titleSequence:true}})});
    state.serviceItems[service.id]=[item];
    const host=document.querySelector('#width-host');host.innerHTML=`<div class="svc-board-subgroup"><header><span data-live-form-warnings data-static-warnings='["별도 안내"]'>${renderPresenterWarnings(["별도 안내","V999A 없음"])}</span></header>${renderServiceFormHintInput(item,0)}</div>`;
    const field=host.querySelector('.svc-form-hint'),before=JSON.stringify(item);
    if(field.getAttribute('aria-invalid')!=='true'||field.title!=='V999A 없음')throw Error('initial missing token/error');
    for(const theme of ['dark','light']){
      document.body.dataset.theme=theme;
      const styles=getComputedStyle(field),probe=document.createElement('span');probe.style.color='var(--warn)';host.append(probe);
      if(styles.color!==getComputedStyle(probe).color||styles.borderBottomColor!==getComputedStyle(probe).color)throw Error('shared error colors');probe.remove();
    }
    field.value='C';field.focus();field.setSelectionRange(0,1);syncServiceFormInputError(field);
    if(field.getAttribute('aria-invalid')!=='false'||field.classList.contains('is-invalid')||field.title)throw Error('error not cleared');
    if(host.querySelector('[data-live-form-warnings]').textContent!=='별도 안내')throw Error('stale header or unrelated warning lost');
    field.value='V0-C';field.setSelectionRange(1,2);syncServiceFormInputError(field);
    if(field.title!=='V0 없음'||field.value!=='V0-C'||field.selectionStart!==1||field.selectionEnd!==2||document.activeElement!==field)throw Error('live input/selection');
    if(host.querySelector('[data-live-form-warnings]').textContent!=='별도 안내V0 없음')throw Error('header live token');
    if(JSON.stringify(item)!==before)throw Error('validation changed stored item');
   }""")
   print('PASS',engine,'form error initial/live/recovery, full token, both-theme colors and unchanged input/selection/model')
   browser.close();print('PASS',engine,'actual song editor, wide/narrow form sizing, DB variants, medley control, drafts/focus retained')
finally:server.shutdown()
