import os,sys
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
sys.path.insert(0,str(Path.cwd()/'tests'))
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
out=Path('/tmp/mindex-offering-layout');out.mkdir(parents=True,exist_ok=True)
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch(headless=True)
   context=browser.new_context(viewport={'width':1000,'height':640},device_scale_factor=2)
   context.add_init_script('Element.prototype.requestFullscreen=async()=>{};Element.prototype.webkitRequestFullscreen=()=>{};window.open=()=>null')
   context.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?output=presenter',wait_until='domcontentloaded')
   page.wait_for_function("typeof replaceServiceOfferingSpecial==='function'")
   page.evaluate('''()=>{
    const service={id:'qa-capture',type_id:'sunday-main',date:'2026-09-20',alias:'온세대 찬양예배'};
    const item=normalizeServiceItem({id:'qa-offering',service_id:service.id,label:'봉헌찬송',raw_title:'535 주 예수 대문 밖에',song_id:'qa-song',version_id:'qa-version',_worshipSectionKey:'offering',_worshipSlotKey:'offering.praise',_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})});
    state.services=[service];state.selectedServiceId=service.id;state.serviceItems={[service.id]:[item]};
    state.songs=[{id:'qa-song',title:'주 예수 대문 밖에',hymn_no:'535',praise_type:'hymn',praise_types:['hymn'],_relationalVersionsLoaded:true,versions:[{id:'qa-version',name:'새찬송가',_worshipVersionPersisted:true,forms:[]}]}];
    state.client=null;
    document.body.innerHTML='<main id="capture" style="padding:24px;max-width:1000px"></main>';
    applyTheme('dark');document.body.style.cssText='display:block;margin:0;background:var(--bg);';document.getElementById('capture').style.width='1000px';
   }''')
   for width in [320, 700, 1100]:
    page.set_viewport_size({'width':width,'height':900})
    page.evaluate('(width)=>{document.getElementById("capture").style.cssText=`padding:15px;width:${width}px;box-sizing:border-box`}',width)
    bounds=[]
    for mode in ['special','video','hymn']:
     print(page.evaluate('''mode=>{
      const service=state.services[0], item=state.serviceItems[service.id][0];
      if(!replaceServiceOfferingSpecial(item,mode))throw Error('transition failed');
      const context={item,index:0,service};
      presenterBoardSubgroupInputContexts=()=>[context];presenterBoardSubgroupItemContext=()=>context;
      presenterBoardSubgroupDisplay=()=>({label:item.label,title:item.raw_title});
      document.getElementById('capture').innerHTML=renderPresenterBoardSubgroup({slides:[],name:item.label},-1,service.id,{showHead:true});
      document.body.classList.remove('ui-booting');
      if(window.lucide)lucide.createIcons();
      return {mode,label:item.label,input:serviceMemoInputMode(parseServiceItemMemo(item.memo),item)};
     }''',mode),flush=True)
     page.locator('#capture').screenshot(path=str(out/f'{engine}-{width}-{mode}.png'))
     bounds.append(page.evaluate('''()=>{
       const editor=document.querySelector('.service-offering-editor');
       const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
       const save=editor.querySelector('[data-service-item-commit]');
       if(document.querySelectorAll('[data-service-item-commit]').length!==1)throw Error('duplicate save');
       if(editor.scrollWidth>editor.clientWidth+1)throw Error('editor overflow');
       return {mode:box(editor.querySelector('.service-offering-modes')),save:box(save)};
     }'''))
    assert bounds[0]==bounds[1]==bounds[2], (width,bounds)
    print('PASS stable choice/save geometry',width,flush=True)
   browser.close()

finally:server.shutdown()
