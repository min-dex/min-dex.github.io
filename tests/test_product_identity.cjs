const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {identity,writeIdentity,validateWorkingRuntime,sameRelease}=require('../scripts/product-identity.cjs');
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
  validateWorkingRuntime(f.root,web);
  fs.writeFileSync(path.join(f.root,'index.html'),'changed');assert.throws(()=>validateWorkingRuntime(f.root,web),/Commit/);
  assert.deepEqual(identity(f.root),web,'uncommitted changes must not acquire a committed identity');
  f.commit();const changed=identity(f.root);assert.notEqual(changed.rendererTree,web.rendererTree);assert.throws(()=>sameRelease(web,changed),/different source/);
 }finally{f.close();}
});
test('unreviewed assets and non-Korean release notes fail closed',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.root,'assets/private-backup.txt'),'synthetic');assert.throws(()=>validateWorkingRuntime(f.root,identity(f.root)),/Uncommitted/);
  fs.writeFileSync(path.join(f.root,'product-release.json'),JSON.stringify({channel:'release',changes:['English-only']}));f.commit();assert.throws(()=>identity(f.root),/Korean/);
 }finally{f.close();}
});
test('installed app retains bundled renderer and test package remains outside updater',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../electron/main.js'),'utf8');
 assert.match(main,/mainWindow\.loadFile\(indexPath\(\)\)/);assert.doesNotMatch(main,/mainWindow\.loadURL/);
 assert.match(main,/mindexTestBuild !== true/);
 const config=require('../electron-builder.test.cjs');assert.equal(config.publish,null);assert.equal(config.extraMetadata.mindexTestBuild,true);
});
