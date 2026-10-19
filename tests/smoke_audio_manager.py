"""Audio registration controls stay in the header; attached audio is managed below inputs."""
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=b.new_page(viewport={'width':1100,'height':800})
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.goto(url);page.wait_for_function("typeof renderPresenterBoardSubgroupInputControls==='function' && !!globalThis.MindexSongTiming && !document.body.classList.contains('ui-booting')")
    page.locator('#bootStatus').wait_for(state='hidden')
    print(engine,page.evaluate('''async()=>{
     const check=(v,m)=>{if(!v)throw Error(m)};
     const service={id:'audio-ui-fixture',type_id:'fixture'},song={id:'audio-song',title:'관리창 테스트',_relationalVersionsLoaded:true,versions:[{id:'audio-version',name:'버전',forms:[{part_type:'Verse',lyrics:'테스트 가사'}]}]};
     const item=normalizeServiceItem({id:'audio-item',service_id:service.id,label:'찬양 1',song_id:song.id,version_id:'audio-version',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V-C-V'})});
     state.services=[service];state.songs=[song];state.selectedServiceId=service.id;state.serviceItems={[service.id]:[item]};
     const context={service,item,index:0};presenterBoardSubgroupInputContexts=()=>[context];
     const slide={elementId:item.id,songTimingElementId:item.id,songTimingKey:'audio-key',songTimingEligible:true,type:'lyrics',text:'테스트 가사'};
     const subgroup={slides:[{slide},{slide:{...slide,type:'song-title'}}]};
     const host=document.createElement('main');host.style.cssText='position:fixed;inset:0;z-index:9999;background:var(--bg);padding:20px;overflow:auto';document.body.append(host);
     const render=()=>{host.innerHTML=renderPresenterBoardItemActions(service.id,{...context,timingEntries:subgroup.slides})+renderPresenterBoardSubgroupInputControls(service.id,subgroup,{headerActions:true})};
     render();check(!host.querySelector('[data-song-timing-open]'),'sync without audio');check(!host.querySelector('.svc-audio-manager'),'empty manager');check(host.querySelectorAll('[data-service-item-audio-file]').length===1,'upload missing/duplicated');
     item.memo=serializeServiceItemMemo({...parseServiceItemMemo(item.memo),audioAsset:{kind:'audio',url:'https://example.invalid/test.wav',name:'등록 음원.wav'}});
     const before=JSON.stringify({song,item});render();const manager=host.querySelector('.svc-audio-manager');check(manager,'missing manager');check(manager.closest('.svc-board-subgroup-control-item'),'manager outside input');check(manager.querySelector('audio'),'missing player');check(manager.querySelector('[data-service-item-audio-file]'),'missing replace');check(manager.querySelector('[data-service-item-audio-clear]'),'missing disconnect');check(manager.querySelectorAll('[data-song-timing-open]').length===1,'timing duplicate/missing');check(!host.querySelector('.svc-board-subgroup-flow audio'),'player remains in header');check(host.querySelectorAll('[data-service-item-audio-file]').length===1,'duplicate upload');
     check(JSON.stringify({song,item})===before,'render mutated records');
     window.audioManagerLayout=()=>{const m=host.querySelector('.svc-audio-manager'),r=m.getBoundingClientRect();if(r.width<m.parentElement.getBoundingClientRect().width-2)throw Error('manager not full width');for(const el of m.querySelectorAll('audio,button,label')){const b=el.getBoundingClientRect();if(b.right>r.right+1||b.left<r.left-1)throw Error('manager overflow')}return 'layout PASS'};
     window.audioManagerRender=render;window.audioManagerItem=item;window.audioManagerSubgroup=subgroup;
     return 'PASS empty/upload, attached manager, single sync button, unchanged song/item';
    }'''),flush=True)
    for width in (1100,600):
     page.set_viewport_size({'width':width,'height':800});print(engine,width,page.evaluate('audioManagerLayout()'),flush=True)
     page.screenshot(path=f'/tmp/mindex-audio-manager-{engine}-{width}.png')
    print(engine,page.evaluate('''async()=>{
     const item=audioManagerItem;item.memo=serializeServiceItemMemo({...parseServiceItemMemo(item.memo),audioAsset:{},inputMode:'children_audio'});
     audioManagerSubgroup.slides.forEach(({slide})=>{slide.songTimingAudio={url:'https://example.invalid/children.wav',name:'현재 어린이 음원'};});
     audioManagerRender();const manager=document.querySelector('.svc-audio-manager');if(!manager?.querySelector('[data-song-timing-open]')||!manager.textContent.includes('현재 어린이 음원'))throw Error('existing profile inaccessible');
     audioManagerSubgroup.slides.forEach(({slide})=>{slide.serviceTimingPage=true;slide.serviceTimingAudioSource='';});audioManagerRender();if(document.querySelector('.svc-audio-manager'))throw Error('stale service profile resurrected disconnected audio');
     return 'PASS children profile accessible; stale service profile cannot resurrect disconnected audio';
    }'''),flush=True)
   finally:b.close()
finally:server.shutdown();server.server_close()
