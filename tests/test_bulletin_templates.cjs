// Editorial layout and editing regression using verified sample content; no production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {PDFDocument}=require('pdf-lib');
const fixture=require('./fixtures/bulletin-20260920.json');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin.js"></script>');return;}
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

  await page.evaluate(async data=>{
    const B=MindexBulletin;await B.readyAssets();
    const src=B.resolveSource({...data,service:{...data.service,id:'week-a',service_date:'2026-11-01'}});
    src.autoBackground={key:'26-A5.png',url:'assets/worship-backgrounds/26-A5.png'};
    const d={source:src,fields:{},settings:{design:'simple',theme:'',compactOrder:true},frames:B.defaultFrames('simple'),inherited:{common:{},months:{}},months:{}};
    const row={template_key:B.TEMPLATE_KEY,...B.templateValue(d),revision:1};
    row.common.welcome='공통 환영 인사';row.layout.frames.find(f=>f.id==='welcome').size=15;
    window.audit={row,rows:{},writes:[],templateWrites:[],documents:new Map(),conflict:false,source:src};
    const host=document.createElement('div');host.style.height='100vh';document.body.append(host);
    audit.mount=id=>B.mount(host,{serviceId:id,scope:'template-test',documents:audit.documents,services:[{id:'week-a',label:'11/1 청년부'},{id:'week-b',label:'11/8 청년부'},{id:'week-c',label:'11/15 청년부'}],
      loadSource:async id=>({...structuredClone(src),id,date:id==='week-a'?'2026-11-01':id==='week-b'?'2026-11-08':'2026-11-15',news:'① '+id+' 소식'}),
      loadDraft:async id=>structuredClone(audit.rows[id]||null),
      saveDraft:async(id,value,rev)=>{audit.writes.push(id);return audit.rows[id]={...structuredClone(value),revision:rev+1};},
      loadTemplate:async()=>structuredClone(audit.row),
      saveTemplate:async(key,value,rev)=>{if(audit.conflict||rev!==audit.row.revision)throw new Error('다른 곳에서 공통 양식을 변경했습니다');audit.templateWrites.push(structuredClone(value));return audit.row={template_key:key,...structuredClone(value),revision:rev+1};}});
    audit.handle=audit.mount('week-a');
  },fixture);
  await page.waitForFunction(()=>document.querySelector('[data-bulletin-print]')?.disabled===false);
  const get=()=>page.evaluate(()=>({key:audit.documents.get('week-a').settings.templateKey,welcome:MindexBulletin.fieldValue(audit.documents.get('week-a'),'welcome'),size:audit.documents.get('week-a').frames.find(f=>f.id==='welcome').size}));
  assert.deepEqual(await get(),{key:'young-adult-2027',welcome:'공통 환영 인사',size:15});
  await page.locator('[data-bulletin-field="news"]').fill('① 이번 주만 바꾸는 소식');
  await page.locator('[data-bulletin-save]').click();
  await page.waitForFunction(()=>audit.rows['week-a']?.revision===1);
  const original=await page.evaluate(()=>JSON.stringify(audit.rows['week-a']));
  await page.locator('[data-bulletin-template-edit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-bulletin-save]')?.textContent.includes('공통 양식 저장'));
  assert.equal(await page.locator('[data-bulletin-service]').isEnabled(),false);
  await page.locator('[data-bulletin-setting="itemGap"]').fill('5');
  await page.locator('[data-bulletin-setting="itemGap"]').dispatchEvent('change');
  await page.locator('[data-bulletin-mode="content"]').click();
  assert.equal(await page.locator('[data-bulletin-field="news"]').count(),0);
  await page.locator('[data-bulletin-field="welcome"]').fill('2027 함께 예배해요');
  await page.locator('[data-bulletin-field="brand"]').fill('RIA\n청년 공동체');
  await page.locator('[data-bulletin-save]').click();
  await page.waitForFunction(()=>audit.row.revision===2);
  const saved=await page.evaluate(()=>({row:audit.row,week:JSON.stringify(audit.rows['week-a']),writes:audit.writes.length}));
  assert.equal(saved.week,original);assert.equal(saved.writes,1);
  assert.equal(saved.row.common.welcome,'2027 함께 예배해요');assert.equal(saved.row.layout.itemGap,5);
  assert.equal('news' in saved.row.common,false);assert.equal('sourceSnapshot' in saved.row,false);
  await page.locator('[data-bulletin-template-exit]').click();
  assert.equal((await get()).welcome,'공통 환영 인사');
  await page.locator('[data-bulletin-service]').selectOption('week-b');
  await page.waitForFunction(()=>audit.documents.get('week-b')?.settings.templateRevision===2);
  assert.equal(await page.evaluate(()=>MindexBulletin.fieldValue(audit.documents.get('week-b'),'welcome')),'2027 함께 예배해요');
  assert.equal(await page.locator('[data-bulletin-field="news"]').inputValue(),'① week-b 소식');
  await page.locator('[data-bulletin-section="greetings"] summary').click();
  await page.locator('[data-bulletin-field="welcome"]').fill('이번 주만 다른 인사');
  await page.locator('[data-bulletin-save]').click();
  await page.waitForFunction(()=>audit.rows['week-b']?.revision===1);
  assert.deepEqual(await page.evaluate(()=>audit.rows['week-b'].content.reuse.common),{});
  assert.equal(await page.evaluate(()=>audit.row.common.welcome),'2027 함께 예배해요');
  await page.locator('[data-bulletin-service]').selectOption('week-a');
  await page.waitForFunction(()=>document.querySelector('[data-bulletin-service]')?.disabled===false);
  assert.equal((await get()).welcome,'공통 환영 인사');
  await page.evaluate(()=>{audit.handle.destroy();audit.documents.clear();localStorage.clear();audit.handle=audit.mount('week-a');});
  await page.waitForFunction(()=>document.querySelector('[data-bulletin-print]')?.disabled===false);
  assert.equal((await get()).welcome,'공통 환영 인사','Saved week must retain template v1 after reopening against v2');
  await page.locator('[data-bulletin-template-apply]').click();
  await page.waitForFunction(()=>audit.documents.get('week-a').settings.templateRevision===2);
  assert.equal(await page.locator('[data-bulletin-field="news"]').inputValue(),'① 이번 주만 바꾸는 소식');
  assert.equal((await get()).welcome,'2027 함께 예배해요');
  // A conflicting template save must leave edits and all dated records intact.
  await page.locator('[data-bulletin-template-edit]').click();
  await page.locator('[data-bulletin-mode="content"]').click();
  await page.locator('[data-bulletin-field="welcome"]').fill('충돌 시 보존할 변경');
  await page.evaluate(()=>audit.conflict=true);
  await page.locator('[data-bulletin-save]').click();
  await page.waitForFunction(()=>document.querySelector('.bulletin-status').textContent.includes('다른 곳'));
  assert.equal(await page.locator('[data-bulletin-field="welcome"]').inputValue(),'충돌 시 보존할 변경');
  assert.equal(await page.evaluate(()=>audit.row.revision),2);
  assert.equal(await page.evaluate(()=>JSON.stringify(audit.rows['week-a'])),original);
  console.log('PASS common-template isolation, saved-week freezing, next-week inheritance, separate saves, weekly override, explicit apply and conflict preservation');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
