import os
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, local_url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(reduced_motion='reduce')
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(os.environ.get('MINDEX_TEST_URL', local_url), wait_until='domcontentloaded')
                page.wait_for_function("typeof handleSidebarToggle === 'function' && !document.body.classList.contains('ui-booting')")
                page.add_style_tag(content='.nav-sidebar { transition: none !important; }')
                for width in (390, 560, 800, 900, 901, 1200):
                    page.set_viewport_size({'width': width, 'height': 900})
                    result = page.evaluate('''() => {
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      return ['praise','scripture','presenter','manuals','service'].map(module=>{
                        state.module=module;document.body.dataset.module=module;
                        document.body.classList.remove('sidebar-collapsed');syncSidebarCollapsedState();
                        const nav=document.querySelector('.nav-sidebar'), side=document.querySelector('.sidebar');
                        const rect=side.getBoundingClientRect(), outer=nav.getBoundingClientRect();
                        const top=document.querySelector('.topbar').getBoundingClientRect().bottom;
                        check(Math.abs(rect.top-top)<1,module+' double top offset '+rect.top);
                        check(Math.abs(rect.top-outer.top)<1,module+' panel outside drawer');
                        check(Math.abs(rect.bottom-outer.bottom)<1,module+' panel height');
                        check(getComputedStyle(side).position!=='fixed',module+' nested fixed panel');
                        const search=document.getElementById('searchInput');
                        search.focus();check(document.activeElement===search,'search not focusable');
                        handleSidebarToggle();
                        if(innerWidth<=900){
                          check(getComputedStyle(nav).visibility==='hidden',module+' drawer not hidden');
                          check(nav.getBoundingClientRect().right<=1,module+' drawer still onscreen');
                          handleSidebarToggle();
                          check(getComputedStyle(nav).visibility==='visible',module+' drawer not reopened');
                          check(Math.abs(side.getBoundingClientRect().top-top)<1,module+' reopened offset');
                        }else check(!document.body.classList.contains('sidebar-collapsed'),'desktop drawer toggled');
                        return {module,top:rect.top};
                      });
                    }''')
                    print('PASS', engine, width, result)
                page.set_viewport_size({'width': 390, 'height': 900})
                page.screenshot(path='/private/tmp/mindex-sidebar-drawer-' + engine + '.png')
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
