// Church-only installers use explicit download/replace, never unsigned auto-execution.
const ROOT = 'https://github.com/min-dex/min-dex.github.io/releases/download/';
const API = 'https://api.github.com/repos/min-dex/min-dex.github.io/releases?per_page=100';
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
  if(!asset)throw Error('Incomplete internal release');
  return {version,url};
 }
 return null;
}
function createInternalUpdateController({version,platform,arch,enabled,presenterOpen,notify,fetchImpl=fetch,openExternal}) {
 let state={status:'idle',version:'',manualInstall:true},candidate=null,checking=null,opening=null;
 const snapshot=()=>({...state,enabled:enabled(),presenterOpen:presenterOpen()});
 const publish=()=>notify(snapshot());
 const set=(status,extra={})=>{state={...state,message:'',status,...extra};publish();};
 const failure=()=>{set('error',{message:'업데이트를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.'});return {ok:false,reason:'update-failed'};};
 return {snapshot,publish,
  check(){
   if(!enabled())return Promise.resolve({ok:false,reason:'updates-unavailable'});
   if(checking)return checking;
   candidate=null;set('checking');
   checking=(async()=>{try{
    const response=await fetchImpl(API,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw Error('Release lookup failed');
    const body=await response.text();if(body.length>2000000)throw Error('Release response too large');
    const rows=JSON.parse(body);if(!Array.isArray(rows))throw Error('Invalid release list');
    candidate=chooseRelease(rows,version,platform,arch);
    set(candidate?'available':'current',{version:candidate?.version||''});
    return {ok:true,state:snapshot()};
   }catch{return failure();}finally{checking=null;}})();return checking;
  },
  download(){
   if(!enabled())return Promise.resolve({ok:false,reason:'updates-unavailable'});
   if(presenterOpen())return Promise.resolve({ok:false,reason:'presenter-active'});
   if(!candidate||state.status!=='available')return Promise.resolve({ok:false,reason:'update-not-ready'});
   if(opening)return opening;
   // Only the fixed repository asset URL is opened, never a renderer-supplied URL.
   const selected=candidate;
   opening=Promise.resolve().then(async()=>{
    if(!enabled())return {ok:false,reason:'updates-unavailable'};
    if(presenterOpen())return {ok:false,reason:'presenter-active'};
    if(candidate!==selected||state.status!=='available')return {ok:false,reason:'update-not-ready'};
    await openExternal(selected.url);return {ok:true,manualInstall:true};
   }).catch(failure).finally(()=>{opening=null;});return opening;
  },
  install(){return {ok:false,reason:'manual-install-required'};},
 };
}
module.exports={chooseRelease,compare,createInternalUpdateController};
