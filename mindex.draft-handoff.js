// A separate private capability connects only the devices the user pairs.
(() => {
 let core=null,client=null,project='',token='',author='',channel=null,timer=null,poll=null,starting=null,dialog=null,lastStatus='',connecting=false,renderRows=null;
 const pending=new Map();
 const bulletin=()=>refs.detailPane?.querySelector('[data-bulletin-owner]')?.bulletinController;
 const current=()=>bulletin()?.handoffIdentity?.()||window.MINDEX_EDITOR_DRAFTS?.identity?.();
 const tokenKey=p=>'mindex.handoff.identity:'+p;
 function status(){
  let button=document.getElementById('draftHandoffButton');
  if(!button&&typeof refs!=='undefined'&&refs.saveAllBtn){button=document.createElement('button');button.id='draftHandoffButton';button.className='btn secondary';button.onclick=open;refs.saveAllBtn.before(button)}
  if(button){const id=current();const count=id?core?.list(id.kind,id.id).length||0:0;button.textContent=core?.error?'초안 연결 확인':core?.pending?'초안 전달 중…':count?`초안 이어쓰기 · ${count}`:'초안 이어쓰기';}
  renderRows?.();
  if(dialog?.open){const target=dialog.querySelector('[data-handoff-status]');if(target)target.textContent=core?.error?'다른 기기로 전달하지 못했습니다. 기존 초안은 유지됩니다. 다시 시도해 주세요.':core?.pending?'초안 전달 중…':lastStatus||'연결된 기기의 초안은 목록에 표시됩니다. 편집창은 자동 변경되지 않습니다.';}
 }
 function publish(kind,id,draft,label){
  if(project&&project!==state.config.url)return;
  pending.set(kind+':'+id,{kind,id,draft:structuredClone(draft),label});
  if(core){core.publish(kind,id,draft,label);schedule();}status();
 }
 function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;void flush()},300);}
 async function flush(){if(!core)return;try{await core.flush()}catch{}if(core.pending&&!core.error)schedule();else if(!core.pending)void syncConnection();status();}
 async function syncConnection(){
  if(!core||connecting||core.pending||project!==state.config.url)return;
  const saved=localStorage.getItem(tokenKey(project));
  if(saved!==token&&/^[a-f0-9]{64}$/.test(saved||'')){try{await connect(saved)}catch{lastStatus='초안 연결 변경을 완료하지 못했습니다. 다시 시도해 주세요.';status()}}
 }
 async function refresh(){if(!core||document.hidden)return;try{await core.refresh()}catch{}status();}
 async function connect(nextToken){
  if(connecting||core?.pending)throw Error('전달 중인 초안을 먼저 확인해 주세요.');
  connecting=true;
  try{
   const {createDraftHandoff}=await import(`./mindex.draft-handoff.mjs?v=${encodeURIComponent(window.MINDEX_RELEASE||'draft-handoff')}`);
   const activeClient=client,activeProject=project;
   const next=createDraftHandoff({rpc:(name,args)=>activeClient.rpc(name,args),token:nextToken,project:activeProject,author,changed:status,announce:()=>{try{void channel?.send({type:'broadcast',event:'changed',payload:{}}).catch(()=>{})}catch{}}});
   await next.refresh();
   if(client!==activeClient||project!==activeProject)throw Error('프로젝트가 바뀌었습니다. 다시 연결해 주세요.');
   // Only connection identity remains in browser storage, never draft content.
   localStorage.setItem(tokenKey(project),nextToken);
   if(channel)void client.removeChannel?.(channel);
   token=nextToken;core=next;channel=null;
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
   if(client.channel)channel=client.channel('mindex-draft-handoff:'+digest).on('broadcast',{event:'changed'},refresh).subscribe(status=>{if(status==='SUBSCRIBED')void refresh()});
   for(const item of pending.values())core.publish(item.kind,item.id,item.draft,item.label);
   schedule();status();
  }finally{connecting=false;}
 }
 async function initialize(){
  if(starting)return starting;
  if(!window.MINDEX_SERVER_STORAGE?.ready||!state.client||isPresenterOutputRoute())return;
  if(client===state.client&&project===state.config.url&&core)return;
  if(core?.pending){lastStatus='초안 전달이 끝난 뒤 프로젝트를 변경해 주세요.';status();return;}
  starting=(async()=>{
   if(project&&project!==state.config.url)pending.clear();
   if(channel&&client)void client.removeChannel?.(channel);channel=null;core=null;
   client=state.client;project=state.config.url;
   // New runtime identity also separates duplicated tabs (sessionStorage can be copied).
   author=crypto.randomUUID();
   let saved=localStorage.getItem(tokenKey(project));
   if(!/^[a-f0-9]{64}$/.test(saved||''))saved=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   await connect(saved);
   // Existing editor drafts are copied, never moved or deleted.
   for(const key of window.MINDEX_SERVER_STORAGE.keys?.('local')||[]){
    if(!key.startsWith('mindex.editor.draft.v1:'))continue;
    try{const draft=JSON.parse(window.MINDEX_SERVER_STORAGE.getItem('local',key));if(draft?.schema===1)publish(draft.module,draft.id,draft,draft.value?.song?.title||draft.value?.title||draft.value?.service?.title||'보관된 초안');}catch{}
   }
   if(poll)clearInterval(poll);poll=setInterval(refresh,60000);
  })().catch(()=>{lastStatus='초안 연결을 준비하지 못했습니다. 다시 시도해 주세요.';status()}).finally(()=>{starting=null});return starting;
 }
 function element(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
 async function open(){
  await initialize();if(dialog?.open)return;
  dialog=document.createElement('dialog');dialog.className='draft-handoff-dialog';dialog.setAttribute('aria-label','초안 이어쓰기');
  dialog.append(element('h2','초안 이어쓰기'));
  const message=element('p','');message.dataset.handoffStatus='';message.setAttribute('role','status');dialog.append(message);
  const tools=element('div',''),refreshButton=element('button','목록 새로고침'),retry=element('button','전달 다시 시도'),close=element('button','닫기');
  for(const b of [refreshButton,retry,close]){b.type='button';b.className='btn secondary';tools.append(b)}dialog.append(tools);
  const list=element('div','');list.className='draft-handoff-list';dialog.append(list);
  let listSignature='';
  function rows(force=false){
   const id=current(),entries=id?core?.list(id.kind,id.id)||[]:[];
   const signature=JSON.stringify([id,entries.map(e=>[e.key,e.updatedAt])]);
   if(!force&&(signature===listSignature||list.contains(document.activeElement)))return;
   listSignature=signature;list.replaceChildren();
   if(!id){list.append(element('p','이어 쓸 예배·찬양·말씀·주보·참고자료 편집 화면을 먼저 열어 주세요.'));return;}
   if(!entries.length)list.append(element('p','이 문서에 보관된 연결 초안이 없습니다.'));
   for(const entry of entries){const row=element('div',''),title=element('p',`${entry.label||'초안'} · ${new Date(entry.updatedAt).toLocaleString()}${entry.author===author?' · 이 탭':''}`),button=element('button','이 초안 이어쓰기');button.type='button';button.className='btn secondary';button.onclick=async()=>{
     const identity=current();if(!identity||identity.kind!==entry.kind||identity.id!==entry.id){lastStatus='편집 대상이 바뀌었습니다. 목록을 다시 열어 주세요.';status();return;}
     const ok=entry.kind.startsWith('bulletin')?await bulletin()?.restoreHandoff?.(entry.draft):await window.MINDEX_EDITOR_DRAFTS?.restoreDraft?.(entry.draft);
     if(ok)dialog?.close();
   };row.append(title,button);list.append(row);}
  }
  renderRows=rows;
  refreshButton.onclick=async()=>{await refresh();rows(true)};retry.onclick=async()=>{if(!core)await initialize();await flush();await refresh();rows()};close.onclick=()=>dialog.close();
  const details=document.createElement('details');details.append(element('summary','다른 기기 연결'));
  details.append(element('p','이 연결 코드를 다른 기기의 같은 화면에 붙여 넣으면 초안을 함께 사용할 수 있습니다. 코드를 가진 기기는 이 초안함에 접근할 수 있으니 본인 기기에만 전달하세요.'));
  const copy=element('button','연결 코드 복사');copy.type='button';copy.className='btn secondary';copy.onclick=async()=>{if(!core)return;try{await navigator.clipboard.writeText(JSON.stringify({mindexDraft:1,project,token}));lastStatus='연결 코드를 복사했습니다. 다른 기기에서 붙여 넣어 주세요.'}catch{lastStatus='연결 코드를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.'}status()};
  const input=document.createElement('textarea');input.placeholder='다른 기기에서 복사한 연결 코드';input.setAttribute('aria-label','다른 기기 연결 코드');input.autocomplete='off';
  const join=element('button','이 기기 연결');join.type='button';join.className='btn secondary';join.onclick=async()=>{
   try{const code=JSON.parse(input.value);if(code.mindexDraft!==1||code.project!==project||!/^[a-f0-9]{64}$/.test(code.token||''))throw Error('같은 프로젝트의 연결 코드를 확인해 주세요.');await connect(code.token);input.value='';lastStatus='기기를 연결했습니다. 기존 자료는 그대로 보존됩니다.';await flush();await refresh();rows()}catch(e){lastStatus=e.message}status();
  };details.append(copy,input,join);dialog.append(details);
  dialog.addEventListener('close',()=>{dialog?.remove();dialog=null;renderRows=null},{once:true});document.body.append(dialog);dialog.showModal();status();rows();
 }
 window.addEventListener('mindex-server-storage-ready',()=>void initialize());
 window.addEventListener('mindex-server-state-settled',status);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
 window.addEventListener('online',()=>{void flush();void refresh()});
 window.addEventListener('focus',()=>{void syncConnection();void refresh()});
 window.addEventListener('storage',event=>{if(event.key===tokenKey(project))void syncConnection()});
 window.addEventListener('beforeunload',event=>{if(core?.pending){event.preventDefault();event.returnValue=''}});
 window.MINDEX_DRAFT_HANDOFF={publish,open,refresh,flush,status};
 if(window.MINDEX_SERVER_STORAGE?.ready)void initialize();
})();
