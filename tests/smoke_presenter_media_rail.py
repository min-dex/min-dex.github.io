"""Item transports share a left rail without replacing players or editor nodes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import sync_playwright,launch_chromium,start_local_app_server
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page(viewport={'width':1200,'height':1000})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort());page.goto(url)
   page.wait_for_function("typeof arrangePresenterBoardMediaControls==='function'&&!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate(r'''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const dawn={id:'rail-dawn',type_id:'holy_week_dawn',date:'2026-11-02'},friday={id:'rail-friday',type_id:'friday',date:'2026-11-06'};
    const closing={id:'closing',service_id:dawn.id,label:'기도회',raw_title:'통성기도',_worshipSlotKey:'prayer.meeting.free',_worshipSectionKey:'prayer_meeting',memo:serializeServiceItemMemo({elementType:'title'})};
    const before=JSON.stringify(closing);state.services=[dawn,friday];state.serviceItems={[dawn.id]:[closing]};
    const projected=adaptServiceItemsForPresenterView(dawn,[closing]);check(projected[0].label==='자율기도'&&projected[0]._worshipSectionTitle==='자율기도','projection');
    check(presenterFixedTitleText(projected[0])==='자율기도','fixed slide title');check(JSON.stringify(closing)===before,'source rewritten');
    const prayerSlides=presenterSlidesForService(dawn.id).filter(s=>s.elementId===closing.id&&!s.autoTrailingBlank);check(prayerSlides.some(s=>s.text==='자율기도'&&s.sectionKey==='free_prayer'),'actual generated prayer slide');
    check(!serviceItemIsFreePrayer({...closing,_worshipSlotKey:'prayer.opening',label:'기도'},dawn),'opening prayer renamed');
    check(!serviceItemIsFreePrayer({...closing,label:'기도',memo:serializeServiceItemMemo({elementType:'title_person'})},dawn),'assigned prayer renamed or made static');
    check(!serviceItemIsFreePrayer({...closing,_worshipSlotKey:'response.prayer'},friday),'Friday response renamed');
    check(!presenterSlotMusicConfig({service:dawn,item:{label:'기도',_worshipSlotKey:'response.prayer',memo:serializeServiceItemMemo({elementType:'title_person'})}}),'assigned prayer gained music');
    const slot=renderServiceSlotMusic({service:dawn,item:closing});check(slot.includes('새벽기도회 자율기도 음원')&&!slot.includes('자율기도 음악'),'audio label');
    check(renderServiceSlotMusic({service:friday,item:{_worshipSlotKey:'prayer.meeting.free'}}).includes('금요기도회 자율기도 음원'),'Friday audio label');
    const host=document.createElement('div');host.id='rail-proof';host.style.cssText='position:fixed;inset:0;overflow:auto;background:var(--bg);z-index:99999;padding:15px';document.body.append(host);
    const asset={url:'https://example.invalid/video.mp4',name:'영상'},key={original:{format:'key',sha256:'a'.repeat(64)},keynoteHtml:{pages:20}};
    const controls=[slot,renderPresenterInputAudioControls('https://example.invalid/a.mp3','연결 음원',dawn.id,'audio'),renderPresenterInputVideoControls(asset,[dawn.id,'video']),renderPresenterKeynoteHtmlControls(key,dawn.id,'key')];
    host.innerHTML=controls.map((html,i)=>`<section class="svc-board-subgroup"><h3>${['자율기도','음원','영상','Keynote'][i]}</h3><div class="editor"><input style="box-sizing:border-box;width:100%;min-width:0" value="draft-${i}">${html}</div><div class="svc-board-grid"><div style="aspect-ratio:16/9;background:#111;color:white">슬라이드 ${i+1}</div></div></section>`).join('');
    const originalMarkup=host.innerHTML;
    const players=[...host.querySelectorAll('.svc-music-player--inline,.svc-input-media-controls,.svc-deck-playback')],inputs=[...host.querySelectorAll('.editor > input')],audio=state.serviceMusic.audio;
    const identity=JSON.stringify({source:state.serviceMusic.sourceKey,owner:state.serviceMusic.ownerServiceId,playing:state.serviceMusic.playing});
    for(const theme of ['light','dark'])for(const width of [1000,600,254]){
     document.body.dataset.theme=theme;host.style.width=width+'px';arrangePresenterBoardMediaControls(host);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     check(host.querySelectorAll('.svc-board-media-rail').length===4,'missing or duplicate rail');
     check(players.every(x=>x.isConnected&&x.closest('.svc-board-media-rail')),'transport not moved');
     for(const group of host.querySelectorAll('.svc-board-subgroup')){
      check(group.scrollWidth<=group.clientWidth+1,'overflow '+width+' '+group.querySelector('h3').textContent+' '+group.scrollWidth+'/'+group.clientWidth+' '+[...group.querySelectorAll('*')].filter(x=>x.getBoundingClientRect().right>group.getBoundingClientRect().right+1).map(x=>x.className).join(',')+' dimensions '+[...group.querySelectorAll('.editor,.editor>input,.svc-board-media-layout,.svc-board-media-rail,.svc-music-player,.svc-music-transport,.svc-volume-control,.song-timing-seek,.svc-board-grid')].map(x=>[x.className,x.clientWidth,x.scrollWidth,getComputedStyle(x).minWidth]).join(';'));
      const rail=group.querySelector('.svc-board-media-rail').getBoundingClientRect(),grid=group.querySelector('.svc-board-grid').getBoundingClientRect();
      if(width>=600)check(rail.right<=grid.left+1,'not left '+width);else check(rail.bottom<=grid.top+1,'narrow order');
     }
    }
    const range=players[0].querySelector('input[type=range]');range.focus();const focused=document.activeElement;arrangePresenterBoardMediaControls(host);check(document.activeElement===focused,'focus lost');
    const next=document.createElement('div');next.innerHTML=originalMarkup;arrangePresenterBoardMediaControls(next);
    [...host.querySelectorAll('.svc-board-subgroup')].forEach((current,i)=>patchPresenterControlTree(current,next.children[i]));
    check(document.activeElement===focused&&players.every(x=>x.isConnected),'patch replaced transport/focus');
    check(inputs.every((input,i)=>input.isConnected&&input.value==='draft-'+i),'editor replaced');
    check(state.serviceMusic.audio===audio&&JSON.stringify({source:state.serviceMusic.sourceKey,owner:state.serviceMusic.ownerServiceId,playing:state.serviceMusic.playing})===identity,'player changed');
    check(players[0].querySelector('[data-service-music-action=stop]').textContent.includes('정지'),'unlabeled square');
    host.id='servicePresenterControls';host.dataset.focusView='true';check([...host.querySelectorAll('.svc-board-media-rail')].every(x=>getComputedStyle(x).display==='none'),'focus view exposed controls');delete host.dataset.focusView;host.id='rail-proof';
    refreshIcons(host);host.style.width='1000px';document.body.dataset.theme='dark';return 'PASS all four transports, side/narrow layout, focus/player/draft identity, shared prayer naming, no output/playback';
   }'''),flush=True)
   if os.environ.get('MINDEX_MEDIA_PROOF_DIR'):page.screenshot(path=os.path.join(os.environ['MINDEX_MEDIA_PROOF_DIR'],engine+'-media-rail.png'))
   b.close()
finally:server.shutdown()
