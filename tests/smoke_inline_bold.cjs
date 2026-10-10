const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,pathname==='/'?'index.html':pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,...(fs.existsSync(webkit.executablePath())?[webkit]:[])]){const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.BULLETIN_CHROME}:{})});try{const page=await browser.newPage({viewport:{width:1440,height:900}});await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base);await page.waitForFunction(()=>typeof renderPresenterHighlightedText==='function'&&typeof state!=='undefined');
const oldTests=fs.readFileSync(path.join(__dirname,'smoke_announcement_parentheses.py'),'utf8').match(/page.evaluate\('''([\s\S]*?)'''\)/)[1];
console.log(engine.name(),await page.evaluate(`(${oldTests})()`));
await page.evaluate(()=>{const service={id:'inline-test',type_id:'young-adult'};const item={id:'inline-ad',label:'광고',raw_title:'온세대 월삭예배',_worshipSectionKey:'announcements',memo:serializeServiceItemMemo({elementType:'body',inputMode:'text'})};state.module='presenter';state.selectedServiceId=service.id;state.services=[service];state.serviceItems={[service.id]:[item]};const host=document.createElement('div');host.id='inline-test';host.innerHTML=renderPresenterServiceTextInputs(item,getServiceItems(service.id).findIndex(row=>row.id===item.id),{service},parseServiceItemMemo(item.memo));document.body.prepend(host);host.querySelector('textarea').value='온세대 월삭예배';host.addEventListener('input',()=>window.inlineInputEvents=(window.inlineInputEvents||0)+1);});
assert.equal(await page.locator('#inline-test [data-inline-bold-button]').count(),0);
const input=page.locator('#inline-test textarea');await input.evaluate(el=>el.setSelectionRange(0,el.value.length));await input.press('Meta+b');assert.equal(await input.inputValue(),'**온세대 월삭예배**');await input.press('Control+b');assert.equal(await input.inputValue(),'온세대 월삭예배');assert.equal(await page.evaluate(()=>inlineInputEvents),2);
console.log('PASS announcement keyboard toggle and existing input events');
await input.fill('첫째 안내\n\n둘째 안내');await input.selectText();await input.press('Control+b');
assert.equal(await input.inputValue(),'**첫째 안내**\n\n**둘째 안내**');
await input.press('Control+b');assert.equal(await input.inputValue(),'첫째 안내\n\n둘째 안내','multiline toggle must remove every marker pair');
await input.fill('새 안내');await input.selectText();
await input.evaluate(el=>{window.boldBlurCount=0;el.addEventListener('blur',()=>window.boldBlurCount++);});
await input.press('Control+b');
assert.equal(await input.inputValue(),'**새 안내**');assert.equal(await page.evaluate(()=>boldBlurCount),0,'bold shortcut must preserve editing focus');
console.log('PASS multiline toggle and shortcut preserves editing focus');
await page.evaluate(()=>{
 const field=document.querySelector('#inline-test textarea');field.dataset.initialValue='새 안내';
 if(!commitDeferredServiceTextInput(field,{save:false}))throw Error('edit not committed');
 const item=getServiceItems('inline-test').find(row=>row.id==='inline-ad');
 if(item.raw_title!=='**새 안내**')throw Error('bold markers lost in service model');
 const restored=JSON.parse(JSON.stringify(item));
 const slide=buildPresenterSlidesForServiceItem(restored,state.services[0],0).find(s=>s.announcementItems?.length);
 if(!slide||!renderPresenterSlideBody(slide).includes('<strong>새 안내</strong>'))throw Error('bold missing from rebuilt output '+JSON.stringify({restored,slide,html:slide&&renderPresenterSlideBody(slide)}));
});
console.log('PASS committed announcement model and rebuilt output preserve bold');


if(process.env.INLINE_BOLD_SCREENSHOT)await page.screenshot({path:process.env.INLINE_BOLD_SCREENSHOT,fullPage:false});
}finally{await browser.close();}}}finally{server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
