const {test}=require('node:test'),assert=require('node:assert/strict');
const {chooseRelease,createInternalUpdateController}=require('../electron/internal-updater');
const release=(version='1.0.1',target='mac-arm64.dmg')=>({tag_name:'church-v'+version,assets:[{name:`Mindex-${version}-${target}`,browser_download_url:`https://github.com/min-dex/min-dex.github.io/releases/download/church-v${version}/Mindex-${version}-${target}`,state:'uploaded',size:100}]});
test('internal release selection uses semantic versions and exact architecture/repository',()=>{
 assert.equal(chooseRelease([release('1.0.2'),release('1.0.10')],'1.0.0','darwin','arm64').version,'1.0.10');
 assert.equal(chooseRelease([release('1.0.0')],'1.0.0','darwin','arm64'),null);
 assert.equal(chooseRelease([{...release(),draft:true},{...release(),prerelease:true}],'1.0.0','darwin','arm64'),null);
 for(const target of ['https://evil.invalid/a','file:///tmp/a']){const bad=release();bad.assets[0].browser_download_url=target;assert.throws(()=>chooseRelease([bad],'1.0.0','darwin','arm64'),/Incomplete/);}
 assert.throws(()=>chooseRelease([release()],'1.0.0','darwin','x64'),/Incomplete/);
 assert.equal(chooseRelease([release('1.0.1','win-x64.exe')],'1.0.0','win32','x64').version,'1.0.1');
});
test('coalesces lookup, fails closed, retries, rechecks live output and never auto-installs',async()=>{
 let reads=0,opens=0,live=false,fail=false;const states=[];
 const c=createInternalUpdateController({version:'1.0.0',platform:'darwin',arch:'arm64',enabled:()=>true,presenterOpen:()=>live,notify:s=>states.push(s),fetchImpl:async()=>{reads++;if(fail)throw Error('offline secret');return {ok:true,text:async()=>JSON.stringify([release()])};},openExternal:async url=>{opens++;assert(url.startsWith('https://github.com/min-dex/'));}});
 await Promise.all([c.check(),c.check()]);assert.equal(reads,1);assert.equal(c.snapshot().status,'available');
 live=true;assert.equal((await c.download()).reason,'presenter-active');assert.equal(opens,0);
 live=false;await c.download();assert.equal(opens,1);assert.equal(c.install().reason,'manual-install-required');
 fail=true;assert.equal((await c.check()).ok,false);assert.equal((await c.download()).ok,false);assert(!JSON.stringify(states).includes('secret'));
 fail=false;assert((await c.check()).ok);
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
 const c=createInternalUpdateController({version:'1.0.0',platform:'darwin',arch:'arm64',enabled:()=>true,presenterOpen:()=>live,notify:()=>{},fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify([release()])}),openExternal:async()=>{opens++;}});
 await c.check();const first=c.download();live=true;
 assert.equal((await first).reason,'presenter-active');assert.equal(opens,0);
 live=false;const second=c.download();const lookup=c.check();
 assert.equal((await second).reason,'update-not-ready');await lookup;assert.equal(opens,0);
 await Promise.all([c.download(),c.download()]);assert.equal(opens,1);
});

test('web parity compares renderer identity and never hides installer updates when offline',async()=>{
 for(const mode of ['matched','different','offline']){
  const hash='a'.repeat(64);
  const c=createInternalUpdateController({version:'1.0.1',platform:'darwin',arch:'arm64',rendererTree:hash,enabled:()=>true,presenterOpen:()=>false,notify:()=>{},openExternal:async()=>{},fetchImpl:async url=>{
   if(url.includes('api.github.com'))return {ok:true,text:async()=>JSON.stringify([release('1.0.2')])};
   assert.equal(url,'https://min-dex.github.io/mindex-build.json');
   if(mode==='offline')throw Error('offline');
   return {ok:true,text:async()=>JSON.stringify({rendererTree:mode==='matched'?hash:'b'.repeat(64)})};
  }});
  assert((await c.check()).ok);assert.equal(c.snapshot().status,'available');
  assert.equal(c.snapshot().webSync,mode==='offline'?'unknown':mode);
 }
});
