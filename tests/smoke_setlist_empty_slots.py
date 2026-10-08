from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page()
                    page.route('**/*supabase*/**', lambda r: r.abort())
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_function("typeof prepareWorshipSetlistArchiveCandidates === 'function'")
                    result = page.evaluate('''() => {
                      const services=[{id:'fixture',service_date:'2026-10-07',service_type_id:'wed'}];
                      const sections=[{id:'p',service_id:'fixture',title:'찬양'}];
                      const elements=[1,2,3,4].map(n=>({id:'e'+n,section_id:'p',sort_order:n,
                        element_type:'praise',label:'찬양 '+n,title:n===1?'첫 곡':n===4?'넷째 곡':''}));
                      const before=JSON.stringify(elements);
                      const live=MindexSetlistLinks.fromServices({services,sections,elements});
                      const rows=prepareWorshipSetlistArchiveCandidates(live.candidates,live.sources[0]);
                      const labels=rows.map(r=>r.archive_display_label).join('|');
                      if(labels!=='찬양 1|찬양 4') throw Error(labels);
                      if(JSON.stringify(elements)!==before) throw Error('mutated elements');
                      return labels;
                    }''')
                    print(engine, 'PASS', result)
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
