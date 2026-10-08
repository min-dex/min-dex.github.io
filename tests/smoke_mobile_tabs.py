"""Offline mobile tab visibility and existing tab lifecycle regression."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1440, 'height': 900})
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(url + '?mindexSmokeRaw=1', wait_until='load')
                page.wait_for_function("typeof renderPageTabs === 'function'")
                page.evaluate('''() => {
                  confirmSaveBeforeLeaving=async()=>true;
                  state.pageTabs=Array.from({length:5},()=>newPageTab({module:'home'}));
                  state.pageTabIndex=4; renderPageTabs();
                }''')
                for width in (560, 390, 320, 768, 1440, 390):
                    page.set_viewport_size({'width': width, 'height': 900})
                    page.wait_for_timeout(150)
                    result = page.evaluate('''() => {
                      const rect=s=>document.querySelector(s).getBoundingClientRect();
                      const tabs=rect('.page-tabs'),active=rect('.page-tab.active');
                      const bar=rect('.topbar'),actions=rect('.topbar-actions');
                      return {barHeight:bar.height,tabsWidth:tabs.width,
                        activeVisible:active.left>=tabs.left-1 && active.right<=tabs.right+1,
                        separate:tabs.top>=actions.bottom,
                        drawerTop:parseFloat(getComputedStyle(document.querySelector('.nav-sidebar')).top),
                        overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)>innerWidth,
                        modules:[...document.querySelectorAll('.module-switcher-tab')].every(e=>{
                          const r=e.getBoundingClientRect();return r.width>0 && r.left>=0 && r.right<=actions.left+1;
                        })};
                    }''')
                    assert not result['overflow'], (engine, width, result)
                    assert result['tabsWidth'] > 0, (width, result)
                    assert result['barHeight'] == (90 if width <= 560 else 50), (width, result)
                    if width <= 560:
                        assert result['activeVisible'] and result['separate'] and result['modules'], result
                        assert result['drawerTop'] == 90, result
                page.locator('.page-tabs').evaluate('(e)=>e.scrollLeft=0')
                page.locator('[data-page-tab-index="0"]').click()
                page.wait_for_function('state.pageTabIndex === 0')
                assert page.locator('.page-tab.active').get_attribute('data-page-tab-index') == '0'
                page.locator('[data-page-tab-close="0"]').click()
                page.wait_for_function('state.pageTabs.length === 4')
                page.locator('#pageTabAddBtn').click()
                page.wait_for_function('state.pageTabs.length === 5 && state.pageTabIndex === 1')
                page.reload(wait_until='load')
                page.wait_for_function('typeof state !== "undefined" && state.pageTabs.length === 5 && state.pageTabIndex === 1')
                page.locator('.page-tab.active').wait_for(state='visible')
                print('PASS mobile tabs at 320/390/560, desktop resize, switch/close/add/reload', engine)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
