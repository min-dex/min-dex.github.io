const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {identity,writeIdentity,validateWorkingRuntime,sameRelease,verifyWebReleaseTag}=require('../scripts/product-identity.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mindex-identity-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});git('init');
 for(const [name,value] of Object.entries({'package.json':{version:'0.1.1'},'product-release.json':{channel:'development',changes:['입력 안정성을 개선했습니다.']},'mindex-release.json':{version:'fixture-build'}}))fs.writeFileSync(path.join(root,name),JSON.stringify(value));
 fs.writeFileSync(path.join(root,'index.html'),'fixture');fs.mkdirSync(path.join(root,'assets'));fs.writeFileSync(path.join(root,'assets/image.txt'),'fixture');
 const commit=()=>{git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture');};commit();return {root,commit,git,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('web and desktop derive identical product/source/runtime identity, test remains distinct',()=>{
 const f=fixture();try{
  const web=identity(f.root),desktop=identity(f.root),testApp=identity(f.root,{test:true});
  assert.deepEqual(web,desktop);assert.equal(web.productVersion,'0.1.1');assert.equal(web.channel,'development');
  assert.equal(testApp.channel,'test');assert.equal(testApp.rendererTree,web.rendererTree);
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'mindex-receipt-'));try{writeIdentity(f.root,out);const published=JSON.parse(fs.readFileSync(path.join(out,'mindex-build.json')));assert.equal(published.sourceCommit,web.sourceCommit);assert.equal(published.files,undefined);}finally{fs.rmSync(out,{recursive:true,force:true});}
  validateWorkingRuntime(f.root);
  fs.writeFileSync(path.join(f.root,'index.html'),'changed');assert.throws(()=>validateWorkingRuntime(f.root),/Commit/);
  assert.deepEqual(identity(f.root),web,'uncommitted changes must not acquire a committed identity');
  f.commit();const changed=identity(f.root);assert.notEqual(changed.rendererTree,web.rendererTree);assert.throws(()=>sameRelease(web,changed),/different source/);
 }finally{f.close();}
});
test('unreviewed assets and non-Korean release notes fail closed',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.root,'assets/private-backup.txt'),'synthetic');assert.throws(()=>validateWorkingRuntime(f.root),/Uncommitted/);
  fs.writeFileSync(path.join(f.root,'product-release.json'),JSON.stringify({channel:'release',changes:['English-only']}));f.commit();assert.throws(()=>identity(f.root),/Korean/);
 }finally{f.close();}
});
test('installed app retains bundled renderer and test package remains outside updater',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../electron/main.js'),'utf8');
 assert.match(main,/mainWindow\.loadFile\(indexPath\(\)\)/);assert.doesNotMatch(main,/mainWindow\.loadURL/);
 assert.match(main,/mindexTestBuild !== true/);
 const config=require('../electron-builder.test.cjs');assert.equal(config.publish,null);assert.equal(config.extraMetadata.mindexTestBuild,true);
});

test('formal web version rejects absent or different-source tags',()=>{
 const f=fixture();try{
  f.git('remote','add','origin',f.root);const record={...identity(f.root),channel:'release'};
  assert.throws(()=>verifyWebReleaseTag(f.root,record),/matching published/);
  f.git('tag','v0.1.1');verifyWebReleaseTag(f.root,record);
  fs.writeFileSync(path.join(f.root,'index.html'),'next');f.commit();
  assert.throws(()=>verifyWebReleaseTag(f.root,{...identity(f.root),channel:'release'}),/matching published/);
 }finally{f.close();}
});

test('historical data is outside the shared native runtime identity',()=>{
 const f=fixture();try{
  const before=identity(f.root);fs.mkdirSync(path.join(f.root,'data'));
  fs.writeFileSync(path.join(f.root,'data/emergency-worship.json'),'synthetic historical record');f.commit();
  const after=identity(f.root);assert.equal(after.rendererTree,before.rendererTree);
  assert.ok(after.files.every(file=>!file.name.startsWith('data/')));
  validateWorkingRuntime(f.root);
 }finally{f.close();}
});

test('retired waiting videos stay public but outside the shared renderer identity',()=>{
 const {build}=require('../package.json');
 const retired=['chromakey-ready-loop.mp4','chromakey-ready-loop-fast.mp4'];
 const active='chromakey-ready-loop-pingpong.mp4';
 const f=fixture();try{
  const folder=path.join(f.root,'assets/presenter');fs.mkdirSync(folder);
  for(const name of [...retired,active])fs.writeFileSync(path.join(folder,name),name);
  f.commit();const before=identity(f.root);
  fs.writeFileSync(path.join(f.root,'package.json'),JSON.stringify({version:'0.1.1',build}));
  f.commit();const after=identity(f.root);
  const excluded=retired.map(name=>'assets/presenter/'+name);
  assert.deepEqual(after.files,before.files.filter(file=>!excluded.includes(file.name)));
  assert.ok(after.files.some(file=>file.name==='assets/presenter/'+active));
  assert.notEqual(after.rendererTree,before.rendererTree);
  validateWorkingRuntime(f.root);
 }finally{f.close();}
});

test('home-screen icon participates in web/native renderer identity',()=>{
 const f=fixture();try{
  const before=identity(f.root);fs.writeFileSync(path.join(f.root,'apple-touch-icon.png'),'synthetic icon');f.commit();
  const after=identity(f.root);assert(after.files.some(file=>file.name==='apple-touch-icon.png'));assert.notEqual(after.rendererTree,before.rendererTree);
 }finally{f.close();}
});
