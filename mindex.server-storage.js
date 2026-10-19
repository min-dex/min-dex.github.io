// Only connection identity is bootstrapped in browser storage. App values use RPC.
(() => {
 const shared=new Set(['mindex.worshipBackgroundRegistry','mindex.theme','mindex.ui.presenterThumbScale','mindex.music.fadeStop']);
 const refreshing=new Set(),refreshWanted=new Set();
 const ephemeral=new Map(),queued=new Map(),failures=new Map(),writers=new Map();
 let connection=null,ready=false,timer=null,flushing=null,stores=null,initializing=null,live=null,refreshTimer=null,localChannel=null;
 const transient=key=>/^(mindex\.(?:bible\.|supabase\.static\.|serviceListView\.missingUntil$)|mindex\.monitor\.tab\.)/.test(key);
 const transport=key=>/^mindex\.presenter\.(?:state(?:\.navigation)?|signal)$/.test(key);
 const recoveryKey=key=>key.replace('mindex.presenter.state','mindex.presenter.recovery');
 const namespace=(scope,key)=>shared.has(key)?'shared':scope==='session'?'session':'device';
 const entryId=(scope,key)=>namespace(scope,key)+':'+key;
 const pending=()=>queued.size>0||failures.size>0||writers.size>0||Object.values(stores||{}).some(s=>s.pending);
 function status(){
  let node=document.getElementById('serverStorageStatus');
  if(!node){node=document.createElement('div');node.id='serverStorageStatus';node.setAttribute('role','status');document.body.append(node);}
  node.hidden=!pending();
  node.textContent=failures.size?'서버에 보관하지 못한 내용이 있습니다. 연결을 확인하고 이 화면을 유지해 주세요.':pending()?'변경 내용 서버 보관 중…':'';
  if(failures.size){const button=document.createElement('button');button.type='button';button.textContent='다시 보관';button.onclick=()=>void retry();node.append(button)}
 }
 function getItem(scope,key,fallback=null){
  if(transport(key))return ephemeral.get(key)??(ready&&key!=='mindex.presenter.signal'?stores.device.getItem(recoveryKey(key)):null)??fallback;
  if(transient(key))return ephemeral.get(key)??fallback;
  if(!ready)return fallback;
  return stores[namespace(scope,key)].getItem(key)??fallback;
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
   if(writers.get(id)===task)writers.delete(id);status();
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
 function flush(){
  if(flushing)return flushing;
  const batch=[...queued];
  flushing=(async()=>{
   for(const [id,entry] of batch){
    try{await setItem(entry.scope,entry.key,entry.value);if(queued.get(id)===entry)queued.delete(id)}catch{}
   }
  })().finally(()=>{
   flushing=null;status();
   // An edit arriving during a request needs another pass; unchanged failures
   // wait for explicit retry/online and must not cause an endless retry loop.
   if([...queued].some(([id,entry])=>!batch.some(([oldId,old])=>id===oldId&&entry===old)))schedule();
  });
  return flushing;
 }
 async function retry(){
  if(!ready)throw Error('SERVER_STORAGE_NOT_READY');
  await Promise.allSettled([...writers.values()]);
  for(const [name,store] of Object.entries(stores))for(const key of store.pendingKeys()){
   const id=name+':'+key;
   try{await store.retry(key);failures.delete(id);announce(name)}catch(error){failures.set(id,error)}
  }
  await flush();status();
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
    if(migration.failed.length)throw Error('LEGACY_STATE_MIGRATION_PENDING');
   }
   if(connection!==captured)throw Error('SERVER_STORAGE_PROJECT_CHANGED');
   stores=next;ready=true;status();
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
 window.MINDEX_SERVER_STORAGE={initialize,getItem,setItem,updateItem:(scope,key,update)=>setItem(scope,key,update),queue,flush,retry,journal,get ready(){return ready},get pending(){return pending()}};
})();
