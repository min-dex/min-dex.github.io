// Candidate integration: only a formal release identity enables automatic release notes.
(() => {
 const seenKey='mindex.product.releaseSeen.v1';
 let identity=null,loading=null,dialog=null,attempted=false,acknowledged=false;
 const storage=()=>window.MINDEX_SERVER_STORAGE;
 function load(retry=false){
  if(loading&&!(retry&&!identity))return loading;
  loading=(async()=>{
   const controller=new AbortController();let timer;
   try{
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('BUILD_INFO_TIMEOUT'));},3000)});
    const desktop=window.mindexElectron?.isDesktop;
    const request=desktop?Promise.resolve(window.mindexElectron.getBuildInfo?.()).then(info=>info?.build):fetch('./mindex-build.json',{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.ok)return r.json();await r.body?.cancel();return null;});
    const value=await Promise.race([request,deadline]);
    if(value?.schema===1&&/^\d+\.\d+\.\d+$/.test(value.productVersion)&&['release','development','test'].includes(value.channel)&&Array.isArray(value.changes))identity=value;
   }catch{} // Optional introduction must never block app startup or editing.
   finally{clearTimeout(timer);controller.abort();}
  })();return loading;
 }
 function markup(){return `<section class="product-welcome"><details ${window.MindexDisclosure?.attrs(['product','home-intro'],true)||'open'}><summary>민덱스 소개</summary><p>예배 슬라이드와 주보를 만들고, 찬양·말씀·음원을 관리해요. 다른 기기에서도 예배 진행을 조작할 수 있어요.</p></details><button type="button" class="btn secondary" data-product-notes>업데이트 내용</button><p class="product-welcome-status" role="status" hidden></p></section>`;}
 function eligible(){return identity?.channel==='release'&&storage()?.ready&&!document.body.classList.contains('ui-booting')&&document.querySelector('.home-start .product-welcome')&&!document.querySelector('dialog[open],.modal:not([hidden]),[role=dialog][aria-modal=true]:not([hidden])')&&!document.activeElement?.matches('input,textarea,[contenteditable=true]')&&!attempted&&!acknowledged&&storage().getItem('local',seenKey)!==identity.productVersion;}
 function show(opener,automatic=false){
  if(dialog?.open)return;
  if(!identity){const note=document.querySelector('.product-welcome-status');if(note){note.hidden=false;note.textContent='업데이트 정보를 불러오지 못했어요.';}return;}
  if(automatic)attempted=true;
  const version=identity.productVersion,release=identity.channel==='release';
  dialog=document.createElement('dialog');dialog.className='product-release-dialog';dialog.setAttribute('aria-labelledby','productReleaseTitle');
  const heading=document.createElement('h2');heading.id='productReleaseTitle';heading.textContent=release?`Mindex ${version}`:'개발 중인 변경 사항';
  const list=document.createElement('ul');for(const text of identity.changes.filter(v=>typeof v==='string').slice(0,30)){const li=document.createElement('li');li.textContent=text;list.append(li);}
  const note=document.createElement('p');note.textContent=identity.upgradeNotes||'';
  const close=document.createElement('button');close.type='button';close.className='btn secondary';close.textContent='닫기';close.autofocus=true;
  const node=dialog;node.append(heading,list,note,close);document.body.append(node);
  close.onclick=()=>node.close();
  node.addEventListener('close',()=>{
   node.remove();if(dialog===node)dialog=null;
   if(opener?.isConnected)opener.focus();
   if(release&&storage()?.ready){acknowledged=true;void storage().setItem('local',seenKey,version).catch(()=>{});}
  },{once:true});node.showModal();
 }
 async function mount(){
  const host=document.querySelector('.home-start .product-welcome');if(!host)return;
  host.querySelector('[data-product-notes]').onclick=async event=>{const opener=event.currentTarget;await load(true);if(opener.isConnected)show(opener);};
  await load();if(eligible())show(null,true);
 }
 window.addEventListener('mindex-server-storage-ready',()=>void mount());
 const bootObserver=new MutationObserver(()=>{if(!document.body.classList.contains('ui-booting')){bootObserver.disconnect();void mount();}});
 if(document.body.classList.contains('ui-booting'))bootObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 window.MindexProductWelcome=Object.freeze({markup,mount});
})();
