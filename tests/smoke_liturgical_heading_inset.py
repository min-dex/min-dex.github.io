import os
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, local_url = start_local_app_server()
    url = os.environ.get("MINDEX_TEST_URL", local_url)
    try:
        with sync_playwright() as p:
            for engine in ("chromium", "webkit"):
                browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
                page = browser.new_page(viewport={"width": 1920, "height": 1080})
                page.route("**/*supabase*/**", lambda r: r.abort())
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_function("typeof presenterReadySlide === 'function'")
                for width in (1920, 960, 320):
                    for clean in (True, False):
                        result = page.evaluate("""({width,clean}) => {
                          const height=width*9/16;
                          const root=document.createElement('div');
                          root.className='presenter-output-root'+(clean?' no-chromakey':'');
                          root.style.cssText=`position:fixed;left:0;top:0;transform:none;background:#eee;--presenter-stage-width:${width}px;--presenter-stage-height:${height}px;--presenter-stage-unit:${width/1920}px`;
                          root.innerHTML='<div class="presenter-slide presenter-slide--liturgical-body"><div class="presenter-liturgical-body"><div class="presenter-liturgical-body-lines"><span>하늘에 계신 우리 아버지여</span><span>이름이 거룩히 여김을 받으시오며</span></div><div class="presenter-liturgical-body-heading"><span>주기도문</span></div></div></div>';
                          document.body.replaceChildren(root);
                          const box=root.getBoundingClientRect();
                          const title=root.querySelector('.presenter-liturgical-body-heading span').getBoundingClientRect();
                          const lines=[...root.querySelectorAll('.presenter-liturgical-body-lines span')].map(n=>n.getBoundingClientRect());
                          return {titleTop:(title.top-box.top)/height,
                            bodyCenter:((lines[0].top+lines.at(-1).bottom)/2-box.top)/height};
                        }""", {"width": width, "clean": clean})
                        assert abs(result["titleTop"] - .09) < .005, (engine, width, clean, result)
                        expected_center = .5 if clean else .485
                        assert abs(result["bodyCenter"] - expected_center) < .005, (engine, width, clean, result)
                        if width == 960 and clean:
                            page.screenshot(path=f"/private/tmp/mindex-liturgical-heading-{engine}.png")
                print(engine, "PASS title inset, body center, chromakey and thumbnail sizes", flush=True)
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
