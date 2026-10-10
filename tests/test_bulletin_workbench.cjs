// Offline UI coverage; all drafts remain in memory.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(route==='/'){res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles.bulletin.css"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin.js"></script><main id="host" style="height:calc(100dvh - 40px);margin:20px"></main>');return;}
 const file=path.resolve(root,route.slice(1));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BULLETIN_CHROME});
 try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.goto(base);
 await page.evaluate(()=>{
 document.body.style.display='block';
 const B=MindexBulletin,source=B.resolveSource({service:{id:'children-ui',service_type_id:'children',service_date:'2026-10-04'},sections:[{id:'s',section_key:'sermon',title:'설교',sort_order:1}],elements:[{id:'e',section_id:'s',element_type:'title_person',title:'교회에서도 사회에서도',person:'박소영 전도사님'}]});
 source.autoBackground={key:'26-C5.png',url:'assets/worship-backgrounds/26-C5.png'};
 window.saved=null;B.mount(document.getElementById('host'),{serviceId:source.id,scope:'ui-offline',services:[{id:source.id,label:'10월 4일 · 어린이부 주보'}],loadSource:async()=>source,loadDraft:async()=>saved,saveDraft:async(id,value,revision)=>{await new Promise(resolve=>window.finishSave=resolve);return saved={...value,revision:revision+1};}});
 });
 await page.waitForFunction(()=>document.querySelector('[data-bulletin-print]')?.disabled===false,{},{timeout:5000}).catch(async e=>{console.error(await page.locator('.bulletin-status').textContent(),errors);throw e;});
 assert.equal(await page.locator('[data-bulletin-local]').isVisible(),false,'Hidden recovery control must stay hidden');
 assert.equal(await page.locator('[data-bulletin-field="memoryReference"]').evaluate(el=>el.tagName),'INPUT');
 const news=page.locator('[data-bulletin-field="news"]');
 await news.fill('온세대 월삭예배');
 await news.evaluate(el=>el.setSelectionRange(0,el.value.length));
 await news.press('Meta+b');
 assert.equal(await news.inputValue(),'**온세대 월삭예배**');
 assert.equal(await page.locator('[data-frame-id="news"] tspan[font-weight="700"]').textContent(),'온세대 월삭예배');
 await news.locator('..').locator('[data-inline-bold-button]').click();
 assert.equal(await news.inputValue(),'온세대 월삭예배');
 await news.fill('편집 중인 소식');
 for(const width of [1200,760,380]){
 await page.setViewportSize({width,height:900});
 const bounds=await page.evaluate(()=>{const w=document.querySelector('.bulletin-workbench'),c=document.querySelector('.bulletin-canvas');return {overflow:w.scrollWidth-w.clientWidth,canvas:c.clientWidth,head:document.querySelector('.bulletin-preview-head').getBoundingClientRect().height};});
 assert(bounds.overflow<=1,JSON.stringify({width,...bounds}));assert(bounds.canvas>150);
 for(const selector of ['[data-bulletin-save]','[data-bulletin-print]','[data-bulletin-page="1"]']){const b=await page.locator(selector).boundingBox();assert(b.x>=0&&b.x+b.width<=width,selector+' outside viewport');}
 await page.locator('[data-bulletin-page="1"]').click();
 assert(await page.locator('.bulletin-canvas').evaluate(el=>el.scrollHeight<=el.clientHeight+1||el.scrollTop>0));
 await page.locator('[data-bulletin-page="0"]').click();
 assert(await page.locator('.bulletin-canvas').evaluate(el=>el.scrollTop)<5);
 assert.equal(await page.locator('[data-bulletin-field="news"]').inputValue(),'편집 중인 소식');
 }
 await page.setViewportSize({width:1200,height:900});
 await page.locator('#host').evaluate(el=>el.style.width='550px');
 assert.equal(await page.locator('.bulletin-body').evaluate(el=>getComputedStyle(el).flexDirection),'column');
 await page.locator('#host').evaluate(el=>el.style.width='');
 await page.locator('[data-bulletin-save]').click();
 await page.waitForFunction(()=>typeof finishSave==='function');
 assert.equal(await page.locator('[data-bulletin-save]').getAttribute('aria-busy'),'true');
 assert.match(await page.locator('[data-bulletin-save]').textContent(),/저장 중/);
 await page.evaluate(()=>finishSave());await page.waitForFunction(()=>saved?.revision===1);
 await page.waitForFunction(()=>document.querySelector('[data-bulletin-save]').getAttribute('aria-busy')==='false');
 await page.locator('[data-bulletin-page="1"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-bulletin-page="1"]').getAttribute('aria-current')==='page');
 await page.locator('.bulletin-canvas').evaluate(el=>el.scrollTop=0);
 await page.waitForFunction(()=>document.querySelector('[data-bulletin-page="0"]').getAttribute('aria-current')==='page');
 // Clearing numeric/date controls must not silently move content or mislabel its month.
 await page.locator('[data-bulletin-mode="layout"]').click();
 const x=page.locator('[data-bulletin-dimension="x"]');
 const originalX=await x.inputValue();
 await page.locator('[data-bulletin-page="0"]').press('ArrowRight');
 assert.equal(await x.inputValue(),originalX,'Arrow keys on toolbar controls must not move a print frame');
 assert.equal(await page.locator('[data-bulletin-save]').isDisabled(),true);
 await x.fill('');await x.press('Tab');
 assert.equal(await x.inputValue(),originalX,'An empty coordinate restores the previous position');
 assert.equal(await page.locator('[data-bulletin-save]').isDisabled(),true,'Rejected input must not dirty the saved bulletin');
 await page.locator('[data-bulletin-mode="content"]').click();
 const month=page.locator('[data-bulletin-setting="eventsMonth"]');
 const originalMonth=await month.inputValue();
 await month.evaluate(el=>{el.value='';el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await month.inputValue(),originalMonth,'The month control must match the displayed schedule after a rejected edit');
 assert.equal(await page.locator('[data-bulletin-save]').isDisabled(),true);
 await page.locator('[data-bulletin-mode="layout"]').click();
 await page.locator('[data-bulletin-frame]').selectOption('leader');
 await page.waitForFunction(()=>document.querySelector('[data-bulletin-page="1"]').getAttribute('aria-current')==='page');
 const leaderX=Number(await x.inputValue());
 await page.locator('.bulletin-canvas').press('ArrowLeft');
 assert.equal(Number(await x.inputValue()),leaderX-2.5,'Canvas arrow keys still move the selected frame');
 assert.deepEqual(errors,[]);
 if(process.env.BULLETIN_UI_IMAGE)console.log('IMAGE:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 console.log('PASS responsive workbench, container resize, face navigation, draft preservation and save');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
