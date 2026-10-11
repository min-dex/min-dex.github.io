const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,pathname==='/'?'index.html':pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,...(fs.existsSync(webkit.executablePath())?[webkit]:[])]){const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.BULLETIN_CHROME}:{})});try{const page=await browser.newPage({viewport:{width:1440,height:900}});await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base);await page.waitForFunction(()=>typeof renderPresenterHighlightedText==='function'&&typeof state!=='undefined');
await page.evaluate(async()=>{
 await document.fonts.ready;
 const text='오늘도 **청년부 예배**에 오신 여러분을 **환영**하고 **축복**합니다 :)\n\n1. 오늘 2부 활동은 **셀 모임**으로 진행합니다.\n2. 청년부 **여름 수련회** 안내입니다.\n일시: 8월 2일(주일)–5일(수)\n장소: 충남 태안 안흥교회\n\n◇ 청년부 **기도 모임**(매주 토요일 오후 3시)에 참여 바랍니다.\n◇ 검단우리교회는 신천지 추수꾼 및 각종 이단의 출입을 금합니다.';
 window.zoneText=text;
 window.zoneSlide={type:'liturgical-body',title:'광고',announcementItems:presenterAnnouncementItems(text)};
 document.body.innerHTML='<div id="zone-stage" class="presenter-output-root no-chromakey" style="position:relative;width:1600px;height:900px;background:#132335"><div class="presenter-slide presenter-slide--liturgical-body">'+renderPresenterSlideBody(zoneSlide)+'</div></div>';
 fitPresenterSongTitleText(document);
});
await page.setViewportSize({width:1600,height:900});
await page.evaluate(()=>document.fonts.ready);
for(const size of [[1600,900],[640,360]]){
 const result=await page.evaluate(([w,h])=>{
  const stage=document.querySelector('#zone-stage');stage.style.width=w+'px';stage.style.height=h+'px';fitPresenterSongTitleText(document);
  const boxes=[...document.querySelectorAll('.presenter-announcement-region')];
  const r=boxes.map(b=>{const rect=b.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,fit:b.scrollHeight<=b.clientHeight+1&&b.scrollWidth<=b.clientWidth+1,text:b.textContent}});
  return {r,bold:document.querySelectorAll('.presenter-announcement-region strong').length,source:zoneSlide.announcementItems};
 },size);
 assert.ok(result.r.every(r=>r.fit),JSON.stringify(result));
 assert.ok(result.r[0].bottom<result.r[1].top&&result.r[1].bottom<result.r[2].top);
 assert.match(result.r[0].text,/환영/);assert.doesNotMatch(result.r[1].text,/환영|기도 모임/);assert.match(result.r[2].text,/기도 모임/);
 assert.equal(result.bold,6);
}
await page.evaluate(()=>{const s=document.querySelector('#zone-stage');s.style.width='1600px';s.style.height='900px';fitPresenterSongTitleText(document);});
if(process.env.ANNOUNCEMENT_ZONES_IMAGE)await page.locator('#zone-stage').screenshot({path:process.env.ANNOUNCEMENT_ZONES_IMAGE});
await page.evaluate(()=>{
 const before=JSON.stringify(zoneSlide);
 const regions=presenterAnnouncementRegions(zoneSlide.announcementItems);
 if(JSON.stringify(zoneSlide)!==before)throw Error('source mutated');
 if(!renderPresenterLiturgicalBodySlide({title:'광고',announcementItems:presenterAnnouncementItems('1. 일반 광고')}).includes('presenter-announcement-items'))throw Error('legacy fallback lost');
 const changed=presenterAnnouncementRegions(presenterAnnouncementItems('오늘도 청소년부 예배에 오신 여러분을 환영합니다.\n1. 새 소식\n◇ 내용이 달라진 하단 안내'));
 if(changed.footer[0].lines[0]!=='내용이 달라진 하단 안내')throw Error('footer depends on fixed wording');
 const stage=document.querySelector('#zone-stage');
 const anchor=stage.querySelector('.presenter-announcement-region--footer').getBoundingClientRect().bottom;
 zoneSlide.announcementItems=presenterAnnouncementItems(zoneText.replace('안내입니다.',('아주 긴 행사 안내 '.repeat(50))));
 stage.querySelector('.presenter-slide').innerHTML=renderPresenterSlideBody(zoneSlide);fitPresenterSongTitleText(document);
 if(Math.abs(anchor-stage.querySelector('.presenter-announcement-region--footer').getBoundingClientRect().bottom)>1)throw Error('footer moved with news');
 const numbered=presenterAnnouncementRegions(presenterAnnouncementItems('오늘도 청년부 예배에 오신 여러분을 환영합니다.\n**1. 굵은 소식**\n◇ 새 하단 문구'));
 if(numbered.news[0]?.marker!=='①'||numbered.news[0]?.lines[0]!=='**굵은 소식**')throw Error('bold numbering lost');
 for(const box of stage.querySelectorAll('.presenter-announcement-region'))if(box.scrollHeight>box.clientHeight+1||box.scrollWidth>box.clientWidth+1)throw Error('long region overflow');
});
console.log('PASS anchored welcome/news/footer, changed footer copy, thumbnails, dense text, bold and source preservation');
if(process.env.INLINE_BOLD_SCREENSHOT)await page.screenshot({path:process.env.INLINE_BOLD_SCREENSHOT,fullPage:false});
}finally{await browser.close();}}}finally{server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
