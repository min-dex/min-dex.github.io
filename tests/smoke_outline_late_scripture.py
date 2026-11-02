"""Delayed scripture adds pages before an explicitly selected sermon."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

SCRIPT = """async manual => {
  const id='late-outline', service={id,type_id:'external',title:'테스트 예배'};
  const labels=['준비','찬양','성경봉독','설교','기도'];
  const items=labels.map((label,i)=>({id:'item-'+i,service_id:id,label,sort_order:i+1}));
  const makeSlides=count=>[12,24,count,6,12].flatMap((n,i)=>Array.from({length:n},(_,j)=>({
    id:'s-'+i+'-'+j,sectionId:'sect-'+i,sectionTitle:labels[i],elementId:items[i].id,
    type:'lyrics',layout:'center-text',title:labels[i],text:labels[i]+' '+j
  })));
  let slides=makeSlides(manual==="loaded"?32:6);
  state.module='presenter';state.selectedServiceId=id;state.services=[service];state.serviceItems={[id]:items};
  state.presenter.serviceId=id;state.presenter.index=0;state.presenter.slides=slides;
  presenterSlidesForService=()=>slides;getServiceOutlineItems=()=>items;
  refs.detailPane.style.cssText='height:500px;overflow:auto';
  const render=()=>{refs.detailPane.innerHTML=renderServicePresenterControls(service,slides,true,0);
    mountDeferredPresenterBoardSections(document.getElementById('servicePresenterControls'),id,slides)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const list=refs.songList.cloneNode(false);refs.songList.replaceWith(list);refs.songList=list;bindStaticEvents();
  render(); refs.songList.innerHTML='<div class="service-outline-list">'+renderServiceOutlineChildRow(service,items[3],3,-1,slides)+'</div>';
  const button=refs.songList.querySelector('[data-service-outline-item-id="item-3"]');
  if (!button) throw Error('sermon outline missing');
  button.focus(); button.click();await wait(250);
  if(manual==="loaded"){
    const el=refs.detailPane.querySelector('[data-service-element-id="item-3"]');
    const offset=el?.getBoundingClientRect().top-refs.detailPane.getBoundingClientRect().top;
    if(!button.classList.contains("selected") || button.dataset.serviceOutlineSlide!=="68" || state.presenter.index!==0)throw Error("selection or output changed");
    if(!(offset>=0 && offset<120))throw Error("loaded click offset "+offset);
    return {offset};
  }
  if(manual) {
    const reading=refs.detailPane.querySelector('[data-service-element-id="item-2"]');
    scrollWithinPresenterViewport(reading,{block:'start',behavior:'auto'});
    await wait(30);
  }
  const idToCheck=manual?'item-2':'item-3';
  const offset=()=>{const el=refs.detailPane.querySelector('[data-service-element-id="'+idToCheck+'"]');
    return el ? el.getBoundingClientRect().top-refs.detailPane.getBoundingClientRect().top:null};
  const before=offset();if(before===null||before<0||before>=400)throw Error('fixture initial offset '+before);
  const focus=document.activeElement, live=state.presenter.index;
  let sends=0; publishPresenterState=()=>{sends++};
  const snap=capturePresenterViewportSnapshot(id);
  slides=makeSlides(32);state.presenter.slides=slides;
  render();restorePresenterViewportSnapshot(snap);await wait(150);
  const after=offset();
  if(after===null||Math.abs(after-before)>4)throw Error(JSON.stringify({before,after,snap}));
  if(document.activeElement!==focus||state.presenter.index!==live||sends)throw Error('focus/live index changed');
  return {before,after};
}"""


def main():
    server,url=start_local_app_server()
    try:
        with sync_playwright() as p:
            for name in ('chromium','webkit'):
                b=launch_chromium(p) if name=='chromium' else p.webkit.launch()
                page=b.new_page(viewport={'width':1200,'height':900})
                page.route('**/*supabase*/**',lambda route:route.abort())
                page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
                page.wait_for_function("typeof renderServicePresenterControls==='function' && !document.body.classList.contains('ui-booting')")
                for manual in ("loaded",False,True):
                    print(name,manual,page.evaluate(SCRIPT,manual),flush=True)
                b.close()
    finally:
        server.shutdown()

if __name__=='__main__':
    main()
