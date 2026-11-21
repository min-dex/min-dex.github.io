from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chrome', 'webkit'):
                browser = launch_chromium(p) if engine == 'chrome' else p.webkit.launch()
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.route('**/app.runtime.js*', lambda route: route.fulfill(
                    path='app.js', content_type='text/javascript'))
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof state !== 'undefined' && typeof renderPresenterBoardStructureActions === 'function'")
                result = page.evaluate('''() => {
                  const service={id:'section-action-fixture',type_id:'sunday-second',date:'2026-09-13'};
                  state.services=[service]; state.serviceItems[service.id]=[];
                  state.selectedServiceId=service.id;
                  renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};
                  refreshPresenterForService=()=>{};updateSaveState=()=>{};
                  const target=servicePrepEditorItems(service.id).find(isMainPraiseServiceItem);
                  if(!target) throw Error('No praise fixture');
                  state.module='presenter';
                  const confirmations=[];
                  window.confirm=message=>{confirmations.push(message);return true};
                  const clickAction=action=>{
                    const current=servicePrepEditorItems(service.id).find(item=>item.id===target.id);
                    refs.detailPane.innerHTML=renderPresenterBoardStructureActions(service.id, {
                      service,item:current,index:current._origIndex,
                    });
                    const button=refs.detailPane.querySelector(`[data-presenter-inline-item-action="${action}"]`);
                    if(!button) throw Error('Unavailable inline action: '+action);
                    handlePresenterDetailClick({target:button,preventDefault(){},stopPropagation(){}});
                  };
                  const renderedActions=()=>{
                    const current=servicePrepEditorItems(service.id).find(item=>item.id===target.id);
                    refs.detailPane.innerHTML=renderPresenterBoardStructureActions(service.id, {
                      service,item:current,index:current._origIndex,
                    });
                    return [...refs.detailPane.querySelectorAll('[data-presenter-inline-item-action]')]
                      .map(button=>({action:button.dataset.presenterInlineItemAction,width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}));
                  };
                  const order=()=>{
                    const current=servicePrepEditorItems(service.id).find(item=>item.id===target.id);
                    return presenterSectionItemActionContext(service,current._origIndex).sectionItems.map(item=>item.id);
                  };
                  const before=order();
                  const initialActions=renderedActions();
                  if(initialActions.some(item=>item.action==='up') || !initialActions.some(item=>item.action==='down') || !initialActions.some(item=>item.action==='delete')) throw Error('Unexpected first-row actions');
                  if(initialActions.some(item=>item.width!==30 || item.height!==30)) throw Error('Inline action size drift');
                  clickAction('down');
                  if(order().indexOf(target.id)!==before.indexOf(target.id)+1) throw Error('Move down failed');
                  const middleActions=renderedActions();
                  if(!middleActions.some(item=>item.action==='up') || !middleActions.some(item=>item.action==='down')) throw Error('Missing middle-row moves');
                  clickAction('up');
                  if(JSON.stringify(order())!==JSON.stringify(before)) throw Error('Move up failed');
                  if(refs.detailPane.querySelector('[data-presenter-section-editor]')) throw Error('Retired popup remains');
                  const thumb=document.createElement('button');
                  thumb.className='svc-slide-thumb';
                  thumb.dataset.presenterIndex='0';
                  thumb.dataset.serviceId=service.id;
                  let prevented=false;
                  const originalSelect=selectPresenterBoardSlide;
                  selectPresenterBoardSlide=()=>{};
                  handleDetailContextMenu({target:thumb,preventDefault(){prevented=true}});
                  selectPresenterBoardSlide=originalSelect;
                  if(!prevented || state.presenterSectionEditor) throw Error('Right click reopened section popup');
                  window.confirm=message=>{confirmations.push(message);return false};
                  clickAction('delete');
                  if(!getServiceItems(service.id).some(item=>item.id===target.id)) throw Error('Cancelled deletion removed item');
                  window.confirm=message=>{confirmations.push(message);return true};
                  clickAction('delete');
                  for(let i=0;i<3;i++) {
                    if(getServiceItems(service.id).some(item=>item.id===target.id)) throw Error('Deleted item returned');
                  }
                  const suppression=state.templateElementSuppressions.get(target.id);
                  if(!suppression || !isTemplateSuppressedServiceItem(suppression)) throw Error('Missing suppression');
                  if(!confirmations.at(-1)?.includes('기본 예배 양식과 찬양·성경 DB는 바뀌지 않습니다.')) throw Error('Missing delete scope');
                  return {moved:true,compactActions:true,popupRemoved:true,rightClickInert:true,deleted:true,suppression:true,confirmation:true,cancelled:true};
                }''')
                print('PASS inline element actions', engine, result)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
