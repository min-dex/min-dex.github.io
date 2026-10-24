import os,sys,json
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from urllib.parse import urlsplit
server,url=start_local_app_server();results=[]
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page(viewport={'width':1440,'height':900})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname=='127.0.0.1' and r.request.method=='GET' else r.abort())
   page.goto(url);page.wait_for_function("typeof renderSingleVersionForms==='function'&&!document.body.classList.contains('ui-booting')");page.wait_for_timeout(300)
   for name in ('empty','praise','metadata','manuals','calendar'):
    page.evaluate('''name=>{
     state.client={};state.auth.session={user:{id:'fixture'}};state.connectionError='';state.search='';state.module='praise';state.selectedSongId=null;state.songs=[];
     if(name==='praise'||name==='metadata'){
      const forms=[{id:'f1',part_type:'Verse',part_number:1,sort_order:0,lyrics:'검증 가사'}];state.songs=[{id:'fixture',title:'찬양 제목',versions:[{id:'v1',name:'기본',forms}]}];state.selectedSongId='fixture';state.selectedVersionId='v1';state.forms=forms;state.dirty.forms=false;
     }
     if(name==='manuals')state.module='manuals';
     if(name==='calendar'){state.module='calendar';state.calendarLoaded=true;state.calendarData=[];state.calendarLoading=false;}
     render();if(name==='metadata'){state.metadataPopupOpen=true;render();}refreshIcons();
    }''',name)
    for width in (1440,900,760,390):
     page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100)
     data=page.evaluate('''()=>{const pane=refs.detailPane;const selectors=['.editor-title h2','.song-description-title.empty','.metadata-edit-btn','.song-delete-btn','.form-type-select','.manuals-index','.manual-section','.cal-tab','.empty-detail'];const values={};for(const selector of selectors){const e=document.querySelector(selector);if(!e)continue;const c=getComputedStyle(e),r=e.getBoundingClientRect();values[selector]={font:c.fontSize,weight:c.fontWeight,height:r.height,width:r.width,gap:c.gap,padding:c.padding,visibility:c.visibility};}return {overflowY:pane.scrollHeight-pane.clientHeight,values}}''')
     if name=='empty':assert data['overflowY']==0,(engine,width,data)
     if name=='praise':
      assert not page.locator('.song-description-title.empty').count()
      assert page.locator('#editorSongTitle').bounding_box()['width']>=150
      assert page.locator('.form-type-select').bounding_box()['height']==30
      select=page.locator('.form-type-select').first
      before=select.input_value();select.evaluate('e=>e.disabled=true')
      assert select.evaluate('e=>getComputedStyle(e).cursor')=='not-allowed'
      assert float(select.evaluate('e=>getComputedStyle(e).opacity'))<1
      select.evaluate('e=>e.disabled=false');assert select.input_value()==before

     if name=='metadata':
      page.set_viewport_size({'width':width,'height':600})
      box=page.locator('.metadata-popover').bounding_box()
      assert box['y']>=50 and box['y']+box['height']<=600,(engine,width,box)
      fields=page.locator('.metadata-popover input:not([readonly])');fields.last.fill('검증 중인 입력')
      page.evaluate("""()=>{
        const field=document.querySelector('.metadata-popover input[data-song-field="scripture"]');
        if(!field)throw Error('scripture field missing');
        const previous=field.getAttribute('aria-invalid'),value=field.value;
        const size=field.getBoundingClientRect();
        field.focus();field.setSelectionRange(0,value.length);
        const probe=document.createElement('span');document.body.append(probe);
        for(const marker of ['aria','class']){
          field.removeAttribute('aria-invalid');field.classList.remove('is-invalid');
          if(marker==='aria')field.setAttribute('aria-invalid','true');else field.classList.add('is-invalid');
          probe.style.color='var(--warn)';const warning=getComputedStyle(probe).color;
          probe.style.color='var(--warn-bg)';const background=getComputedStyle(probe).color;
          const c=getComputedStyle(field),box=field.getBoundingClientRect();
          if(c.color!==warning||c.borderTopColor!==warning||c.backgroundColor!==background)throw Error('error style overridden '+marker);
          if(box.width!==size.width||box.height!==size.height||field.value!==value||document.activeElement!==field||field.selectionStart!==0||field.selectionEnd!==value.length)throw Error('error state changed input');
          if(c.outlineStyle==='none')throw Error('error focus missing');
        }
        probe.remove();field.classList.remove('is-invalid');
        if(previous===null)field.removeAttribute('aria-invalid');else field.setAttribute('aria-invalid',previous);
      }""")
      fields.last.scroll_into_view_if_needed()
      assert fields.last.input_value()=='검증 중인 입력'
      assert fields.last.bounding_box()['y']+fields.last.bounding_box()['height']<=600
      page.set_viewport_size({'width':width,'height':900})
     if name=='calendar':
      assert page.locator('.cal-table-wrap').evaluate('e=>e.scrollWidth>=e.clientWidth')
      assert page.locator('.cal-th-role').evaluate_all('es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)'),(engine,width,'header clipped')
     results.append({'engine':engine,'screen':name,'width':width,**data});page.screenshot(path=f'/private/tmp/ui-rhythm-{engine}-{name}-{width}.png')
   browser.close()
finally:server.shutdown()
print('PASS empty height, resource controls, metadata scroll/edit retention, calendar headers; Chromium/WebKit 1440/900/760/390')
