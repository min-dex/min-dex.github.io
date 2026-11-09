const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createInstallerDownloader,verifyInstaller,discardInstaller}=require('../electron/internal-installer');
const payload=Buffer.from('installer fixture');
const digest='sha256:'+createHash('sha256').update(payload).digest('hex');
const {chooseRelease,createInternalUpdateController}=require('../electron/internal-updater');
const release=(version='1.0.1',target='mac-arm64.dmg')=>({tag_name:'church-v'+version,assets:[{name:`Mindex-${version}-${target}`,browser_download_url:`https://github.com/min-dex/min-dex.github.io/releases/download/church-v${version}/Mindex-${version}-${target}`,id:123,state:'uploaded',size:payload.length,digest}]});
test('internal release selection uses semantic versions and exact architecture/repository',()=>{
 assert.equal(chooseRelease([release('1.0.2'),release('1.0.10')],'1.0.0','darwin','arm64').version,'1.0.10');
 assert.equal(chooseRelease([release('1.0.0')],'1.0.0','darwin','arm64'),null);
 assert.equal(chooseRelease([{...release(),draft:true},{...release(),prerelease:true}],'1.0.0','darwin','arm64'),null);
 for(const target of ['https://evil.invalid/a','file:///tmp/a']){const bad=release();bad.assets[0].browser_download_url=target;assert.throws(()=>chooseRelease([bad],'1.0.0','darwin','arm64'),/Incomplete/);}
 assert.throws(()=>chooseRelease([release()],'1.0.0','darwin','x64'),/Incomplete/);
 assert.equal(chooseRelease([release()],'1.0.0','darwin','arm64').url,'https://api.github.com/repos/min-dex/min-dex.github.io/releases/assets/123?download=1');
 for(const digest of [null,'md5:bad','sha256:bad']){
  const bad=release();bad.assets[0].digest=digest;
  assert.throws(()=>chooseRelease([bad],'1.0.0','darwin','arm64'),/Incomplete/);
 }
 assert.equal(chooseRelease([release('1.0.1','win-x64.exe')],'1.0.0','win32','x64').version,'1.0.1');
});
function nativeDownloadFixture({bytes=payload,redirect='https://release-assets.githubusercontent.com/asset',interrupted=false}={}){
 const session=new EventEmitter();
 let filter,starts=0;
 session.webRequest={onBeforeRequest(cb){filter=cb;}};
 session.downloadURL=(url,{headers})=>{
  assert.equal(headers.Accept,'application/octet-stream');
  assert.equal(url,'https://api.github.com/repos/min-dex/min-dex.github.io/releases/assets/123?download=1');
  starts++;
  for(const step of [url,redirect])filter({url:step},result=>{
   if(result.cancel)throw Error('Unexpected download URL');
  });
  const item=new EventEmitter();
  item.getURLChain=()=>[url,redirect];
  item.getTotalBytes=()=>payload.length;
  item.getReceivedBytes=()=>bytes.length;
  item.setSavePath=file=>{
   fs.writeFileSync(file,bytes);
   setImmediate(()=>{
    item.emit('updated',null,'progressing');
    item.emit('done',null,interrupted?'interrupted':'completed');
   });
  };
  session.emit('will-download',{preventDefault(){throw Error('Unexpected download');}},item);
 };
 return {session,starts:()=>starts};
}

for(const [platform,arch,target] of [
 ['darwin','arm64','mac-arm64.dmg'],['darwin','x64','mac-x64.dmg'],['win32','x64','win-x64.exe'],
]){
 test(platform+' '+arch+' stages one verified installer and requires a separate open',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mindex-update-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const native=nativeDownloadFixture();
  let reads=0,opens=0,live=false,fail=false,openFailure=true,openedFile;
  const states=[];
  const c=createInternalUpdateController({version:'1.0.0',platform,arch,enabled:()=>true,
   presenterOpen:()=>live,notify:state=>states.push(state),fetchImpl:async()=>{
    reads++;if(fail)throw Error('offline secret');
    return {ok:true,text:async()=>JSON.stringify([release('1.0.1',target)])};
   },downloadInstaller:createInstallerDownloader(native.session,root),verifyInstaller,discardInstaller,markInstaller:async()=>{},
   openInstaller:async file=>{opens++;openedFile=file;return openFailure?'blocked':'';}});
  fail=true;assert.equal((await c.check()).ok,false);assert(!JSON.stringify(states).includes('secret'));
  fail=false;await Promise.all([c.check(),c.check()]);assert.equal(reads,2);
  live=true;assert.equal((await c.download()).reason,'presenter-active');
  live=false;await Promise.all([c.download(),c.download()]);
  assert.equal(native.starts(),1);assert.equal(c.snapshot().status,'downloaded');assert.equal(opens,0);
  assert(states.some(state=>state.status==='downloading'));
  await c.check();assert.equal(reads,2);
  live=true;assert.equal((await c.install()).reason,'presenter-active');assert.equal(opens,0);
  live=false;assert.equal((await c.install()).reason,'installer-open-failed');
  openFailure=false;assert.deepEqual(await c.install(),{ok:true,installerOpened:true});
  assert.equal(path.basename(openedFile),'Mindex-1.0.1-'+target);
  fs.writeFileSync(openedFile,Buffer.alloc(payload.length));
  assert.equal((await c.install()).ok,false);assert.equal(opens,2);
  assert.deepEqual(fs.readdirSync(root),[]);
 });
}
test('failed, corrupt and untrusted downloads leave no staged installer',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mindex-update-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const fixture of [{interrupted:true},{bytes:Buffer.alloc(payload.length)},{redirect:'http://release-assets.githubusercontent.com/asset'},{redirect:'https://evil.invalid/asset'}]){
  const native=nativeDownloadFixture(fixture);
  const c=createInternalUpdateController({version:'1.0.0',platform:'darwin',arch:'arm64',enabled:()=>true,
   presenterOpen:()=>false,notify:()=>{},fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify([release()])}),
   downloadInstaller:createInstallerDownloader(native.session,root),verifyInstaller,discardInstaller,markInstaller:async()=>{},
   openInstaller:async()=>assert.fail('Unverified installer cannot be opened')});
  await c.check();assert.equal((await c.download()).ok,false);
  assert.equal((await c.install()).reason,'update-not-ready');
  assert.deepEqual(fs.readdirSync(root),[]);
 }
});
test('internal build keeps real identity while signed defaults stay protected',()=>{
 const pkg=require('../package.json'),config=require('../electron-builder.internal.cjs');
 assert.equal(config.appId,pkg.build.appId);assert.equal(config.productName,'Mindex');assert.equal(config.extraMetadata.mindexInternalBuild,true);
 assert.equal(config.mac.identity,'-');assert.equal(config.mac.hardenedRuntime,false);assert.equal(pkg.build.mac.hardenedRuntime,true);
 assert.equal(config.publish,null);assert.equal(config.win.signExecutable,false);assert.notEqual(config.win.signAndEditExecutable,false);assert.equal(config.mac.notarize,false);assert.equal(pkg.build.mac.notarize,true);
});

test('internal acceptance cannot send a real broadcast and retains final platform gates',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync('electron/youtube-window.js','utf8');
 assert.match(source,/mindexTestBuild === true \|\| globalThis.__mindexTestIsolation/);
 const workflow=fs.readFileSync('.github/workflows/desktop-release.yml','utf8');
 for(const value of ['electron-builder.internal.cjs','internal-proof.json','intel-internal-proof.json','tests/test_desktop_youtube_local.cjs','codesign --verify --deep --strict'])assert(workflow.includes(value));
 assert(!workflow.includes('continue-on-error:'));
});

test('download rechecks output and lookup changes at dispatch time',async()=>{
 let live=false,opens=0;
 const c=createInternalUpdateController({version:'1.0.0',platform:'darwin',arch:'arm64',enabled:()=>true,presenterOpen:()=>live,notify:()=>{},fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify([release()])}),downloadInstaller:async()=>{opens++;return '/fixture';},verifyInstaller:async()=>{},discardInstaller:async()=>{}});
 await c.check();const first=c.download();live=true;
 assert.equal((await first).reason,'presenter-active');assert.equal(opens,0);
 live=false;const second=c.download();const lookup=c.check();
 assert.equal((await second).reason,'update-not-ready');await lookup;assert.equal(opens,0);
 await Promise.all([c.download(),c.download()]);assert.equal(opens,1);
});

test('web parity compares renderer identity and never hides installer updates when offline',async()=>{
 for(const mode of ['matched','different','offline']){
  const hash='a'.repeat(64);
  const c=createInternalUpdateController({version:'1.0.1',platform:'darwin',arch:'arm64',rendererTree:hash,enabled:()=>true,presenterOpen:()=>false,notify:()=>{},fetchImpl:async url=>{
   if(url.includes('api.github.com'))return {ok:true,text:async()=>JSON.stringify([release('1.0.2')])};
   assert.equal(url,'https://min-dex.github.io/mindex-build.json');
   if(mode==='offline')throw Error('offline');
   return {ok:true,text:async()=>JSON.stringify({rendererTree:mode==='matched'?hash:'b'.repeat(64)})};
  }});
  assert((await c.check()).ok);assert.equal(c.snapshot().status,'available');
  assert.equal(c.snapshot().webSync,mode==='offline'?'unknown':mode);
 }
});


test('encoder digest handles multi-chunk files and reports changed bytes compactly',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
 const {fileIdentity}=require('../scripts/packaged-encoder-identity.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mindex-digest-'));
 try {
  const file=path.join(dir,'fixture'),data=Buffer.alloc(3*1024*1024+17,7);fs.writeFileSync(file,data);
  const before=fileIdentity(file);assert.deepEqual(before,{bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  data[data.length-1]=8;fs.writeFileSync(file,data);assert.notEqual(fileIdentity(file).sha256,before.sha256);
 } finally {fs.rmSync(dir,{recursive:true});}
});
