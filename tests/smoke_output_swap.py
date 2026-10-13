"""Keep the visible frame intact until delayed media can replace it."""

import argparse
from io import BytesIO

from PIL import Image
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--engine', choices=['chromium', 'webkit'], default='chromium')
    args = parser.parse_args()
    server, local_url = start_local_app_server() if not args.url else (None, None)
    url = args.url or local_url
    try:
        with sync_playwright() as playwright:
            browser = launch_chromium(playwright) if args.engine == 'chromium' else playwright.webkit.launch()
            page = browser.new_page(viewport={'width': 960, 'height': 540})
            page.route('**/*supabase*/**', lambda route: route.abort())
            pending = []
            page.route('**/swap-test.png', lambda route: pending.append(route))
            page.goto(url + '?output=presenter', wait_until='domcontentloaded')
            page.wait_for_function("typeof renderPresenterOutput === 'function'")
            page.wait_for_selector('#presenterOutputRoot', state='attached')
            page.evaluate("""() => {
              window.swapPayload = {serviceId:'swap', serviceType:'sunday-main', chromakey:true,
                slides:[{id:'text',type:'scripture',elementType:'scripture_text',
                  layout:'lower_bar_text',text:'첫 화면',outputContext:'chromakey'}],index:0};
              renderPresenterOutput(swapPayload);
              window.removedLayers = 0;
              new MutationObserver(records => {
                for (const record of records) for (const node of record.removedNodes)
                  if (node.classList?.contains('presenter-output-layer')) window.removedLayers++;
              }).observe(document.getElementById('presenterOutputRoot'), {childList:true});
              renderPresenterOutput({...swapPayload,slides:[{id:'image',type:'image',
                elementType:'image',layout:'media',imageSrc:new URL('swap-test.png',location.href).href,
                outputContext:'clean'}]});
            }""")
            page.wait_for_timeout(80)
            assert page.evaluate("!document.getElementById('presenterOutputRoot').classList.contains('no-chromakey')")
            before = Image.open(BytesIO(page.screenshot())).convert('RGB')
            assert before.getpixel((480, 200)) == (0, 255, 0)
            assert pending, 'The delayed image was not requested'
            data = BytesIO()
            Image.new('RGB', (1920, 1080), (20, 80, 220)).save(data, format='PNG')
            for route in pending:
                route.fulfill(body=data.getvalue(), content_type='image/png')
            page.wait_for_function("document.querySelector('.presenter-output-layer.is-active img')?.naturalWidth > 0")
            page.wait_for_function("!document.querySelector('#presenterOutputRoot').classList.contains('is-transitioning')")
            after = Image.open(BytesIO(page.screenshot())).convert('RGB')
            assert after.getpixel((480, 200)) == (20, 80, 220)
            for index in range(6):
                page.evaluate("""index => renderPresenterOutput({...swapPayload,
                  slides:[{...swapPayload.slides[0],id:`text-${index}`,text:`말씀 ${index}`} ]})""", index)
                screenshot = Image.open(BytesIO(page.screenshot())).convert('RGB')
                assert screenshot.getpixel((480, 200)) == (0, 255, 0)
            assert page.evaluate('window.removedLayers') == 0
            print('PASS delayed media preserves old frame; six text swaps retain attached layers')
            backgrounds = []
            page.route('**/slow-background.png', lambda route: backgrounds.append(route))
            page.evaluate("""() => {
              window.backgroundPayload = {...swapPayload,backgroundImages:[new URL('slow-background.png',location.href).href],
                slides:[{id:'special-song',type:'song-title',elementType:'title_assignee',
                  layout:'center_text',title:'말씀 앞에서',text:'찬양팀',outputContext:'clean'}]};
              renderPresenterOutput(backgroundPayload);
            }""")
            page.wait_for_timeout(1000)
            assert backgrounds, 'Background preload was not requested'
            held = Image.open(BytesIO(page.screenshot())).convert('RGB')
            assert held.getpixel((480, 200)) == (0, 255, 0), 'Slow background exposed a blank/black output'
            for route in backgrounds:
                route.fulfill(body=data.getvalue(), content_type='image/png')
            page.wait_for_function("document.getElementById('presenterOutputRoot').classList.contains('has-background')")
            page.wait_for_function("!document.getElementById('presenterOutputRoot').classList.contains('is-transitioning')")
            assert page.evaluate("""() => {
              const root=document.getElementById('presenterOutputRoot');
              const source=backgroundPayload.backgroundImages[0];
              return root.querySelector('.presenter-output-background img') === presenterOutputImagePreloadCache.get(source).image
                && getComputedStyle(root).backgroundImage === 'none';
            }"""), 'Output must reuse the decoded bitmap instead of starting a CSS image load'
            painted = Image.open(BytesIO(page.screenshot())).convert('RGB')
            assert painted.getpixel((100, 100)) == (20, 80, 220), 'Background was not ready on transition'
            # A late background load must never override an explicit blackout.
            stale = []
            page.route('**/stale-background.png', lambda route: stale.append(route))
            page.evaluate("""() => {
              renderPresenterOutput({...backgroundPayload,backgroundImages:[new URL('stale-background.png',location.href).href]});
            }""")
            page.wait_for_timeout(100)
            page.evaluate("renderPresenterOutput({...backgroundPayload,safetyBlank:true})")
            for route in stale:
                route.fulfill(body=data.getvalue(), content_type='image/png')
            page.wait_for_timeout(350)
            assert page.evaluate("document.getElementById('presenterOutputRoot').classList.contains('is-blackout')")
            print('PASS delayed service background preserves output and cannot override blackout')
            browser.close()
    finally:
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
