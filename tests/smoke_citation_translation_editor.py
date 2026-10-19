"""Isolated citation editor interaction and layout; no live data/output window."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1000,'height':900})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterServiceScriptureInput==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    state.module='presenter';state.services=[{id:'citation-fixture',type_id:'fixture'}];state.selectedServiceId='citation-fixture';
    state.bibleTranslations=[{id:'fixture-db',name:'개역개정',abbreviation:'개역개정',is_active:true}];
    const manual={reference:'롬 5:7–8',translationLabel:'새한글성경',verses:[{number:7,text:'일곱째 절 원문'},{number:8,text:'여덟째 절 원문'}]};
    const item=normalizeServiceItem({id:'citation',service_id:state.selectedServiceId,label:'인용 구절',raw_title:'롬 5:7–8',memo:serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',scriptureReferences:['롬 5:7–8'],manualScripture:manual})},0);
    state.serviceItems[state.selectedServiceId]=[item];window.citationBefore=item.memo;window.outputBefore=JSON.stringify(state.presenter);
    refreshPresenterForService=()=>{};schedulePresenterRefreshForService=()=>{};scheduleServiceScriptureBodyResolve=()=>{};saveCommittedServiceItem=async()=>true;
    window.renderCitationFixture=()=>{
      const item=getServiceItems(state.selectedServiceId)[0];
      refs.detailPane.innerHTML='<div id="servicePresenterControls" style="width:100%;max-width:800px"><div class="svc-board-subgroup-controls"><div class="svc-board-subgroup-control-item">'+renderPresenterServiceScriptureInput(item,0,parseServiceItemMemo(item.memo),state.services[0])+'</div></div></div>';
    };
    renderCitationFixture();
    const shell=document.createElement('main');shell.id='fixtureHost';shell.style.cssText='padding:20px;width:100%;box-sizing:border-box';
    refs.detailPane.style.cssText='width:100%;padding:0;min-width:0';shell.append(refs.detailPane);document.body.replaceChildren(shell);
   }''')
   select=page.locator('[data-service-item-field=scripture_reference_translation_id]')
   label=page.locator('[data-service-item-field=manual_scripture_translation_label]')
   body=page.locator('[data-service-item-field=manual_scripture_text]')
   assert select.input_value()=='__manual__';assert label.input_value()=='새한글성경';assert body.is_visible()
   assert page.evaluate('getServiceItems(state.selectedServiceId)[0].memo===citationBefore')
   assert page.locator('.svc-presenter-input-field--scripture-parts details').count()==0
   await_text='7 엔터 없이 수정한 본문\n8 그대로 보존'
   body.fill(await_text);label.fill('직접 적은 역본')
   select.select_option('fixture-db')
   assert not body.is_visible()
   page.evaluate('''()=>{
    const item=getServiceItems(state.selectedServiceId)[0],memo=parseServiceItemMemo(item.memo),p=memo.scriptureReferencePayloads[0];
    if(memo.manualScripture||p.manualScripture||p.manualTranslationLabel)throw Error('DB selection still overridden by manual');
    if(p.manualInputDraft.scripture.verses[0].text!=='엔터 없이 수정한 본문')throw Error('uncommitted text lost');
    const config=serviceElementConfigForSave({},memo,{item,service:state.services[0]});
    if(JSON.stringify(config.scriptureReferencePayloads)!==JSON.stringify(memo.scriptureReferencePayloads))throw Error('save config lost manual draft');
    updateServiceItemField(document.querySelector('[data-service-item-field=manual_scripture_text]'));
    if(parseServiceItemMemo(getServiceItems(state.selectedServiceId)[0].memo).scriptureReferencePayloads[0].manualScripture)throw Error('hidden field restored manual');
    item.memo=serializeServiceItemMemo(memo);renderCitationFixture();
   }''')
   select.select_option('__manual__')
   assert body.is_visible();assert body.input_value()==await_text;assert label.input_value()=='직접 적은 역본'
   page.evaluate('''()=>{
    const item=getServiceItems(state.selectedServiceId)[0];
    const payload=serviceScriptureTextPayloadFromBible(item,parseServiceItemMemo(item.memo),state.services[0]);
    if(payload.verses.length!==2||payload.verses[0].text!=='엔터 없이 수정한 본문')throw Error('manual resolution changed');
    if(JSON.stringify(state.presenter)!==outputBefore)throw Error('active output touched');
   }''')
   body.fill('7 더 최근에 입력한 본문')
   page.evaluate("updateServiceItemField(document.querySelector('[data-service-item-field=scripture_reference_translation_id]'))")
   assert body.input_value()=='7 더 최근에 입력한 본문'
   page.evaluate("renderCitationFixture()")
   assert body.input_value()=='7 더 최근에 입력한 본문'
   for theme in ('light','dark'):
    page.evaluate('(theme)=>document.body.dataset.theme=theme',theme)
    for width in (1000,360):
     page.set_viewport_size({'width':width,'height':900})
     page.evaluate('''()=>{
      const host=document.querySelector('#fixtureHost').getBoundingClientRect();
      for(const e of document.querySelectorAll('.svc-presenter-scripture-part input,.svc-presenter-scripture-part select,.svc-presenter-scripture-part textarea')){
       const r=e.getBoundingClientRect();if(r.width&&(r.left<host.left||r.right>host.right))throw Error('field overflow');
      }
      if(document.querySelector('textarea').getBoundingClientRect().height<65)throw Error('multiline collapsed');
     }''')
     if width==1000:
      page.evaluate('''()=>{
       const head=document.querySelector('.svc-presenter-scripture-part-head');
       const title=head.querySelector('strong').getBoundingClientRect(),select=head.querySelector('select').getBoundingClientRect();
       if(title.bottom<select.top||select.bottom<title.top)throw Error('wide reference and selector wrapped');
      }''')
     label.focus();assert label.evaluate('e=>getComputedStyle(e).outlineStyle')!='none'
     page.screenshot(path=f'/tmp/mindex-citation-{engine}-{theme}-{width}.png')
   page.evaluate("""()=>{
    const item=getServiceItems(state.selectedServiceId)[0];
    item.memo=serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',scriptureReferences:['롬 5:7–8','요 3:16']});renderCitationFixture();
   }""")
   selectors=page.locator('[data-service-item-field=scripture_reference_translation_id]')
   selectors.nth(1).select_option('__manual__')
   page.evaluate('renderCitationFixture()')
   assert selectors.nth(1).input_value()=='__manual__'
   bodies=page.locator('[data-service-item-field=manual_scripture_text]')
   assert not bodies.nth(0).is_visible() and bodies.nth(1).is_visible()
   bodies.nth(1).fill('16 두 번째 인용')
   selectors.nth(1).select_option('fixture-db');selectors.nth(1).select_option('__manual__')
   assert bodies.nth(1).input_value()=='16 두 번째 인용'
   page.evaluate("""()=>{
    const inputs=[...document.querySelectorAll('[data-service-item-field=manual_scripture_text]')];
    if(deferredServiceTextPreviewKey(inputs[0])===deferredServiceTextPreviewKey(inputs[1]))throw Error('reference draft keys collide');
    const memo=parseServiceItemMemo(getServiceItems(state.selectedServiceId)[0].memo);
    if(memo.scriptureReferencePayloads.length!==1)throw Error('other reference modified');
   }""")
   print(engine,'PASS legacy display, real selector/draft/roundtrip, DB/manual resolution, hidden-field guard, focus and wide/narrow layouts',flush=True)
   browser.close()
finally:server.shutdown()
