from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ("chrome", "webkit"):
                browser = launch_chromium(p) if engine == "chrome" else p.webkit.launch()
                page = browser.new_page()
                page.route("**/*supabase*/**", lambda route: route.abort())
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_function("typeof saveCurrentListScroll === 'function'")
                result = page.evaluate("""async () => {
                  const fixture = () => {
                    refs.songList.style.cssText = 'display:block;height:120px;overflow:auto';
                    refs.songList.innerHTML = '<div style="height:1200px"></div>';
                  };
                  state.module = 'presenter';
                  state.selectedServiceId = 'scroll-fixture';
                  fixture();
                  refs.songList.scrollTop = 420;
                  saveCurrentListScroll();
                  window.dispatchEvent(new Event('pagehide'));
                  const stored = sessionStorage.getItem(STORAGE.listScroll);
                  state.listScroll = readListScrollState();
                  refs.songList.scrollTop = 0;
                  restoreCurrentListScroll();
                  await new Promise(resolve => requestAnimationFrame(resolve));
                  return {
                    stored: JSON.parse(stored || '{}')['presenter:scroll-fixture:'],
                    restored: refs.songList.scrollTop,
                    hasOtherServiceKey: Boolean(state.listScroll['presenter:other-service:']),
                  };
                }""")
                assert result == {"stored": 420, "restored": 420, "hasOtherServiceKey": False}, result
                print(engine, "PASS presenter sidebar scroll restores after refresh")
                browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
