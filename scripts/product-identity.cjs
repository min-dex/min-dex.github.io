// Deterministic identity from committed source only; never reads credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const runtime=name=>!name.includes('/')?/^(?:app(?:\.runtime)?\.js|mindex\.(?!build\.json$).+\.(?:js|mjs|json)|remote\..+|styles.*\.css|index\.html|favicon\.ico|manifest\.webmanifest)$/.test(name):/^(assets|vendor|data)\//.test(name);
function identity(root,{test=false}={}){
 const read=name=>JSON.parse(git(root,['show',`HEAD:${name}`]));
 const pkg=read('package.json'),policy=read('product-release.json'),release=read('mindex-release.json');
 if(!/^\d+\.\d+\.\d+$/.test(pkg.version))throw Error('Product version must be semantic version');
 if(!['development','release'].includes(policy.channel))throw Error('Unknown product channel');
 if(!Array.isArray(policy.changes)||!policy.changes.length||policy.changes.some(s=>typeof s!=='string'||!/[가-힣]/.test(s)))throw Error('Korean release notes required');
 const files=git(root,['ls-tree','-rz','HEAD']).split('\0').filter(Boolean).map(row=>{
  const [meta,name]=row.split('\t');return {name,mode:meta.split(' ')[0],blob:meta.split(' ')[2]};
 }).filter(f=>runtime(f.name));
 if(files.some(f=>f.mode!=='100644'&&f.mode!=='100755'))throw Error('Runtime symlinks are not supported');
 const rendererTree=crypto.createHash('sha256').update(files.map(f=>`${f.name}\0${f.blob}\n`).sort().join('')).digest('hex');
 return {schema:1,productVersion:pkg.version,channel:test?'test':policy.channel,buildVersion:release.version,
  sourceCommit:git(root,['rev-parse','HEAD']).trim(),rendererTree,changes:policy.changes,upgradeNotes:policy.upgradeNotes||'',files};
}
function writeIdentity(root,destination,options){
 const result=identity(root,options);const {files,...publicInfo}=result;
 fs.writeFileSync(path.join(destination,'mindex-build.json'),JSON.stringify(publicInfo,null,2)+'\n');return result;
}
function validateWorkingRuntime(root,record){
 const dirty=git(root,['diff','--name-only','HEAD','--']).trim().split('\n').filter(Boolean);
 if(dirty.length)throw Error('Commit runtime and product metadata before packaging');
 const names=new Set(record.files.map(f=>f.name));
 for(const dir of ['assets','vendor','data']){
  const walk=folder=>{if(!fs.existsSync(folder))return;for(const item of fs.readdirSync(folder,{withFileTypes:true})){
   const full=path.join(folder,item.name),name=path.relative(root,full).split(path.sep).join('/');
   if(item.isSymbolicLink())throw Error('Unreviewed runtime symlink');
   if(item.isDirectory())walk(full);else if(!names.has(name))throw Error('Uncommitted runtime asset in package');
  }};walk(path.join(root,dir));
 }
}
function sameRelease(previous,next){
 if(previous.productVersion===next.productVersion&&(previous.sourceCommit!==next.sourceCommit||previous.rendererTree!==next.rendererTree))throw Error('A product version cannot identify different source builds');
}
async function beforePack(context){
 const root=context.packager.projectDir;
 const test=context.packager.config.extraMetadata?.mindexTestBuild===true;
 const record=identity(root,{test});validateWorkingRuntime(root,record);writeIdentity(root,root,{test});
}
module.exports=beforePack;Object.assign(module.exports,{identity,writeIdentity,validateWorkingRuntime,sameRelease,runtime});
if(require.main===module){
 try{writeIdentity(path.resolve(process.argv[2]),path.resolve(process.argv[3]));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
