from pathlib import Path
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda route: route.abort())
                attempts = {'transient': 0, 'failed': 0}
                recovered = {'value': False}

                def image_route(route):
                    kind = 'transient' if 'transient' in route.request.url else 'failed'
                    attempts[kind] += 1
                    if (kind == 'transient' and attempts[kind] > 1) or recovered['value']:
                        route.fulfill(body=Path('assets/favicon-32.png').read_bytes(), content_type='image/png')
                    else:
                        route.abort()

                page.route('**/retry-*.png', image_route)
                page.goto(url + '?output=presenter', wait_until='domcontentloaded')
                page.wait_for_function("typeof presenterOutputImagePreloadCache !== 'undefined' && !!document.getElementById('presenterOutputRoot')")
                page.evaluate('''async () => {
                  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                  const transient=new URL('retry-transient.png',location.href).href;
                  const pending=preloadPresenterOutputImage(transient,{priority:'low'});
                  check(pending===preloadPresenterOutputImage(transient),'inflight request duplicated');
                  const entry=presenterOutputImagePreloadCache.get(transient);
                  check(entry.priority==='high','active image priority not promoted');
                  await pending;
                  check(presenterOutputImageIsReady(transient),'transient failure did not recover');
                  window.failedSource=new URL('retry-failed.png',location.href).href;
                  await preloadPresenterOutputImage(failedSource);
                  check(!presenterOutputImageIsReady(failedSource),'failure marked ready');
                  const record=presenterOutputImagePreloadCache.get(failedSource);
                  check(record.failed,'failure not recorded');
                  check(preloadPresenterOutputImage(failedSource)===record.promise,'background retry loop');
                  window.imagePayload={serviceId:'retry',chromakey:true,index:0,slides:[
                    {id:'hold',type:'title-assignee',elementType:'title_assignee',layout:'lower-bar-text',text:'Previous'},
                    {id:'score',type:'image',elementType:'image',layout:'media',imageSrc:failedSource,sourceType:'score'}]};
                  renderPresenterOutput(imagePayload);
                  window.heldLayer=document.querySelector('#presenterOutputRoot .is-active');
                  renderPresenterOutput({...imagePayload,index:1});
                  await preloadPresenterOutputImage(failedSource);
                  check(document.querySelector('#presenterOutputRoot .is-active')===heldLayer,'failed image replaced previous frame');
                }''')
                assert attempts['transient'] == 2, attempts
                assert attempts['failed'] == 4, attempts
                recovered['value'] = True
                page.evaluate('''async () => {
                  renderPresenterOutput({...imagePayload,index:1});
                  await preloadPresenterOutputImage(failedSource);
                }''')
                page.wait_for_function("!!document.querySelector('#presenterOutputRoot .is-active img')")
                assert page.evaluate('presenterOutputImageIsReady(failedSource)')
                print('PASS', engine, attempts, 'retry, priority, previous frame retained, recovered image shown')
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
