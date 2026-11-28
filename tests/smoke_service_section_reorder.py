"""Worship outline section controls reorder whole sections without changing content."""
from urllib.parse import urlsplit

from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as playwright:
        for engine in ["chromium", "webkit"]:
            browser = launch_chromium(playwright) if engine == "chromium" else playwright.webkit.launch()
            try:
                page = browser.new_page(viewport={"width": 1280, "height": 900})
                page.route("**/*", lambda route: route.continue_()
                           if urlsplit(route.request.url).netloc == urlsplit(url).netloc else route.abort())
                page.goto(url + "?output=presenter&mindexSmokeRaw=1")
                page.wait_for_function("() => { try { return typeof state === 'object' && typeof moveServiceOutlineSection === 'function'; } catch { return false; } }")
                result = page.evaluate("""() => {
                  const sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
                  const keys=['praise','offering','scripture','sermon','decision'];
                  const labels=['찬양','봉헌','성경봉독','설교','결단'];
                  const ids=keys.map((_,index)=>`${index+1}`.repeat(8)+'-'+`${index+1}`.repeat(4)+'-4'+`${index+1}`.repeat(3)+'-8'+`${index+1}`.repeat(3)+'-'+`${index+1}`.repeat(12));
                  const service={id:sid,type_id:'external',date:'2026-11-29',title:'격리 예배'};
                  state.services=[service];state.selectedServiceId=sid;state.loadedWorshipServiceIds=new Set([sid]);
                  state.serviceItems={[sid]:keys.map((key,index)=>normalizeServiceItem({
                    id:crypto.randomUUID(),service_id:sid,label:labels[index],raw_title:`내용 ${index+1}`,
                    _worshipSectionId:ids[index],_worshipSectionKey:key,_worshipSectionTitle:labels[index],
                    _worshipSectionOrder:index+1,_worshipElementOrder:1,
                    memo:serializeServiceItemMemo({elementType:'body'}),
                  },index))};
                  state.dirty.service=false;state.dirtyServiceStructureIds.clear();
                  refreshPresenterForService=()=>{};renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};updateSaveState=()=>{};
                  const before=state.serviceItems[sid].map(item=>({id:item.id,title:item.raw_title,memo:item.memo}));
                  moveServiceOutlineSection(sid,ids[1],'up');
                  const afterUp=state.serviceItems[sid].map(item=>item._worshipSectionKey);
                  moveServiceOutlineSection(sid,ids[1],'down');
                  moveServiceOutlineSection(sid,ids[1],'down');
                  const afterDown=state.serviceItems[sid].map(item=>item._worshipSectionKey);
                  const after=state.serviceItems[sid].map(item=>({id:item.id,title:item.raw_title,memo:item.memo}));
                  const html=renderServiceCurrentSidebar(service,[]);
                  document.body.innerHTML=`<main>${html}</main>`;refreshIcons(document.body);
                  const buttons=[...document.querySelectorAll('[data-service-section-action]')];
                  const style=getComputedStyle(buttons.find(button=>!button.disabled));
                  const templateService={id:sid,type_id:'young-adult',date:'2026-11-29',title:'청년부 예배'};
                  const scaffold=buildWorshipServiceScaffold(sid,'young-adult',{service:templateService});
                  const templateItems=groupWorshipElements(scaffold.sections,scaffold.elements)[sid];
                  const desired=['praise','offering','scripture_reading','sermon','response_song'];
                  const otherKeys=[];
                  templateItems.forEach(item=>{if(!desired.includes(item._worshipSectionKey)&&!otherKeys.includes(item._worshipSectionKey))otherKeys.push(item._worshipSectionKey)});
                  const firstPraise=otherKeys.findIndex(key=>{
                    const templateIndex=templateItems.findIndex(item=>item._worshipSectionKey===key);
                    return templateIndex>templateItems.findIndex(item=>item._worshipSectionKey==='praise');
                  });
                  const reorderedKeys=[...otherKeys.slice(0,firstPraise),...desired,...otherKeys.slice(firstPraise)];
                  const orderByKey=new Map(reorderedKeys.map((key,index)=>[key,index+1]));
                  const authored=templateItems.map(item=>({...item,
                    _worshipSectionOrder:orderByKey.get(item._worshipSectionKey)||item._worshipSectionOrder,
                    _worshipSectionTemplateModified:true,
                  }));
                  const reopened=normalizeServiceItemsForTemplateHierarchy(templateService,authored);
                  const reopenedKeys=[];
                  reopened.forEach(item=>{if(!reopenedKeys.includes(item._worshipSectionKey))reopenedKeys.push(item._worshipSectionKey)});
                  return {before,after,afterUp,afterDown,dirty:state.dirty.service,
                    structureDirty:state.dirtyServiceStructureIds.has(sid),buttons:buttons.length,
                    width:style.width,height:style.height,border:style.borderTopWidth,
                    reopenedTargetOrder:reopenedKeys.filter(key=>desired.includes(key))};
                }""")
                assert result["afterUp"] == ["offering", "praise", "scripture", "sermon", "decision"]
                assert result["afterDown"] == ["praise", "scripture", "offering", "sermon", "decision"]
                assert sorted(result["before"], key=lambda item: item["id"]) == sorted(result["after"], key=lambda item: item["id"])
                assert result["dirty"] and result["structureDirty"]
                assert result["buttons"] == 10
                assert result["width"] == "30px" and result["height"] == "30px" and result["border"] == "1px"
                assert result["reopenedTargetOrder"] == ["praise", "offering", "scripture_reading", "sermon", "response_song"]
                print(engine, "PASS whole-section order, content preservation, save dirtiness and shared dense stroke")
            finally:
                browser.close()
finally:
    server.shutdown()
