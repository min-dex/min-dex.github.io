from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch(headless=True)
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof getServiceOutputItems === 'function'")
                result = page.evaluate('''() => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const service={id:'explicit-order-test',type_id:'sunday-afternoon',date:'2026-10-25',title:'주일오후예배'};
                  state.services=[service];state.serviceItems={};
                  const variants=[undefined,false,true].map(flag=>{
                    service._worshipSourceRef={dedication_service:flag};
                    return publicSundayAfternoonTemplate({service});
                  });
                  check(variants.every(t=>JSON.stringify(t)===JSON.stringify(variants[0])),'Dedication changes template');
                  check(!renderServiceMetaEditor(service).includes('data-service-meta-field="dedication"'),'Retired dedication toggle');
                  const scaffold=buildWorshipServiceScaffold(service.id,service.type_id,{service});
                  check(scaffold.elements.every(e=>!e.config?.hiddenInPresentation),'Auto-hidden afternoon item');
                  const third=buildWorshipServiceScaffold('third-order-test','sunday-third');
                  check(third.elements.every(e=>!e.config?.hiddenInPresentation),'Auto-hidden third-service item');
                  check(!third.elements.some(e=>['새가족환영','사죄의 선언'].includes(e.source_ref?.label)),'Retired hidden placeholders');
                  const target=scaffold.elements.find(e=>e.source_ref?.label==='특송');
                  check(target,'No special-song slot');
                  state.serviceItems=groupWorshipElements(scaffold.sections,scaffold.elements);
                  const before=getServiceOutputItems(service.id).map(i=>i.id);
                  // Existing atomic row representation of an explicit template-slot deletion.
                  const reopened=scaffold.elements.map(e=>e.id===target.id?{...e,config:{templateSuppressed:true},template_modified:true}:e);
                  state.serviceItems=groupWorshipElements(scaffold.sections,reopened);
                  state.templateElementSuppressions.clear();
                  for(let n=0;n<3;n++){
                    const items=getServiceOutputItems(service.id);
                    check(!items.some(i=>i.id===target.id),'Deleted slot resurrected');
                    check(JSON.stringify(items.map(i=>i.id))===JSON.stringify(before.filter(id=>id!==target.id)),'Other order changed');
                  }
                  const normal=getServiceOutputItems(service.id).find(i=>i._worshipSectionKey==='offering');
                  check(normal&&!serviceItemPresentationHidden(normal),'Offering unexpectedly hidden');
                  const states=groupWorshipElements(scaffold.sections,scaffold.elements)[service.id]
                    .filter(i=>['special_song','offering'].includes(i._worshipSectionKey)).map(i=>{
                      const m=parseServiceItemMemo(i.memo),s=resolvePresenterServiceItemContentState(i,m,serviceItemLinkedSong(i),service);
                      return {sectionKey:i._worshipSectionKey,label:i.label,hidden:!!m.hiddenInPresentation,state:s.state,reason:s.reason,required:!!s.required};
                    });
                  return {explicitOrder:true,deletedSlotStaysDeleted:true,otherOrderPreserved:true,states};
                }''')
                print('PASS', engine, result, flush=True)
                browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
