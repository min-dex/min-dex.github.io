// Disposable committed-read cache. Never stores drafts or authorizes offline reads.
(function(root) {
  'use strict';
  const DB = 'mindex-native-read-cache-v1', STORE = 'snapshots', LIMIT = 64 * 1024 * 1024;
  const generations = new Map();
  const counters = {hits:0,misses:0,writes:0,failures:0};
  const signature = s => s?.protocol === 1 && s.phase === 'native' && s.idFormat === '4-4-4-4'
    && Number.isSafeInteger(s.recordCount) && s.recordCount > 0 && typeof s.epoch === 'string' && typeof s.manifest === 'string'
    ? JSON.stringify([s.protocol,s.idFormat,s.epoch,s.manifest,s.recordCount]) : null;
  async function hash(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function key(client) {
    if (!root.indexedDB || !root.crypto?.subtle || typeof client?.supabaseUrl !== 'string' || typeof client.supabaseKey !== 'string') return null;
    const url = new URL(client.supabaseUrl);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) return null;
    url.search = ''; url.hash = '';
    // Connection keys are never persisted in plaintext or emitted in diagnostics.
    return hash(url.href.replace(/\/$/,'')+'\n'+client.supabaseKey);
  }
  function access(id, mode, action) {
    return new Promise(resolve => {
      let db, finished = false;
      const done = value => { if (finished) return; finished=true; clearTimeout(timer); db?.close(); resolve(value); };
      const timer = setTimeout(()=>done(null),mode === 'readonly' ? 200 : 1000);
      let request;
      try { request=root.indexedDB.open(DB,1); } catch { done(null); return; }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onerror = request.onblocked = () => done(null);
      request.onsuccess = () => {
        db=request.result;
        if (finished) { db.close(); return; }
        db.onversionchange = () => db.close();
        try {
          const tx=db.transaction(STORE,mode), query=action(tx.objectStore(STORE),id);
          tx.oncomplete=()=>done({value:query?.result});
          tx.onerror=tx.onabort=()=>done(null);
        } catch { done(null); }
      };
    });
  }
  async function remove(client) {
    try {
      const id=await key(client); if (!id) return false;
      const token=(generations.get(id)||0)+1; generations.set(id,token);
      return !!await access(id,'readwrite',(store,k)=>{
        if (generations.get(k)!==token) { store.transaction.abort(); return null; }
        return store.delete(k);
      });
    } catch { return false; }
  }
  async function read(client,status) {
    let timer;
    const task=(async()=>{
      try {
        const expected=signature(status),id=await key(client);
        if (!expected || !id) return null;
        const result=await access(id,'readonly',(store,k)=>store.get(k));
        if (!result) { counters.failures++; return null; }
        const entry=result.value;
        if (entry?.schema !== 1 || entry.signature !== expected || typeof entry.body !== 'string' || entry.body.length > LIMIT) return null;
        const bytes=new TextEncoder().encode(entry.body);
        if (bytes.byteLength > LIMIT) return null;
        if (entry.digest !== await hash(bytes)) { void remove(client); return null; }
        const snapshot=JSON.parse(entry.body);
        if (signature(snapshot.status)!==expected || !Array.isArray(snapshot.records) || snapshot.records.length!==status.recordCount) { void remove(client); return null; }
        return snapshot;
      } catch { counters.failures++; return null; }
    })();
    const snapshot=await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),250)})]);
    clearTimeout(timer);
    if (snapshot) counters.hits++; else counters.misses++;
    return snapshot;
  }
  async function write(client,prepared) {
    try {
      const stamp=signature(prepared?.status),id=await key(client);
      if (!stamp || !id || !Array.isArray(prepared.records) || prepared.records.length!==prepared.status.recordCount) return false;
      const token=(generations.get(id)||0)+1; generations.set(id,token);
      const body=JSON.stringify({status:prepared.status,records:prepared.records});
      const bytes=new TextEncoder().encode(body);
      if (bytes.byteLength > LIMIT) return false;
      const digest=await hash(bytes);
      if (generations.get(id)!==token) return false;
      const result=await access(id,'readwrite',(store,k)=>{
        if (generations.get(k)!==token) { store.transaction.abort(); return null; }
        return store.put({schema:1,signature:stamp,body,digest},k);
      });
      if (result) counters.writes++; else counters.failures++;
      return !!result;
    } catch { counters.failures++; return false; }
  }
  const api=Object.freeze({read,write,remove,stats:()=>({...counters})});
  root.MindexCatalogCache=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof globalThis!=='undefined' ? globalThis : this);
