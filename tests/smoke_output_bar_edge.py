"""Inspect all output edges via the real renderer, with production APIs blocked."""
from io import BytesIO
from math import ceil, floor
import os
from urllib.parse import urlsplit
from PIL import Image
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
    remote=os.environ.get('MINDEX_EDGE_URL')
    server,url=(None,remote) if remote else start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                try:
                    for width,height,dpr in [(1710,1034,2),(3420,2070,1),(1710,1035,2),(1952,1179,1),(1365,900,1.25),(1920,1080,1),(1280,720,1),(1200,600,1)]:
                        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=dpr)
                        page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
                        page.goto(url+'?output=presenter')
                        page.wait_for_function("typeof renderPresenterOutput==='function' && !!document.getElementById('presenterOutputRoot')")
                        for kind in ('title-assignee','lyrics','song-title','scripture','blank'):
                            page.evaluate('''kind=>{
                              const elementType=kind==='title-assignee'?'title_assignee':kind==='scripture'?'scripture_text':kind==='blank'?'blank':'praise';
                              const slide={elementType,layout:kind==='blank'?'blank':'lower_bar_text',id:'edge-'+kind,type:kind,title:'찬양',text:'테힐라 찬양단',assignee:'테힐라 찬양단'};
                              renderPresenterOutput({serviceId:'edge-fixture',serviceType:'sunday-main',chromakey:true,index:0,slides:[slide]});
                            }''',kind)
                            page.wait_for_function("k=>!!document.querySelector('#presenterOutputRoot > .presenter-output-layer.is-active > .presenter-slide--'+k)",arg=kind)
                            page.wait_for_timeout(180)
                            rect=page.evaluate('''kind=>{
                              const root=document.getElementById('presenterOutputRoot');
                              const gradient=getComputedStyle(root).backgroundImage.includes('linear-gradient');
                              if(gradient !== (kind!=='blank'))throw Error('incorrect backing for '+kind);
                              const r=root.getBoundingClientRect();return {bottom:r.bottom,top:r.top,left:r.left,right:r.right,height:r.height};
                            }''',kind)
                            im=Image.open(BytesIO(page.screenshot())).convert('RGB')
                            l,r=ceil(rect['left']*dpr),floor(rect['right']*dpr)
                            t,b=ceil(rect['top']*dpr),floor(rect['bottom']*dpr)
                            # Scan full edge strips, including corners. Upper green is intentional.
                            points=[]
                            if kind!='blank':
                                points.extend((x,y) for y in range(b-3,min(im.height,b+1)) for x in range(max(0,l),min(im.width,r)))
                                points.extend((x,y) for x in [max(0,l),min(im.width-1,r-1)] for y in range(ceil((rect['bottom']-rect['height']*.15)*dpr),b))
                            # Letterbox outside all four stage bounds must stay black.
                            for x in [l-2,r+2]:
                                if 0<=x<im.width: points.extend((x,y) for y in range(im.height))
                            for y in [t-2,b+2]:
                                if 0<=y<im.height: points.extend((x,y) for x in range(im.width))
                            bad=[(x,y,im.getpixel((x,y))) for x,y in points if (lambda c:c[1]>c[2]+5)(im.getpixel((x,y)))]
                            assert not bad,(engine,width,height,dpr,kind,bad[:3])
                            # Top and upper side edges remain the intended solid chromakey.
                            for x,y in [(l+3,t+3),(r-4,t+3),(l+3,(t+b)//2),(r-4,(t+b)//2)]:
                                c=im.getpixel((x,y));assert c[1]>240 and c[0]<10 and c[2]<10,(kind,c)
                        page.close()
                    print(engine,'PASS actual output: top/bottom/left/right, 8 viewport/DPR cases, 4 caption layouts + blank transition',flush=True)
                finally:browser.close()
    finally:
        if server:server.shutdown();server.server_close()
if __name__=='__main__':main()
