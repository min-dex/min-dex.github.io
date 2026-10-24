"""Actual editor disclosures across remount/reload with isolated state RPC."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
fixture='''() => {
 state.module='presenter';state.selectedServiceId='disclosure-service';
 refs.detailPane.style.cssText='display:block;width:100%;height:auto;overflow:visible';
 const shell=document.createElement('main');shell.style.cssText='width:100%;padding:20px';shell.append(refs.detailPane);document.body.replaceChildren(shell);
 const item={id:'disclosure-item',service_id:'disclosure-service',label:'인용 구절',raw_title:'요 3:16',memo:serializeServiceItemMemo({elementType:'scripture_body',inputMode:'scripture',scriptureReferences:['요 3:16']})};
 state.services=[{id:item.service_id,type_id:'fixture'}];
 state.bibleTranslations=[{id:'t01',name:'KJV',is_active:true}];state.selectedBibleTranslationId='t01';
 const verse={id:'fixture-verse',verse:1,text:'검증 본문',metadata:{notes:['검증 주석']}};state.bibleBookVerses=[verse];
 state.serviceItems[item.service_id]=[item];
 window.mountDisclosureFixture=()=>{
  refs.detailPane.innerHTML=renderPresenterServiceScriptureInput(item,0,parseServiceItemMemo(item.memo),state.services[0])
   +renderServiceAnnouncementEditor(item,0,item.service_id,{})
   +renderServiceAuthoringPanel('예배','예배 정보','<p>입력 유지 검증</p>')
   +renderWorshipTemplateInventoryCard({id:'template-fixture',name:'검증 양식'}, {}, {})
   +renderWorshipTemplateDraftCard({id:'draft-fixture',name:'검증',sections:[],elementTypes:[],services:0,slides:0})
   +renderBibleEditionInfo()+renderBibleVerseList([verse])+renderPresenterHelpControl()
   +renderServiceSourcePanel(state.services[0])
   +renderServiceItemMemoEditor(item,0,{service:state.services[0]})
   +renderPresenterReferenceMediaPreview({url:'assets/bulletin/children-mark.png',name:'검증'},'image',[item.service_id,item.id])
   +renderPresenterManualLyricsField(item,0,item.service_id)
   +'<div id="bulletinFixture" style="height:700px"></div>';
  const B=MindexBulletin,source=B.resolveSource({service:{id:'disclosure-service',service_type_id:'children',service_date:'2026-10-11'},sections:[],elements:[]});
  source.autoBackground={key:'26-C5.png',url:'assets/worship-backgrounds/26-C5.png'};
  window.bulletinDisclosureController=B.mount(document.getElementById('bulletinFixture'),{serviceId:source.id,scope:'disclosure-fixture',services:[{id:source.id,label:'검증'}],loadSource:async()=>source,loadDraft:async()=>null,saveDraft:async()=>{throw Error('Unexpected operational save')}});
 };
 mountDisclosureFixture();
}'''
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1000,'height':1000})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   def mount(reload=False):
    if reload: page.reload()
    else: page.goto(url+'?mindexSmokeRaw=1')
    page.wait_for_function("typeof renderPresenterServiceScriptureInput==='function'&&!document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    page.evaluate(fixture)
    page.wait_for_function("document.querySelector('.bulletin-properties')?.dataset.sectionsReady==='true'",timeout=10000)
   mount()
   selectors=['[data-citation-translations]','.svc-announcement-editor details','.svc-authoring-panel','.svc-template-inventory-card','.svc-template-draft-card','.bible-edition-info','.bible-source-annotations','[data-presenter-help]','.svc-source-panel','.svc-item-note','.svc-reference-media-preview--collapsible','[data-bulletin-section=monthly]','[data-bulletin-section=weekly]','[data-bulletin-section=common]']
   for wanted in (True,False):
    for selector in selectors:
     node=page.locator(selector)
     if node.evaluate('e=>e.open')!=wanted: node.locator('summary').click()
    lyrics=page.locator('[data-presenter-lyrics-toggle]')
    if (lyrics.get_attribute('aria-expanded')=='true')!=wanted:lyrics.click()
    page.wait_for_function('!MINDEX_SERVER_STORAGE.pending')
    page.evaluate("bulletinDisclosureController.destroy();refs.detailPane.replaceChildren();mountDisclosureFixture()")
    page.wait_for_function("document.querySelector('.bulletin-properties')?.dataset.sectionsReady==='true'")
    for selector in selectors:assert page.locator(selector).evaluate('e=>e.open')==wanted,(engine,'remount',selector,wanted)
    assert (page.locator('[data-presenter-lyrics-toggle]').get_attribute('aria-expanded')=='true')==wanted
    mount(True)
    for selector in selectors:assert page.locator(selector).evaluate('e=>e.open')==wanted,(engine,'reload',selector,wanted)
    assert (page.locator('[data-presenter-lyrics-toggle]').get_attribute('aria-expanded')=='true')==wanted
   # Explicit closed choice overrides open-by-default; other items keep defaults.
   assert not page.locator('.svc-authoring-panel').evaluate('e=>e.open')
   assert not page.evaluate("MindexDisclosure.read(['citation-translations','other-service','disclosure-item'])")
   assert page.evaluate("MindexDisclosure.read(['unknown-default'],true)")
   print('PASS',engine,'open/closed survive actual editor remount and reload; scope/defaults preserved',flush=True)
   browser.close()
finally:server.shutdown()
