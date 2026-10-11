from io import BytesIO
from PIL import Image
import smoke_app
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    smoke_app.extract_supa_config = lambda: ('', '')
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page(viewport={'width': 960, 'height': 540})
                    page.route('**/*supabase*/**', lambda r: r.abort())
                    page.goto(url+'?output=presenter', wait_until='domcontentloaded')
                    page.wait_for_function("typeof renderPresenterOutput==='function' && typeof state!=='undefined'")
                    for chromakey in [True, False]:
                        page.evaluate('''chromakey => {
                            window.testPayload={serviceId:'fixture',serviceType:'youth',chromakey,
                                backgroundImages:['data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="9"%3E%3Cpath fill="red" d="M0 0h16v9H0z"/%3E%3C/svg%3E'],
                                slides:[{id:'normal',type:'component',elementType:'plain_text',layout:'center_text',text:'정상 화면'},
                                {id:'ordinary-blank',type:'blank',elementType:'blank',layout:'blank'}],index:0};
                            renderPresenterOutput(testPayload);
                            testPayload=applyPresenterActionToPayload(testPayload,'jump',{index:-1});
                            if(!testPayload.safetyBlank||testPayload.index!==0)throw Error('zero navigation');
                            renderPresenterOutput(testPayload);
                            const root=document.getElementById('presenterOutputRoot');
                            if(!root.classList.contains('is-blackout')||root.classList.contains('has-background')||root.classList.contains('is-blank'))throw Error('blackout frame state');
                            if(root.classList.contains('is-transitioning'))throw Error('blackout must be immediate');
                        }''', chromakey)
                        image=Image.open(BytesIO(page.locator('#presenterOutputRoot').screenshot())).convert('RGB')
                        assert set(image.getdata()) == {(0,0,0)}, (engine,chromakey,'non-black pixels')
                        page.evaluate('''() => {
                            testPayload=applyPresenterActionToPayload(testPayload,'first');renderPresenterOutput(testPayload);
                            if(document.getElementById('presenterOutputRoot').classList.contains('is-blackout'))throw Error('blackout stuck');
                            const blank=presenterOutputFrameStateForSlide(testPayload.slides[1],testPayload);
                            if(blank.blackoutOutput||blank.showBackground===testPayload.chromakey)throw Error('ordinary blank changed');
                            testPayload=applyPresenterActionToPayload(testPayload,'jump',{index:-1});
                            testPayload=applyPresenterActionToPayload(testPayload,'next');
                            if(testPayload.safetyBlank||testPayload.index!==1)throw Error('next after zero');
                        }''')
                    print('PASS',engine,'zero is pure black, immediate, restores navigation, preserves ordinary blanks')
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
