// Church-only installers require explicit user confirmation before opening.
const ROOT = 'https://github.com/min-dex/min-dex.github.io/releases/download/';
const RELEASES = 'https://api.github.com/repos/min-dex/min-dex.github.io/releases';
const API = RELEASES+'?per_page=100';
const versionParts = value => /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : null;
const compare = (a,b) => { const x=versionParts(a),y=versionParts(b); if(!x||!y)throw Error('Invalid version'); for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i]; return 0; };
function chooseRelease(rows, current, platform, arch) {
 const target=platform==='darwin'&&['arm64','x64'].includes(arch)?`mac-${arch}.dmg`:platform==='win32'&&arch==='x64'?'win-x64.exe':null;
 if(!target)throw Error('Unsupported platform');
 const releases=rows.filter(r=>!r.draft&&!r.prerelease&&/^church-v\d+\.\d+\.\d+$/.test(r.tag_name||'')).sort((a,b)=>compare(b.tag_name.slice(8),a.tag_name.slice(8)));
 for(const release of releases){
  const version=release.tag_name.slice(8);if(compare(version,current)<=0)continue;
  const name=`Mindex-${version}-${target}`;
  const url=ROOT+release.tag_name+'/'+name;
  const asset=(release.assets||[]).find(a=>a.name===name&&a.browser_download_url===url&&a.size>0&&a.state==='uploaded');
  if(!asset || !Number.isSafeInteger(asset.id) || asset.id < 1 ||
      !Number.isSafeInteger(asset.size) || asset.size > 8 * 1024 ** 3 ||
      !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) throw Error('Incomplete internal release');
  return {version,url:RELEASES+'/assets/'+asset.id+'?download=1',name,size:asset.size,sha256:asset.digest.slice(7)};
 }
 return null;
}
function createInternalUpdateController({version,platform,arch,rendererTree,enabled,presenterOpen,notify,fetchImpl=fetch,downloadInstaller,verifyInstaller,discardInstaller,openInstaller}) {
 let state={status:'idle',version:'',manualInstall:true},candidate=null,checking=null,downloading=null,opening=null,verifiedFile=null;
 const snapshot=()=>({...state,enabled:enabled(),presenterOpen:presenterOpen()});
 const publish=()=>notify(snapshot());
 const set=(status,extra={})=>{state={...state,message:'',status,...extra};publish();};
 const failure=(message='업데이트를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.')=>{
  set('error',{message});return {ok:false,reason:'update-failed'};
 };
 return {snapshot,publish,
  check(){
   if(!enabled())return Promise.resolve({ok:false,reason:'updates-unavailable'});
   if(checking)return checking;
   if(state.status==='downloading' || opening || verifiedFile)return Promise.resolve({ok:true,state:snapshot()});
   candidate=null;set('checking');
   checking=(async()=>{try{
    const response=await fetchImpl(API,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw Error('Release lookup failed');
    const body=await response.text();if(body.length>2000000)throw Error('Release response too large');
    const rows=JSON.parse(body);if(!Array.isArray(rows))throw Error('Invalid release list');
    candidate=chooseRelease(rows,version,platform,arch);
    let webSync='unknown';
    if (/^[a-f0-9]{64}$/.test(rendererTree || '')) {
     try {
      const web=await fetchImpl('https://min-dex.github.io/mindex-build.json',{signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store'});
      if(!web.ok)throw Error('Web receipt unavailable');
      const text=await web.text();if(text.length>2000000)throw Error('Web receipt too large');
      const receipt=JSON.parse(text);
      if(/^[a-f0-9]{64}$/.test(receipt.rendererTree||''))webSync=receipt.rendererTree===rendererTree?'matched':'different';
     }catch{/* Offline web status must not hide an available installer. */}
    }
    set(candidate?'available':'current',{version:candidate?.version||'',webSync});
    return {ok:true,state:snapshot()};
   }catch{return failure();}finally{checking=null;}})();return checking;
  },
  download(){
   if(!enabled())return Promise.resolve({ok:false,reason:'updates-unavailable'});
   if(presenterOpen())return Promise.resolve({ok:false,reason:'presenter-active'});
   if(downloading)return downloading;
   if(!candidate||state.status!=='available')return Promise.resolve({ok:false,reason:'update-not-ready'});
   const selected=candidate;
   downloading=Promise.resolve().then(async()=>{
    if(!enabled())return {ok:false,reason:'updates-unavailable'};
    if(presenterOpen())return {ok:false,reason:'presenter-active'};
    if(candidate!==selected||state.status!=='available')return {ok:false,reason:'update-not-ready'};
    set('downloading',{percent:0});
    let file;
    try{
     file=await downloadInstaller(selected,percent=>{
      if(percent!==state.percent)set('downloading',{percent});
     });
     await verifyInstaller(file,selected);
     verifiedFile=file;
     set('downloaded',{percent:100});
     return {ok:true};
    }catch{
     if(file)await discardInstaller(file);
     return failure('설치 파일을 내려받거나 검증하지 못했습니다. 업데이트를 다시 확인해 주세요.');
    }
   }).finally(()=>{downloading=null;});
   return downloading;
  },
  install(){
   if(!enabled())return Promise.resolve({ok:false,reason:'updates-unavailable'});
   if(presenterOpen())return Promise.resolve({ok:false,reason:'presenter-active'});
   if(opening)return opening;
   if(!verifiedFile||state.status!=='downloaded')return Promise.resolve({ok:false,reason:'update-not-ready'});
   const file=verifiedFile;
   opening=Promise.resolve().then(async()=>{
    try{await verifyInstaller(file,candidate);}
    catch{
     verifiedFile=null;
     await discardInstaller(file);
     return failure('설치 파일 검증에 실패했습니다. 업데이트를 다시 확인해 주세요.');
    }
    if(!enabled())return {ok:false,reason:'updates-unavailable'};
    if(presenterOpen())return {ok:false,reason:'presenter-active'};
    try{
     if(await openInstaller(file))return {ok:false,reason:'installer-open-failed'};
     return {ok:true,installerOpened:true};
    }catch{return {ok:false,reason:'installer-open-failed'};}
   }).finally(()=>{opening=null;});
   return opening;
  },
 };
}
module.exports={chooseRelease,compare,createInternalUpdateController};
