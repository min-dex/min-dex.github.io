// Editorial layout and editing regression using verified sample content; no production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {PDFDocument}=require('pdf-lib');

const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><script src="/mindex.bulletin.js"></script>');return;}
  const file=path.resolve(root,pathname.slice(1));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  if(file.endsWith('.svg'))res.setHeader('Content-Type','image/svg+xml');
  res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BULLETIN_CHROME});
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
 const page=await browser.newPage({viewport:{width:1200,height:1800}});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base);
 const result=await page.evaluate(async()=>{
 const B=MindexBulletin;
 const data={service:{id:'children-october',service_date:'2026-10-04',service_type_id:'children',worship_leader:'서영윤 선생님 / 박소영 전도사님'},sections:[],elements:[],calendar:[{date:'2026-10-04',children_prayer:'김예담 어린이',young_adult_prayer:'청년 기도자',liturgical:'오순절 후 열아홉 번째 주일 / 군선교주일',church_schedule:'행사 일정'}]};
 const rows=[['creed','사도신경','','다같이'],['praise','찬양','예수 이름이 온 땅에\n내 안에 부어 주소서\n마라나타\n나를 만나주세요','다같이'],['call','예배의 부름','','인도자'],['scripture_reading','성경봉독','베드로전서 2:11–17','다같이'],['sermon','설교','교회에서도 사회에서도','박소영 전도사님'],['decision','기도','','박소영 전도사님'],['offering','봉헌','문들아 머리 들어라','다같이'],['offering_prayer','봉헌기도','','김예담 어린이'],['send','나래파송','공동체고백','다같이'],['lords','주기도문','','다같이'],['announcements','광고','','인도자']];
 rows.forEach(([key,title,content,person],i)=>{data.sections.push({id:key,section_key:key,title,sort_order:i});data.elements.push({id:'e'+i,section_id:key,element_type:'title_person',title:content,person,sort_order:i,source_ref:{label:title}});});
 const source=B.resolveSource(data);source.autoBackground={key:'26-C5.png',url:'assets/worship-backgrounds/26-C5.png'};
 window.childData=data;window.childSource=source;await B.readyAssets();
 const doc={source,fields:{news:"① 오늘 2부 활동은 '사도신경·주기도문 쓰기 대회'로 진행합니다."},settings:{design:'children',theme:'auto'},frames:B.defaultFrames('children'),inherited:{common:{},months:{}}};
 const rendered=B.renderPages(doc,'print');window.childDoc=doc;
 document.body.style.cssText='margin:0;background:#ddd';rendered.pages.forEach(svg=>{svg.style.cssText='width:1200px;height:auto;display:block';document.body.append(svg);});
 const restored={};B.applyStored(restored,{...B.storedValue(doc),revision:1});
 const two=B.resolveSource({...data,service:{...data.service,service_date:'2026-09-13'},services:[{date:'2026-09-20',noGathering:true}]});
 const future=B.resolveSource({...data,service:{...data.service,service_date:'2026-11-01'},history:[{date:'2026-10-04',content:{fields:{monthlyTheme:'10월 수정',memoryVerse:'지난주 말씀'}}}]});
 const twoDoc={...doc,source:two};const twoIssues=[...B.renderPages(twoDoc,'print').issues];
 return {twoIssues,issues:[...rendered.issues],text:rendered.pages.map(p=>p.textContent).join(' '),prayers:source.prayers,reading:source.readingPlan,restored:restored.settings.design,two:two.readingPlan,future:{theme:future.monthlyTheme,verse:future.memoryVerse}};
 });
 assert.deepEqual(result.issues,[]);assert.deepEqual(result.twoIssues,[]);assert.doesNotMatch(result.text,/RIA|청년부|이재희|김석범/);assert.match(result.text,/새길 말씀/);assert.equal(result.restored,'children');assert.equal(result.prayers[0].person,'김예담 어린이');assert.equal(result.reading.split('\n').length,7);assert.match(result.reading,/잠언 16장/);assert.equal(result.two.split('\n').length,14);assert.match(result.two,/잠언 1장/);assert.deepEqual(result.future,{theme:'',verse:''});
 if(process.env.BULLETIN_DESIGN_IMAGE)console.log('IMAGE:'+(await page.screenshot({type:'jpeg',quality:65,fullPage:true})).toString('base64'));
 await page.evaluate(()=>{document.body.replaceChildren();const host=document.createElement('div');document.body.append(host);window.audit={documents:new Map(),row:null};audit.mount=()=>MindexBulletin.mount(host,{serviceId:childSource.id,scope:'children-test',documents:audit.documents,services:[{id:childSource.id,label:'어린이부 주보'}],loadSource:async()=>childSource,loadDraft:async()=>audit.row,saveDraft:async(id,v,r)=>audit.row={...structuredClone(v),revision:r+1}});audit.handle=audit.mount();});
 await page.waitForFunction(()=>document.querySelector('[data-bulletin-print]')?.disabled===false).catch(async e=>{console.error(await page.locator('.bulletin-status').textContent());throw e;});
 assert.equal(await page.evaluate(()=>audit.documents.get(childSource.id).settings.design),'children');
 await page.locator('[data-bulletin-field="memoryVerse"]').fill('이번 주 새길 말씀');await page.locator('[data-bulletin-save]').click();await page.waitForFunction(()=>audit.row?.revision===1);
 await page.evaluate(()=>{audit.handle.destroy();audit.documents.clear();localStorage.clear();audit.handle=audit.mount();});await page.waitForFunction(()=>document.querySelector('[data-bulletin-print]')?.disabled===false);
 assert.equal(await page.locator('[data-bulletin-field="memoryVerse"]').inputValue(),'이번 주 새길 말씀');
 console.log('PASS children identity, actual four-face content, prayer isolation, reading cycle, missed Sunday, monthly boundaries, DB save and reload');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
