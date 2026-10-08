// Editorial layout and editing regression using verified sample content; no production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {PDFDocument}=require('pdf-lib');
const fixture=require('./fixtures/bulletin-20260920.json');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><script src="/mindex.bulletin.js"></script>');return;}
  const file=path.resolve(root,pathname.slice(1));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  if(file.endsWith('.svg'))res.setHeader('Content-Type','image/svg+xml');
  if(file.endsWith('.js'))res.setHeader('Content-Type','application/javascript');
  res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.BULLETIN_CHROME});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1150},deviceScaleFactor:1});
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base);
  const result=await page.evaluate(async data=>{
   const B=window.MindexBulletin,source=B.resolveSource(data);
   source.autoBackground={key:'26-A5.png',url:'assets/worship-backgrounds/26-A5.png'};
   await B.readyAssets();
   const doc={source,fields:{},settings:{design:'editorial',theme:'auto',compactOrder:true},frames:B.defaultFrames('editorial'),profile:B.profileForDate(source.date)};
   window.designDoc=doc;
   const output=B.renderPages(doc,'print');
   document.body.style.cssText='margin:0;background:#e9ece8;padding:20px;display:block';
   output.pages.forEach(p=>{p.style.cssText='width:100%;height:auto;aspect-ratio:297/210;display:block;background:white;margin-bottom:20px';document.body.append(p);});
   return {issues:[...output.issues],text:output.pages.map(p=>p.textContent),stored:B.storedValue(doc)};
  },fixture);
  console.log('EDITORIAL',JSON.stringify({issues:result.issues}));
  if(process.env.BULLETIN_DESIGN_IMAGE)console.log('IMAGE:'+(await page.screenshot({type:'jpeg',quality:60,fullPage:true})).toString('base64'));
  assert.deepEqual(result.issues,[]);
  assert.equal(result.stored.layout.design,'editorial');
  const nextMarker=await page.evaluate(()=>{
   const d=structuredClone(designDoc);
   d.source.prayers=[{date:'2026-10-04',person:'김음파 청년',next:false},{date:'2026-10-11',person:'서영윤 청년',next:true},{date:'2026-10-18',person:'(연합예배)',next:false},{date:'2026-10-25',person:'이재희 청년',next:false}];
   const r=MindexBulletin.renderPages(d,'print');
   const roster=r.pages[0].querySelector('[data-frame-id="prayers"]');
   return {issues:[...r.issues],markers:[...roster.querySelectorAll('text')].filter(t=>t.textContent==='다음 주').length,text:roster.textContent};
  });
  assert.deepEqual(nextMarker.issues,[]);
  assert.equal(nextMarker.markers,1);
  assert.match(nextMarker.text,/10월 11일다음 주서영윤 청년/);

  const roundTrip=await page.evaluate(()=>{const B=window.MindexBulletin,d={};B.applyStored(d,{...B.storedValue(designDoc),revision:1});return d.frames.every((f,i)=>Object.entries(designDoc.frames[i]).every(([k,v])=>f[k]===v));});
  assert.ok(roundTrip,'New print layout must survive DB round trip');
  const invalid=await page.evaluate(()=>{const B=window.MindexBulletin,d=structuredClone(designDoc);d.fields.news='긴 문구 '.repeat(500);return [...B.renderPages(d,'print').issues];});
  assert.ok(invalid.includes('news'));
  const welcome=await page.evaluate(()=>{const B=window.MindexBulletin,d=structuredClone(designDoc);d.fields.welcome=B.profileForDate('2026-10-04').welcome;return [...B.renderPages(d,'print').issues];});
  assert.deepEqual(welcome,[],'Two-line welcome must fit the cover');
  const details=await page.evaluate(()=>{
   const B=window.MindexBulletin,d=structuredClone(designDoc);
   d.fields.outlineTitle='함께 생각할 말씀';d.fields.sermonReference='';
   d.source.scripture='본문을 비우면 나타나면 안 됨';
   d.source.outlineColumns=2;delete d.settings.outlineColumns;
   d.fields.outline='① 첫 번째 요점\n② 두 번째 요점';
   d.source.order=[{label:'봉헌찬양',content:'찬양 제목',person:'다같이'}];
   const output=B.renderPages(d,'print'),inside=output.pages[1];
   const outline=inside.querySelector('[data-frame-id="outline"]');
   const xs=[...outline.querySelectorAll('text')].filter(n=>/번째 요점/.test(n.textContent)).map(n=>n.getAttribute('x'));
   return {issues:[...output.issues],title:outline.textContent,sermon:inside.querySelector('[data-frame-id="sermon"]').textContent,order:inside.querySelector('[data-frame-id="order"]').textContent,columns:new Set(xs).size};
  });
  assert.deepEqual(details.issues,[]);
  assert.match(details.title,/함께 생각할 말씀/);
  assert.doesNotMatch(details.sermon,/본문을 비우면/);
  assert.match(details.order,/봉헌찬양/);
  assert.equal(details.columns,2,'Source outline columns remain effective');
  if(process.env.BULLETIN_DESIGN_EXPORT){
   await page.addStyleTag({content:'@page{size:297mm 210mm;margin:0}body{display:block!important;padding:0!important;margin:0!important;background:white!important}svg.bulletin-sheet{width:297mm!important;height:210mm!important;break-after:page}svg.bulletin-sheet:last-child{break-after:auto}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}'});
   const bytes=await page.pdf({preferCSSPageSize:true,printBackground:true});
   assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
   fs.mkdirSync(path.dirname(process.env.BULLETIN_DESIGN_EXPORT),{recursive:true});fs.writeFileSync(process.env.BULLETIN_DESIGN_EXPORT,bytes);
  }
  await page.evaluate(async data=>{
   document.body.replaceChildren();
   const host=document.createElement('div');document.body.append(host);
   const B=window.MindexBulletin;
   const source=B.resolveSource({...data,service:{...data.service,id:'october-design',service_date:'2026-10-04'}});
   source.autoBackground={key:'26-A5.png',url:'assets/worship-backgrounds/26-A5.png'};
   window.editorAudit={documents:new Map(),row:null};
   window.editorAudit.mount=()=>B.mount(host,{serviceId:source.id,scope:'editorial-test',documents:editorAudit.documents,services:[{id:source.id,label:'10월 주보'}],loadSource:async()=>source,loadDraft:async()=>editorAudit.row,saveDraft:async(id,value,revision)=>editorAudit.row={...structuredClone(value),revision:revision+1}});
   editorAudit.handle=editorAudit.mount();
  },fixture);
  await page.waitForFunction(()=>document.querySelector('[data-bulletin-print]')?.disabled===false).catch(async e=>{console.error(await page.locator('.bulletin-status').textContent());throw e;});
  assert.equal(await page.evaluate(()=>editorAudit.documents.get('october-design').settings.design),'editorial');
  const monthly=page.locator('details:has([data-bulletin-setting="rosterMonth"])');
  assert.equal(await monthly.getAttribute('open'),null);
  await page.locator('[data-frame-id="church"] text').first().click();
  assert.equal(await page.locator('[data-bulletin-field="church"]').evaluate(el=>document.activeElement===el),true);
  await page.locator('[data-bulletin-field="news"]').fill('새 주보 편집 내용');
  await page.locator('[data-bulletin-save]').click();
  await page.waitForFunction(()=>editorAudit.row?.revision===1);
  await page.evaluate(()=>{editorAudit.handle.destroy();editorAudit.documents.clear();localStorage.clear();editorAudit.handle=editorAudit.mount();});
  await page.waitForFunction(()=>document.querySelector('[data-bulletin-print]')?.disabled===false);
  assert.equal(await page.locator('[data-bulletin-field="news"]').inputValue(),'새 주보 편집 내용');
  assert.equal(await page.evaluate(()=>editorAudit.documents.get('october-design').settings.design),'editorial');
  console.log('PASS editorial layout, October defaults, click-to-edit, DB reload and overflow detection');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
