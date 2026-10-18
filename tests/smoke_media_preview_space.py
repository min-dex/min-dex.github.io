"""Collapsed attachments do not expose thumbnail strips; search count stays in list."""
import argparse
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
server,url=(None,args.url) if args.url else start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1000,'height':700})
   page.add_init_script('Element.prototype.requestFullscreen=async()=>{};Element.prototype.webkitRequestFullscreen=()=>{};window.open=()=>null')
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url,wait_until='load')
   page.wait_for_function("typeof renderPresenterReferenceMediaPreview==='function'")
   page.evaluate('''() => {
    document.body.classList.remove('ui-booting');
    const pixel='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const asset={name:'연결 이미지',url:pixel,slides:[{name:'첫 이미지',url:pixel},{name:'둘째 이미지',url:pixel}]};
    const host=document.createElement('main');host.id='preview-fixture';host.style.cssText='position:fixed;inset:0;z-index:99999;padding:20px;background:var(--panel);overflow:auto';
    host.innerHTML='<div class="svc-reference-media-input" style="width:300px">'+renderPresenterReferenceMediaPreview({},'image')+renderPresenterReferenceMediaPreview(asset,'image')+'</div>';
    document.body.append(host);
    const details=host.querySelector('details'),strip=host.querySelector('.svc-reference-media-slide-strip');
    if(details.open||strip.getBoundingClientRect().height)throw Error('Collapsed thumbnails occupy space');
    if(host.querySelector('.is-empty')||host.querySelector('.svc-reference-media-empty-hint'))throw Error('Redundant empty helper remained');
    details.open=true;
    if(strip.getBoundingClientRect().height<=0||strip.querySelectorAll('button').length!==2)throw Error('Expanded thumbnails missing');
    selectPresenterMediaPreviewSlide(strip.querySelectorAll('button')[1]);
    if(strip.querySelectorAll('button')[1].getAttribute('aria-pressed')!=='true')throw Error('Selection broken');
    details.open=false;
    if(strip.getBoundingClientRect().height)throw Error('Collapse failed');
    state.bibleTextSearchLoading=false;state.bibleTextSearchError='';state.bibleTextSearchTotal=12;state.bibleTextSearchPage=0;state.bibleTextSearchQuery='사랑';
    state.bibleTextSearchResults=[{book_code:'JHN',chapter:3,verse:16,text:'테스트 본문'}];
    const search=document.createElement('div');search.innerHTML=renderBibleTextSearchDetail();
    if([...search.querySelectorAll('header .meta-attribute-label')].some(n=>n.textContent==='결과'))throw Error('Duplicate result count');
    if(!search.querySelector('.bible-search-summary').textContent.includes('12개 중 1-1'))throw Error('Range count missing');
    state.bibleTextSearchResults=[];state.bibleTextSearchTotal=0;
    if(!renderBibleTextSearchResults().includes('검색 결과가 없습니다'))throw Error('Empty search missing');
   }''')
   page.screenshot(path='/private/tmp/mindex-media-compact-'+engine+'.png')
   print('PASS',engine,'collapsed/expanded media, image selection, search count and empty result')
   browser.close()
finally:
 if server:server.shutdown()
