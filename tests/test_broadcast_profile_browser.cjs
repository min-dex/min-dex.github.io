// Synthetic browser checks, no channel credentials or publication.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const page=await browser.newPage({viewport:{width:1320,height:1000}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.youtubeOutput={onState(){},abort:async()=>{},start:async()=>({cancelled:true})};localStorage.setItem('mindex.broadcast.bitrate','18000');});
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/broadcast-prototype/index.html`);
  await page.waitForFunction(()=>window.broadcastPrototype);
  assert.deepEqual(await page.locator('#broadcast').evaluate(c=>[c.width,c.height]),[1920,1080]);
  assert.equal(await page.locator('#ytBitrate').inputValue(),'18000');assert(await page.locator('#ytRecord').isChecked());assert(await page.locator('#ytStart').isDisabled());
  await page.getByText('수동 자막 및 화면 설정',{exact:true}).click();await page.locator('#text').fill('1080p 자막 확인');await page.locator('#apply').click();
  await page.waitForTimeout(900);
  assert(await page.locator('#broadcast').evaluate(c=>{const d=c.getContext('2d').getImageData(0,850,1920,230).data;for(let i=0;i<d.length;i+=4)if(d[i]>220&&d[i+1]>220&&d[i+2]>220)return true;return false;}),'caption visible at full resolution');
  await page.screenshot({path:'/private/tmp/mindex-broadcast-1080-preview.png',fullPage:true});
  await page.evaluate(async()=>{
   const {mountYoutube}=await import('./youtube.mjs');
   window.qa={released:0,options:null,cancel:true};
   window.youtubeOutput={onState(fn){qa.state=fn;},abort:async()=>{},start:async options=>{qa.options=options;return qa.cancel?{cancelled:true}:{recording:options.record?'synthetic.mp4':null};},write:async()=>{},stop:async()=>true};
   mountYoutube(async()=>({stream:document.querySelector('#broadcast').captureStream(30),release(){qa.released++;}}),()=>true);
  });
  await page.locator('#ytKey').fill('synthetic-key');await page.locator('#ytStart').click();
  await page.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='저장 선택을 취소했습니다.');
  assert.deepEqual(await page.evaluate(()=>qa.options),{key:'synthetic-key',bitrateKbps:18000,record:true});
  assert.equal(await page.evaluate(()=>qa.released),1);assert(await page.locator('#ytBitrate').isEnabled());
  await page.evaluate(()=>qa.cancel=false);await page.locator('#ytStart').click();
  await page.waitForFunction(()=>document.querySelector('#ytKey').value==='');await page.evaluate(()=>qa.state('live'));
  assert.equal(await page.locator('#ytStatus').textContent(),'송출·녹화 중');assert(await page.locator('#ytBitrate').isDisabled());
  await page.locator('#ytStop').click();await page.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='송출 종료 · 녹화 저장 완료');
  assert.equal(await page.evaluate(()=>qa.released),2);
  assert.deepEqual(errors,[]);console.log('PASS 1080p canvas, scaled caption placement, saved bitrate and default recording controls');
 }finally{await browser?.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
