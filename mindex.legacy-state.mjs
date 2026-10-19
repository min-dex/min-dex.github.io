// Receives only caller-filtered application entries; never reads browser credentials.
const shared=new Set(['mindex.worshipBackgroundRegistry','mindex.theme','mindex.ui.presenterThumbScale','mindex.music.fadeStop']);
export function legacyStateDestination(scope,key,project){
 if(shared.has(key))return 'shared';
 if(/^mindex\.atomic\.pending\.v2:/.test(key)||/^mindex\.department\.pending\.v1:/.test(key)){
  try{if(JSON.parse(key.slice(key.indexOf(':')+1))[0]!==project)return null}catch{return null}
  return 'device';
 }
 if(key.startsWith('mindex.atomic.creation.v1:'))return key.startsWith('mindex.atomic.creation.v1:'+project+':')?'device':null;
 if(!/^(?:mindex\.ui\.|mindex\.pageTabs\.v1$|mindex\.worshipRecoverySnapshot(?:s\.v1$|\.latest\.v1\.)|mindex\.worship\.edit-sync\.v1$|mindex\.presenter\.(?:targetScreen\.v1|alwaysOnTop(?:\.v1)?)$|mindex\.bulletin\.(?:v1:|profiles:|template:|recovery:)|mindex\.monitor\.name$)/.test(key))return null;
 return scope==='session'?'session':'device';
}
export async function migrateLegacyState({entries,project,legacyProject,stores,prepare=async entry=>entry.value}){
 const result={confirmed:[],retained:[],failed:[]};
 // An unlabelled old browser snapshot must not silently enter another project.
 if(!project||legacyProject!==project){result.retained=entries.map(entry=>({key:entry.key,reason:'PROJECT_UNKNOWN'}));return result}
 const checked=[];
 for(const entry of entries){
  const destination=legacyStateDestination(entry.scope,entry.key,project),store=stores[destination];
  if(!store){result.retained.push({key:entry.key,reason:'UNSUPPORTED_OR_PRIVATE_KEY'});continue}
  if(typeof entry.value!=='string'){result.retained.push({key:entry.key,reason:'INVALID_VALUE'});continue}
  try{
   // Tombstones count as existing records: migration must not resurrect a deletion.
   if(store.keys().includes(entry.key)){
    result.retained.push({key:entry.key,reason:'SERVER_RECORD_EXISTS'});continue;
   }
   const value=await prepare(entry);
   if(typeof value!=='string')throw Error('MIGRATION_VALUE_REQUIRED');
   if(store.pendingKeys().includes(entry.key))await store.retry(entry.key);
   // Retrying an uncertain prior migration may have populated this record.
   if(store.keys().includes(entry.key)&&store.getItem(entry.key)!==value)throw Error('MIGRATION_CHANGED_DURING_RETRY');
   await store.setItem(entry.key,value);
   checked.push({scope:entry.scope,key:entry.key,original:entry.value,value,destination});
  }catch(error){result.failed.push({key:entry.key,reason:error.message||'MIGRATION_FAILED'})}
 }
 // Independent read-back, not optimistic memory, establishes migration success.
 for(const destination of new Set(checked.map(entry=>entry.destination))){
  const matches=checked.filter(entry=>entry.destination===destination),store=stores[destination];
  try{
   await store.load();
   for(const entry of matches){
    if(store.getItem(entry.key)!==entry.value)result.failed.push({key:entry.key,reason:'MIGRATION_READBACK_CHANGED'});
    else result.confirmed.push(entry);
   }
  }catch(error){for(const entry of matches)result.failed.push({key:entry.key,reason:error.message||'MIGRATION_READBACK_FAILED'})}
 }
 // Source removal is deliberately separate: caller must compare the original
 // again so an edit made during upload cannot be deleted by migration cleanup.
 return result;
}
export function retireConfirmedLegacyState(result,storageForScope){
 const removed=[];
 for(const entry of result.confirmed){
  const source=storageForScope(entry.scope);
  if(source.getItem(entry.key)!==entry.original)continue;
  source.removeItem(entry.key);removed.push(entry.key);
 }
 return removed;
}
