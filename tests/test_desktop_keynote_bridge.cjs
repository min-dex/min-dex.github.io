// Isolated packaged app and synthetic loopback helper only; no Keynote or user files.
const {_electron}=require('playwright');
const {closeIsolatedElectron}=require('./helpers/close-isolated-electron.cjs');
const assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const [exe,sha,version]=process.argv.slice(2),token=crypto.randomBytes(16).toString('hex');
 let calls=0,app;
 const server=http.createServer((req,res)=>{
  calls++;assert.equal(req.url,'/health');assert.equal(req.headers.origin,'https://min-dex.github.io');
  res.setHeader('content-type','application/json');res.end(JSON.stringify({protocol:'mindex-keynote-bridge-v1'}));
 });
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(43181,'127.0.0.1',resolve)});
  app=await _electron.launch({executablePath:path.resolve(exe),env:{...process.env,MINDEX_ISOLATED_TEST:'1',MINDEX_TEST_PROFILE_TOKEN:token}});
  const native=await app.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion(),isolated:globalThis.__mindexTestIsolation.networkBlocked}));
  assert(native.packaged&&native.isolated);assert.equal(native.version,version);
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.mindexElectron);
  assert.equal((await page.evaluate(()=>mindexElectron.getBuildInfo())).build.sourceCommit,sha);
  const result=await page.evaluate(()=>mindexElectron.keynoteBridgeRequest({path:'/health'}));
  if(process.platform==='darwin'){
   assert(result.ok);assert.equal(result.status,200);
   assert.equal(JSON.parse(Buffer.from(result.body).toString()).protocol,'mindex-keynote-bridge-v1');assert.equal(calls,1);
   const bypass=await page.evaluate(()=>mindexElectron.keynoteBridgeRequest({path:'/connect/'+'a'.repeat(36),method:'POST'}));
   assert.equal(bypass.ok,false);assert.equal(calls,1);
   const other=await app.evaluate(async({BrowserWindow,app})=>{
    const window=new BrowserWindow({show:false,webPreferences:{preload:app.getAppPath()+'/electron/preload.js',contextIsolation:true,nodeIntegration:false}});
    try{await window.loadURL('data:text/html,<title>isolated untrusted window</title>');return await window.webContents.executeJavaScript("mindexElectron.keynoteBridgeRequest({path:'/health'})");}finally{window.destroy();}
   });
   assert.equal(other.ok,false);assert.equal(calls,1,'secondary windows must not access helper');
   const navigated=await app.evaluate(async({BrowserWindow})=>{
    const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:'));
    await window.loadURL('data:text/html,<title>isolated replacement page</title>');
    return await window.webContents.executeJavaScript("mindexElectron.keynoteBridgeRequest({path:'/health'})");
   });
   assert.equal(navigated.ok,false);assert.equal(calls,1,'a navigated controller must not retain access');
  }else{assert.equal(result.reason,'unsupported-platform');assert.equal(calls,0);}
  console.log('PASS packaged Keynote protected IPC, fixed-origin helper health, approval-bypass rejection and untrusted-window isolation');
 }catch(error){
  console.error('Isolated Keynote assertion failed before cleanup:',error);throw error;
 }finally{
  let cleanupError;
  try{if(app)await closeIsolatedElectron(app,token);}catch(error){cleanupError=error;}
  server.closeAllConnections();
  await new Promise(resolve=>server.close(()=>resolve()));
  const folder=path.join(fs.realpathSync(os.tmpdir()),'mindex-isolated-upgrade-'+token),marker=path.join(folder,'fixture-only.json');
  if(!cleanupError&&fs.existsSync(marker)){assert(!fs.lstatSync(folder).isSymbolicLink());const value=JSON.parse(fs.readFileSync(marker));assert.equal(value.token,token);assert.equal(value.appId,'kr.mindex.app.test');fs.rmSync(folder,{recursive:true});}
  if(cleanupError)throw cleanupError;
  console.log('PASS owned isolated Keynote window cleanup');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
