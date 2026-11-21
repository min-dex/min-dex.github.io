"""Full HD composition without a desktop bridge, devices or external services."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
import smoke_app
from pathlib import Path
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    if os.environ.get('MINDEX_BROADCAST_TEST_ROOT'):
        smoke_app.APP_DIR = Path(os.environ['MINDEX_BROADCAST_TEST_ROOT'])
    server, url = start_local_app_server()
    url = url.rsplit("/", 1)[0]
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page(viewport={'width': 1320, 'height': 1000})
                    page.add_init_script("""(() => {
                        window.captionTrace=[];
                        for(const name of ['fillRect','fillText']){
                            const original=CanvasRenderingContext2D.prototype[name];
                            CanvasRenderingContext2D.prototype[name]=function(...args){
                                if(!this.canvas.isConnected){
                                    captionTrace.push({name,args,size:[this.canvas.width,this.canvas.height],transform:[this.getTransform().a,this.getTransform().d],font:this.font,fill:this.fillStyle});
                                    if(captionTrace.length>20)captionTrace.shift();
                                }
                                return original.apply(this,args);
                            };
                        }
                    })();""")
                    page.set_default_timeout(15000)
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url.rstrip('/')) else route.abort())
                    page.goto(url.rstrip('/') + '/tools/broadcast-prototype/index.html')
                    page.wait_for_function('window.broadcastPrototype')
                    assert page.evaluate('typeof window.youtubeOutput') == 'undefined'
                    assert page.locator('#broadcast').evaluate('(c)=>[c.width,c.height]') == [1920, 1080]
                    page.get_by_text('수동 자막 및 화면 설정', exact=True).click()
                    page.locator('#text').fill('1080p browser caption')
                    page.locator('#apply').click()
                    try:
                        page.wait_for_function('''() => {
                        const c=document.querySelector('#broadcast');
                        const d=c.getContext('2d').getImageData(0,850,1920,230).data;
                        for(let i=0;i<d.length;i+=4)if(d[i]>220&&d[i+1]>220&&d[i+2]>220)return true;
                        return false;
                    }''')
                    except Exception:
                        print('BROADCAST_ERRORS', errors, flush=True)
                        print('BROADCAST_DIAGNOSTIC', engine, page.evaluate("""() => {
                            const c=document.querySelector('#broadcast'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
                            let count=0,minY=c.height,maxY=-1;
                            for(let i=0;i<d.length;i+=4)if(d[i]>220&&d[i+1]>220&&d[i+2]>220){count++;const y=Math.floor(i/4/c.width);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
                            return {trace:window.captionTrace,count,minY,maxY,stats:broadcastPrototype.stats(),transition:broadcastPrototype.transition(),routing:broadcastPrototype.routing(),fonts:document.fonts.status,faces:[...document.fonts].filter(f=>f.family.includes('Presenter')).map(f=>[f.family,f.weight,f.status]),rect:c.getBoundingClientRect().toJSON(),text:document.querySelector('#text').value};
                        }"""), flush=True)
                        raise
                    assert page.locator('#ytStart').is_disabled()
                    assert not errors, errors
                    print(f'PASS {engine}: browser 1080p canvas, scaled caption, no desktop bridge')
                finally:
                    browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
