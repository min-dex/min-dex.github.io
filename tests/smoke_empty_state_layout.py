"""Offline full-pane state alignment; embedded loading remains flow content."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url+'?mindexSmokeRaw=1',wait_until='domcontentloaded');page.wait_for_function("typeof renderConnectionEmptyDetail==='function' && !document.body.classList.contains('ui-booting')");page.locator("#bootStatus").wait_for(state="hidden")
   for size in [(1440,1000),(1000,600),(800,400),(390,640)]:
    page.set_viewport_size(dict(zip(['width','height'],size)))
    for theme in ['light','dark']:
     for case in ['loading','connection','module','praise','auth','no-gathering','deferred']:
      result=page.evaluate('''({theme,kind})=>{
       applyTheme(theme);document.body.dataset.module='service';state.module='service';setRightSidebarContent('');
       const svc={id:'audit',type_id:'sunday-main',date:'2026-10-18',title:'검증 예배'};
       let html='';
       if(kind==='loading')html=renderLoadingDetail();
       if(kind==='connection')html=renderConnectionEmptyDetail();
       if(kind==='module')html=renderModuleEmptyDetail('none','말씀','성경 권을 선택하세요.');
       if(kind==='praise')html=renderPraiseEmptyDetail();
       if(kind==='auth')html=renderAuthRequiredDetail();
       if(kind==='deferred')html=renderDeferredPastServiceDetail(svc);
       if(kind==='no-gathering')renderNoGatheringServiceDetail(svc);else refs.detailPane.innerHTML=html;
       refreshIcons(refs.detailPane);
       const root=refs.detailPane,outer=root.getBoundingClientRect(),box=root.querySelector('.empty-detail-inner')||root.firstElementChild;
       let rect=box.getBoundingClientRect();
       if(kind==='loading') {const first=box.firstElementChild.getBoundingClientRect(),last=box.lastElementChild.getBoundingClientRect();rect={top:first.top,height:last.bottom-first.top,left:rect.left,width:rect.width};}
       return {dy:Math.round(rect.top+rect.height/2-outer.top-outer.height/2),dx:Math.round(rect.left+rect.width/2-outer.left-outer.width/2),scroll:root.scrollHeight-root.clientHeight,width:root.scrollWidth-root.clientWidth,height:Math.round(rect.height)};
      }''',{'theme':theme,'kind':case})
      assert abs(result['dy'])<=2 and abs(result['dx'])<=2 and result['scroll']<=1 and result['width']<=1,(engine,size,theme,case,result)
      if theme=='dark' and size==(1000,600):page.screenshot(path=f'/tmp/mindex-audit-{engine}-{case}.png')
   assert page.evaluate('''()=>{
    refs.detailPane.innerHTML='<div class="service-dashboard">'+renderLoadingDetail()+'</div>';
    const el=refs.detailPane.querySelector('.detail-loading-skeleton'),css=getComputedStyle(el);
    const box=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();
    return css.position!=='fixed' && css.position!=='absolute' && box.height>0 && box.height<200
      && box.top>=parent.top && box.bottom<=parent.bottom+1
      && el.scrollHeight<=el.clientHeight+1 && el.scrollWidth<=el.clientWidth+1
      && parseFloat(getComputedStyle(refs.detailPane).paddingTop)>0;
   }'''), 'embedded skeleton changed'
   for mode in ('service','presenter'):
    page.evaluate('''mode=>{
     state.module=mode;window.auditOpened='';selectService=id=>auditOpened=id;openServiceInPresenter=async id=>auditOpened=id;
     refs.detailPane.innerHTML=renderDeferredPastServiceDetail({id:'audit-past',type_id:'sunday-main',date:'2026-10-11'});
    }''',mode)
    page.get_by_role('button',name='예배 불러오기').click()
    assert page.evaluate('auditOpened')=='audit-past',mode
   print(engine,'PASS centered states across 4 sizes/2 themes, nested loading unchanged, both deferred-open actions')
   browser.close()
finally:server.shutdown()
