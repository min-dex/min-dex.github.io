const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,pathname==='/'?'index.html':pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,...(fs.existsSync(webkit.executablePath())?[webkit]:[])]){const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.BULLETIN_CHROME}:{})});try{const page=await browser.newPage({viewport:{width:1440,height:900}});await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base);await page.waitForFunction(()=>typeof renderPresenterHighlightedText==='function'&&typeof state!=='undefined');
await page.evaluate(()=>{
 const item={id:'ui-ad',label:'광고',raw_title:'오늘도 **청소년부 예배**에 오신 여러분을 **환영**하고 **축복**합니다 :)\n1. 첫 번째 소식\n2. 두 번째 소식\n◇ 정기 안내',_worshipSectionKey:'announcements',memo:serializeServiceItemMemo({elementType:'body',inputMode:'text'})};
 document.body.innerHTML='<main style="padding:20px"><div class="svc-board-subgroup-controls"><div class="svc-board-subgroup-control-item">'+renderServiceAnnouncementEditor(item,0,'ui',parseServiceItemMemo(item.memo))+'</div></div></main>';
});
for(const width of [1100,390]){
 await page.setViewportSize({width,height:900});
 for(const open of [false,true]){
 const result=await page.evaluate(open=>{
 const editor=document.querySelector('.svc-announcement-editor');editor.querySelector('details').open=open;
 const field=editor.querySelector('label'),label=field.querySelector('span').getBoundingClientRect(),input=field.querySelector('textarea').getBoundingClientRect(),summary=editor.querySelector('summary').getBoundingClientRect();
 return {labelBottom:label.bottom,inputTop:input.top,gap:summary.top-input.bottom,overflow:document.documentElement.scrollWidth-innerWidth,fieldHeight:field.getBoundingClientRect().height,inputHeight:input.height};
 },open);
 assert.ok(result.inputTop>=result.labelBottom,JSON.stringify(result));
 assert.ok(result.gap>=0&&result.gap<=20,JSON.stringify(result));
 assert.ok(result.fieldHeight-result.inputHeight<40,JSON.stringify(result));
 assert.ok(result.overflow<=1,JSON.stringify(result));
 }
}
await page.setViewportSize({width:1100,height:900});
if(process.env.ANNOUNCEMENT_EDITOR_IMAGE)await page.screenshot({path:process.env.ANNOUNCEMENT_EDITOR_IMAGE});
console.log('PASS announcement labels above inputs, no inherited flex gap, collapsed/open and narrow layout');
if(process.env.INLINE_BOLD_SCREENSHOT)await page.screenshot({path:process.env.INLINE_BOLD_SCREENSHOT,fullPage:false});
}finally{await browser.close();}}}finally{server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
