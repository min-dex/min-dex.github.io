"""Actual offline editor screens with long data at desktop/narrow pane widths."""
import os,sys
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
sys.path.insert(0,'tests')
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
s,u=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page(viewport={'width':1440,'height':950});page.goto(u);page.wait_for_function("!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{window.qaLong='온세대 연합예배 준비를 위한 찬양과 참고 자료 안내 '.repeat(4);state.client={};state.connectionError='';state.referenceLinksLoaded=true;state.referenceGroupSupported=true;state.referenceError='';state.referenceLinks=[{id:'qa-link',title:qaLong,url:'https://example.invalid/'+('long-path/'.repeat(30)),group_name:qaLong,is_active:true}];state.editingReferenceId='qa-link';window.qaSong={id:'qa-song',title:qaLong,metadata:{artist:qaLong,album:qaLong},scripture:[],versions:[]};window.qaService={id:'qa-service',type_id:'sunday-second',date:'2026-10-18',title:qaLong};state.services=[qaService];state.selectedServiceId=qaService.id;state.serviceItems={[qaService.id]:[]};canUseClientData=()=>false;window.auditOpen=kind=>{setRightSidebarContent('');state.presenterSectionEditor=null;if(kind==='references'){state.module='references';renderReferencesDetail()}else if(kind==='song-metadata'){refs.detailPane.innerHTML=renderSongMetadataDialog(qaSong)}else if(kind==='scripture-metadata'){refs.detailPane.innerHTML=renderScriptureMetadataDialog({title:qaLong,book:'창세기',reference:'창세기 1:1',translation:qaLong})}else if(kind==='prep'){refs.detailPane.innerHTML=renderServicePrepEditorDialog(qaService);refs.detailPane.querySelectorAll('details').forEach(d=>d.open=true)}else if(kind==='section'){const target=servicePrepEditorItems(qaService.id).find(isMainPraiseServiceItem);state.presenterSectionEditor={serviceId:qaService.id,itemId:target.id,sectionKey:''};refs.detailPane.innerHTML=renderPresenterSectionEditorLayer(qaService)}else if(kind==='templates'){renderServiceTemplatesDetail()}refreshIcons(refs.detailPane)};}''')
   for width in [1440,900,760,640]:
    page.set_viewport_size({'width':width,'height':950})
    page.evaluate("t=>applyTheme(t)",'dark' if width in [1440,760] else 'light')
    for kind in ['references','song-metadata','scripture-metadata','prep','section','templates']:
     page.evaluate('(k)=>auditOpen(k)',kind)
     result=page.evaluate('''()=>{let failures=[];for(const e of refs.detailPane.querySelectorAll('input,select,textarea,button,h3,.reference-group-head,.reference-editor-actions,.metadata-popover-head')){if(!e.getClientRects().length||e.closest('[hidden]'))continue;const r=e.getBoundingClientRect();const parent=e.closest('[role="dialog"],.editor-shell')||refs.detailPane;const q=parent.getBoundingClientRect();if(r.right>q.right+2||r.left<q.left-2)failures.push({class:e.className,tag:e.tagName,overflow:Math.round(r.right-q.right)});if(e.matches('h3,.reference-group-head,.reference-editor-actions')&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX==='visible')failures.push({class:e.className,textOverflow:e.scrollWidth-e.clientWidth})}const controls=[...refs.detailPane.querySelectorAll('input,select,textarea,button')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>({e,r:e.getBoundingClientRect()})).filter(o=>o.r.width>0&&o.r.height>0);for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(a.e.contains(b.e)||b.e.contains(a.e))continue;const w=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),h=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);if(w>2&&h>2)failures.push({overlap:[a.e.className,b.e.className],w,h})}return failures}''')
     assert not result,(engine,width,kind,result)
     print(engine,width,kind,'PASS',flush=True)
     if width==760:page.screenshot(path=f'/tmp/editor-audit-{engine}-{width}-{kind}.png')
   b.close()
finally:s.shutdown()
