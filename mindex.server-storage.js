// Only connection identity is bootstrapped in browser storage. App values use RPC.
(() => {
 const shared=new Set(['mindex.worshipBackgroundRegistry','mindex.theme','mindex.music.fadeStop']);
 const refreshing=new Set(),refreshWanted=new Set();
 const ephemeral=new Map(),queued=new Map(),failures=new Map(),writers=new Map();
 let connection=null,ready=false,timer=null,flushing=null,stores=null,initializing=null,live=null,refreshTimer=null,localChannel=null;
 let recoveryTimer=null,recoveryAttempts=0,retrying=null;
 const recoveryDelays=[1000,4000,12000];
 const temporaryFailure=error=>/57014|PGRST003|timeout|timed out|statement timeout|failed to fetch|network|offline|fetch failed|connection.*(?:closed|reset)|AbortError/i.test([error?.code,error?.name,error?.message].filter(Boolean).join(' '));
 const category=id=>/mindex\.atomic\./.test(id)?'예배 저장 복구 정보':/mindex\.editor\.draft\./.test(id)?'편집 초안':/mindex\.bulletin\./.test(id)?'주보 초안·복구본':/mindex\.worshipRecovery/.test(id)?'예배 복구본':/mindex\.(?:ui\.|theme|music\.|presenter\.)/.test(id)?'화면·재생 설정':'앱 보관 정보';
 function recoverableIds(){
  const conflicts=new Set(Object.entries(stores||{}).flatMap(([name,store])=>store.conflictKeys().map(key=>name+':'+key)));
  return new Set([...failures].filter(([id,error])=>!conflicts.has(id)&&temporaryFailure(error)).map(([id])=>id));
 }
 function scheduleRecovery(){
  if(!failures.size){if(recoveryTimer!==null)clearTimeout(recoveryTimer);recoveryTimer=null;recoveryAttempts=0;return}
  if(!ready||recoveryTimer!==null||retrying||recoveryAttempts>=recoveryDelays.length||!recoverableIds().size)return;
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return;
  if(document.hidden)return;
  const captured=connection;
  recoveryTimer=setTimeout(()=>{recoveryTimer=null;if(connection!==captured)return;recoveryAttempts++;void retry({automatic:true}).catch(()=>{});},recoveryDelays[recoveryAttempts]);
 }
 const transient=key=>/^(mindex\.(?:bible\.|supabase\.static\.|serviceListView\.missingUntil$)|mindex\.monitor\.tab\.)/.test(key);
 const transport=key=>/^mindex\.presenter\.(?:state(?:\.navigation)?|signal)$/.test(key);
 const recoveryKey=key=>key.replace('mindex.presenter.state','mindex.presenter.recovery');
 const namespace=(scope,key)=>shared.has(key)?'shared':scope==='session'?'session':'device';
 const entryId=(scope,key)=>namespace(scope,key)+':'+key;
 const pending=()=>queued.size>0||failures.size>0||writers.size>0||Object.values(stores||{}).some(s=>s.pending);
 function status(){
  let node=document.getElementById('serverStorageStatus');
  // Routine background persistence is silent; failures still require action.
  if(!failures.size){if(node){node.hidden=true;node.textContent='';node._storageStatusSignature=null}return}
  if(!node){node=document.createElement('div');node.id='serverStorageStatus';node.setAttribute('role','status');document.body.append(node);}
  node.hidden=false;
  const conflict=Object.entries(stores||{}).flatMap(([name,store])=>store.conflictKeys().map(key=>({name,key})))[0];
  const kinds=[...new Set([...failures.keys()].map(category))].join(', ');
  const text=conflict?`${category(conflict.name+':'+conflict.key)}의 내용이 다른 창의 저장본과 다릅니다. 양쪽 내용을 확인해 주세요.`:`${kinds}: 서버에 보관하지 못한 내용이 있습니다. 현재 화면을 유지해 주세요.`;
  const signature=JSON.stringify([text,conflict?.name,conflict?.key]);
  // A background write must not replace the focused retry/review button.
  if(node._storageStatusSignature===signature)return;
  node._storageStatusSignature=signature;node.textContent=text;
  if(conflict){const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent='충돌 확인';button.onclick=()=>void reviewConflict(conflict.name,conflict.key);node.append(button);return}
  if(failures.size){const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent='다시 보관';button.onclick=()=>void retry();node.append(button)}
 }
 let reviewing=false;
 async function reviewConflict(name,key){
  if(reviewing)return;reviewing=true;
  const captured=connection,store=stores[name],id=name+':'+key,queuedBefore=queued.get(id);
  let dialog;
  try{
   await Promise.allSettled([...writers.values()]);
   const review=await store.reviewConflict(key);
   const localValue=queuedBefore?queuedBefore.value:review.local;
   const archiveKey='mindex.state.recovery.v1:'+crypto.randomUUID();
   const archiveValue=JSON.stringify({schema:1,key,...review,queued:localValue,savedAt:Date.now()});
   if(connection!==captured)return;
   dialog=document.createElement('dialog');dialog.className='server-conflict-review';
   const title=document.createElement('h2');title.textContent='보관 중인 내용 확인';dialog.append(title);
   const note=document.createElement('p');
   const atomic=/^mindex\.atomic\./.test(key);
   note.textContent=atomic?'양쪽 요청을 보관한 뒤 서버 요청을 확인합니다. 편집 입력은 유지됩니다. 이후 예배 저장에서 이전 요청의 결과를 확인해 주세요.':'양쪽 내용을 별도로 보관한 뒤 사용할 저장본을 선택합니다. 편집창의 입력은 바뀌지 않습니다.';dialog.append(note);
   for(const [label,value] of [['이 창의 보관 요청',localValue],['서버 보관본',review.current]]){
    const field=document.createElement('label');field.textContent=label;
    const input=document.createElement('textarea');input.readOnly=true;input.value=value??'(비어 있음)';field.append(input);dialog.append(field);
   }
   const errorText=document.createElement('p');errorText.setAttribute('role','alert');dialog.append(errorText);
   const actions=document.createElement('div');actions.className='server-conflict-actions';dialog.append(actions);
   const add=(label,choice)=>{const button=document.createElement('button');button.className='btn secondary';button.type='button';button.textContent=label;actions.append(button);
    button.onclick=async()=>{
     if(choice===null){dialog.close();return}
     for(const b of actions.children)b.disabled=true;
     try{
      if(connection!==captured||writers.has(id)||queued.get(id)!==queuedBefore)throw Error('새 입력이 있어 다시 확인해 주세요.');
      await setItem('local',archiveKey,archiveValue);
      if(connection!==captured||writers.has(id)||queued.get(id)!==queuedBefore)throw Error('새 입력이 있어 현재 내용을 유지했습니다.');
      await store.resolveConflict(review,choice,localValue);
      if(queued.get(id)===queuedBefore)queued.delete(id);
      failures.delete(id);announce(name);status();dialog.close();
      window.dispatchEvent?.(new Event('mindex-server-state-settled'));
     }catch(error){errorText.textContent=error.message==='STATE_CONFLICT_CHANGED'?'다른 창에서 내용이 다시 바뀌었습니다. 취소 후 충돌 내용을 다시 확인해 주세요.':'보관을 완료하지 못했습니다. 현재 내용은 유지됩니다. 연결을 확인한 뒤 다시 시도해 주세요.';for(const b of actions.children)b.disabled=false}
    };
   };
   add('취소',null);add(atomic?'서버 요청 확인':'서버 보관본 유지','current');if(!atomic)add('이 창의 보관 요청 사용','local');
   dialog.addEventListener('close',()=>{dialog.remove();reviewing=false},{once:true});document.body.append(dialog);dialog.showModal();
  }catch(error){if(dialog)dialog.remove();reviewing=false;failures.set(id,error);status()}
  finally{if(!dialog)reviewing=false}
 }
 function getItem(scope,key,fallback=null){
  if(transport(key))return ephemeral.get(key)??(ready&&key!=='mindex.presenter.signal'?stores.device.getItem(recoveryKey(key)):null)??fallback;
  if(transient(key))return ephemeral.get(key)??fallback;
  if(!ready)return fallback;
  return stores[namespace(scope,key)].getItem(key)??fallback;
 }
 function canSkipEmptyWrite(scope,key){
  if(!ready)return false;
  const name=namespace(scope,key),id=entryId(scope,key),store=stores[name];
  return !writers.has(id)&&!queued.has(id)&&!failures.has(id)&&!store.pendingKeys().includes(key)
   &&!refreshing.has(name)&&store.getItem(key)===null;
 }
 function setItem(scope,key,value){
  if(transient(key)){value===null?ephemeral.delete(key):ephemeral.set(key,String(value));return Promise.resolve(true);}
  if(!ready)return Promise.reject(Error('SERVER_STORAGE_NOT_READY'));
  const captured=connection,store=stores[namespace(scope,key)],id=entryId(scope,key);
  // Serialize one key while allowing independent preferences/drafts to proceed.
  const previous=writers.get(id)||Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
   if(connection!==captured)throw Error('SERVER_STORAGE_PROJECT_CHANGED');
   if(store.pendingKeys().includes(key))await store.retry(key);
   await store.setItem(key,typeof value==='function'?value(store.getItem(key)):value);failures.delete(id);
   announce(namespace(scope,key));
   return true;
  }).catch(error=>{failures.set(id,error);throw error}).finally(()=>{
   if(writers.get(id)===task)writers.delete(id);status();scheduleRecovery();
   for(const scope of refreshWanted)if(!stores[scope].pending)void refreshScope(scope);
   window.dispatchEvent?.(new Event("mindex-server-state-settled"));
  });
  writers.set(id,task);status();return task;
 }
 function announce(scope){
  try{localChannel?.postMessage({scope})}catch{}
  if(scope==='shared'){try{void live?.send({type:'broadcast',event:'changed',payload:{}}).catch(()=>{})}catch{}}
 }
 function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;void flush()},300)}
 function queue(scope,key,value){
  if(typeof key!=='string'||!key)return false;
  if(transport(key)){
   value===null?ephemeral.delete(key):ephemeral.set(key,String(value));
   if(ready&&key!=='mindex.presenter.signal')queue('local',recoveryKey(key),value);
   return true;
  }
  if(transient(key)){void setItem(scope,key,value);return true;}
  if(!ready)return false;
  queued.set(entryId(scope,key),{scope,key,value});status();schedule();
  return true; // Dispatch acceptance only. Never use this as a save receipt.
 }
 function flush(allowedIds=null){
  if(flushing)return flushing;
  const batch=[...queued].filter(([id])=>!allowedIds||allowedIds.has(id));
  flushing=(async()=>{
   for(const [id,entry] of batch){
    try{await setItem(entry.scope,entry.key,entry.value);if(queued.get(id)===entry)queued.delete(id)}catch{}
   }
  })().finally(()=>{
   flushing=null;status();
   // New edits get another pass. Unchanged failures use bounded recovery or
   // explicit retry/online, never an endless flush loop.
   if([...queued].some(([id,entry])=>(!allowedIds||allowedIds.has(id))&&!batch.some(([oldId,old])=>id===oldId&&entry===old)))schedule();
  });
  return flushing;
 }
 function retry({automatic=false}={}){
  if(retrying)return retrying;
  retrying=retryPending(automatic).finally(()=>{retrying=null;scheduleRecovery()});
  return retrying;
 }
 async function retryPending(automatic){
  if(!ready)throw Error('SERVER_STORAGE_NOT_READY');
  if(flushing)await flushing;
  await Promise.allSettled([...writers.values()]);
  const allowed=automatic?recoverableIds():null,failed=new Set();
  for(const [name,store] of Object.entries(stores))for(const key of store.pendingKeys()){
   const id=name+':'+key;
   if(allowed&&!allowed.has(id))continue;
   try{await store.retry(key);failures.delete(id);announce(name)}catch(error){failures.set(id,error);failed.add(id)}
  }
  // Do not replay a timed-out journal twice in one retry pass.
  const dispatch=new Set([...queued.keys()].filter(id=>(!allowed||allowed.has(id))&&!failed.has(id)));
  await flush(dispatch);status();
  window.dispatchEvent?.(new Event("mindex-server-state-settled"));
  return !pending();
 }
 async function refreshScope(scope){
  if(!ready)return;
  if(refreshing.has(scope)||stores[scope].pending){refreshWanted.add(scope);return}
  const captured=connection,previous=JSON.stringify(stores[scope].keys().map(key=>[key,stores[scope].getItem(key)]));
  refreshing.add(scope);refreshWanted.delete(scope);
  try{
   await stores[scope].load();
   if(connection!==captured)return;
   if(previous!==JSON.stringify(stores[scope].keys().map(key=>[key,stores[scope].getItem(key)])))window.dispatchEvent?.(new Event('mindex-server-'+scope+'-updated'));
  }catch{}finally{refreshing.delete(scope)}
 }
 function initialize(client,project,{legacyProject,prepare}={}){
  if(connection?.client===client&&connection.project===project){
   if(ready)return Promise.resolve();
   if(initializing)return initializing;
  }
  if(pending())return Promise.reject(Error('SERVER_STORAGE_UNSAVED_CHANGES'));
  localChannel?.close();localChannel=null;
  if(live){void connection.client.removeChannel?.(live);live=null}
  if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null}
  ready=false;stores=null;ephemeral.clear();connection={client,project};const captured=connection;
  initializing=(async()=>{
   const {createServerState}=await import(`./mindex.server-state.mjs?v=${encodeURIComponent(window.MINDEX_RELEASE||'server-state')}`);
   const identityKey='mindex.server.identity:'+project;
   let token=localStorage.getItem(identityKey);
   if(!/^[a-f0-9]{64}$/.test(token||'')){
    token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(identityKey,token);
   }
   const sessionKey='mindex.server.session:'+project;
   let session=sessionStorage.getItem(sessionKey);
   if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(session||'')){
    session=crypto.randomUUID();sessionStorage.setItem(sessionKey,session);
   }
   const rpc=(name,args)=>client.rpc(name,args);
   const next=Object.fromEntries(['shared','device','session'].map(name=>[name,createServerState({rpc,token,scope:name==='session'?'session:'+session:name})]));
   await Promise.all(Object.values(next).map(s=>s.load()));
   if(connection!==captured)throw Error('SERVER_STORAGE_PROJECT_CHANGED');
   let migrationSummary={confirmed:[],retained:[],archived:[]};
   if(legacyProject){
    const {legacyStateDestination,migrateLegacyState}=await import(`./mindex.legacy-state.mjs?v=${encodeURIComponent(window.MINDEX_RELEASE||'server-state')}`);
    const entries=[];
    for(const [scope,source] of [['local',localStorage],['session',sessionStorage]]){
     for(let i=0;i<source.length;i++){
      const key=source.key(i);
      if(legacyStateDestination(scope,key,project))entries.push({scope,key,value:source.getItem(key)});
     }
    }
    const migration=await migrateLegacyState({entries,project,legacyProject,stores:next,prepare});
    if(migration.failed.length){
     const reasons=[...new Set(migration.failed.map(entry=>/^[A-Z][A-Z0-9_]{2,80}$/.test(entry.reason)?entry.reason:'MIGRATION_FAILED'))];
     throw Error('LEGACY_STATE_MIGRATION_PENDING: '+reasons.join(', '));
    }
    migrationSummary=migration;
   }
   if(connection!==captured)throw Error('SERVER_STORAGE_PROJECT_CHANGED');
   stores=next;ready=true;status();
   if(document.body.dataset){
    document.body.dataset.serverStateReady='true';
    document.body.dataset.serverStateMigrated=String(migrationSummary.confirmed.length);
    document.body.dataset.serverStateRetained=String(migrationSummary.retained.length);
    document.body.dataset.serverStateArchived=String(migrationSummary.archived.length);
   }
   try{
    localChannel=new BroadcastChannel('mindex-server-state:'+project);
    localChannel.onmessage=event=>{
     if(['shared','device'].includes(event.data?.scope))void refreshScope(event.data.scope);
    };
   }catch{}
   window.dispatchEvent?.(new Event("mindex-server-storage-ready"));
   if(client.channel){
    try{live=client.channel('mindex-app-settings-v1').on('broadcast',{event:'changed'},()=>void refreshScope('shared')).subscribe()}catch{live=null}
    refreshTimer=setInterval(()=>{if(!document.hidden)void refreshScope('shared')},60000);
   }
  })().finally(()=>{if(connection===captured)initializing=null});
  return initializing;
 }
 // Journal reads must fail closed: an unloaded mirror cannot mean "no retry".
 const journal={getItem:key=>{if(!ready)throw Error('SERVER_STORAGE_NOT_READY');return getItem('local',key)},
  setItem:(key,value)=>setItem('local',key,value),removeItem:key=>setItem('local',key,null)};
 window.addEventListener('beforeunload',event=>{if(pending()){event.preventDefault();event.returnValue=''}});
 window.addEventListener('online',()=>{if(ready)void retry()});
 window.MINDEX_SERVER_STORAGE={initialize,keys:scope=>ready?stores[namespace(scope,'')].keys():[],getItem,canSkipEmptyWrite,setItem,updateItem:(scope,key,update)=>setItem(scope,key,update),queue,flush,retry,journal,get ready(){return ready},get pending(){return pending()}};
})();
