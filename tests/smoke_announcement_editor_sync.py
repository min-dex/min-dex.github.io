from smoke_app import launch_chromium, start_local_app_server, sync_playwright


server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        browser = launch_chromium(p)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.route("**/*supabase*/**", lambda route: route.abort())
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_function("typeof renderPresenterServiceTextInputs === 'function'")
        value = page.evaluate("""() => {
          const service = { id: 'announcement-sync', type_id: 'sunday-main' };
          const item = {
            id: 'announcement-item', service_id: service.id, label: '광고', raw_title: '첫 줄만 남은 이전 값',
            _worshipSectionKey: 'announcements', memo: serializeServiceItemMemo({ elementType: 'plain_text', slides: [
              '오늘도 청소년부 예배에 오신 여러분을 환영하고 축복합니다 :)\\n\\n1. 말씀QT생활, 기도생활 같이 해요~\\n2. 친구들을 초청하고 전도해서 같이 예수님 믿어요~^^',
            ] }),
          };
          const memo = parseServiceItemMemo(item.memo);
          const host = document.createElement('div');
          host.innerHTML = renderPresenterServiceTextInputs(item, 0, { service }, memo);
          return host.querySelector('textarea')?.value || '';
        }""")
        assert "첫 줄만 남은 이전 값" not in value, value
        assert "말씀QT생활" in value and "친구들을 초청" in value, value
        print("PASS announcement editor reads the slide body")
        browser.close()
finally:
    server.shutdown()
