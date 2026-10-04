from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as playwright:
            browser = launch_chromium(playwright)
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof renderPresenterAssetUpload === 'function' && typeof presenterElementSlideFromMemo === 'function'")
            result = page.evaluate(
                """() => {
                  const memo = parseServiceItemMemo(serializeServiceItemMemo({
                    elementType: 'image', inputMode: 'asset',
                    asset: {
                      kind: 'image', name: '광고 묶음', url: 'https://example.com/one.png',
                      slides: [
                        { url: 'https://example.com/one.png', name: '첫 장', order: 1 },
                        { url: 'https://example.com/two.png', name: '둘째 장', order: 2 },
                      ],
                    },
                  }));
                  const item = {
                    id: '__smoke_image_batch__', label: '광고 이미지', memo: serializeServiceItemMemo(memo),
                    _worshipSectionKey: 'announcements', _worshipSectionTitle: '광고',
                  };
                  const holder = document.createElement('div');
                  holder.innerHTML = renderPresenterAssetUpload(item, 0, memo, '__smoke_service__');
                  const input = holder.querySelector('input[type="file"]');
                  const slides = presenterElementSlideFromMemo(item, {
                    sectionKey: 'announcements', sectionLabel: '광고', sectionTitle: '광고', sectionName: '광고',
                  }, 0, memo, '광고 이미지', { id: '__smoke_service__' });
                  return {
                    multiple: Boolean(input?.multiple),
                    accept: input?.getAttribute('accept') || '',
                    slideCount: Array.isArray(slides) ? slides.length : 0,
                    imageSources: Array.isArray(slides) ? slides.map(slide => slide.imageSrc) : [],
                  };
                }"""
            )
            assert result == {
                "multiple": True,
                "accept": "image/*",
                "slideCount": 2,
                "imageSources": ["https://example.com/one.png", "https://example.com/two.png"],
            }, result
            browser.close()
            print("PASS image asset batch upload and rendering", flush=True)
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
