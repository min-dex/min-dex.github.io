const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const c = vm.createContext({console, Map, Set, WeakMap, state:{},
 WORSHIP_SERVICE_LIST_SELECT:'with-alias', WORSHIP_SERVICE_BASE_LIST_SELECT:'base', WORSHIP_EMERGENCY_TODAY_ONLY:false,
 writeStaticSupabaseCache:()=>{}, readStaticSupabaseCache:()=>null, readEmergencyWorshipServices:async()=>null,
 worshipServiceListQuery:q=>q});
for (const name of ['fetchWorshipServiceListRows','fetchWorshipRowsForServiceIds','loadServiceItems','servicePraiseSongMatchesLookupName']) {
 const start=source.search(new RegExp('(?:async )?function '+name+'\\('));
 assert.ok(start>=0,name);vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),c);
}
vm.runInContext('const servicePraiseLookupNamesCache = new WeakMap()',c);
(async()=>{
 let probes=0;
 c.detectTableColumnSupport=async()=>{probes++;return false};
 c.fetchWorshipServiceListViewRows=async()=>[];
 await c.fetchWorshipServiceListRows();
 assert.equal(probes,0,'even an empty successful view proves alias support');assert.equal(c.state.serviceAliasSupported,true);
 c.fetchWorshipServiceListViewRows=async()=>null;
 c.fetchSupabasePaged=async(table,select)=>{assert.equal(select,'base');return [{id:'legacy'}]};
 assert.equal((await c.fetchWorshipServiceListRows())[0].id,'legacy');assert.equal(probes,1);
 assert.equal(c.state.serviceAliasSupported,false,'old-schema fallback retained');
 c.fetchWorshipServiceListViewRows=async()=>{throw Error('offline')};
 c.state.serviceListViewSupported=true;c.readStaticSupabaseCache=()=>[{id:'cached'}];
 assert.equal((await c.fetchWorshipServiceListRows())[0].id,'cached');
 let normalizations=0;
 c.stripHymnNumber=x=>x;c.stripHymnNo=x=>({title:x});c.stripTitleDecorations=x=>x;
 c.normalizeTitle=x=>{normalizations++;return String(x||'').toLowerCase()};c.compactSearchValue=x=>String(x||'').replaceAll(' ','').toLowerCase();
 c.songServiceOptionLabel=s=>s.title;c.versionDisplayName=(_,v)=>v.name;
 const song={title:'Same Title',versions:[{name:'First'}]};
 const lookup=x=>[{lookup:x.toLowerCase(),compact:x.replaceAll(' ','').toLowerCase()}];
 assert.ok(c.servicePraiseSongMatchesLookupName(song,lookup('Same Title'),{titleOnly:true}));
 const calls=normalizations;
 assert.ok(c.servicePraiseSongMatchesLookupName(song,lookup('Same Title'),{titleOnly:true}));assert.equal(normalizations,calls);
 song.title='Changed';assert.ok(!c.servicePraiseSongMatchesLookupName(song,lookup('Same Title'),{titleOnly:true}));
 assert.ok(c.servicePraiseSongMatchesLookupName(song,lookup('First')));
 song.versions[0].name='Second';assert.ok(!c.servicePraiseSongMatchesLookupName(song,lookup('First')));assert.ok(c.servicePraiseSongMatchesLookupName(song,lookup('Second')));
 let reads=0,sourceReads=0,release;
 const aggregate={service:{id:'s',source_ref:{history:['preserved']}},sections:[],elements:[]};
 c.state={client:{},services:[{id:'s',_worshipSourceRefPartial:true}],loadedWorshipServiceIds:new Set(),dirty:{service:false},selectedServiceId:'s',module:'service',worshipSections:[],worshipElements:[],serviceItems:{}};
 c.serviceItemLoadPromises=new Map();c.worshipAtomicClient=async()=>({read:async()=>{reads++;await new Promise(r=>release=r);return aggregate}});
 c.sundayEditSyncHasLocalDraft=()=>false;c.normalizeWorshipService=s=>({id:s.id,_worshipSourceRef:s.source_ref,_worshipSourceRefPartial:false});
 c.loadFullServiceSourceRefInBackground=()=>sourceReads++;
 for(const name of ['captureCleanFingerprint','renderLoadingStatus','warmWorshipScriptureReferencesForService','warmServiceItemScriptureReferencesForService','renderCurrentServiceModuleDetail'])c[name]=()=>{};
 c.shouldDeferPastWorshipServiceLoad=()=>false;c.isServiceDataModule=()=>true;c.loadSongsForIds=async()=>{};
 c.projectWorshipServiceItemsFromTemplate=(_,items)=>items;c.groupWorshipElements=()=>({s:[]});
 const one=c.loadServiceItems('s'),two=c.loadServiceItems('s');
 await new Promise(r=>setImmediate(r));assert.equal(reads,1);assert.equal(sourceReads,0,'no redundant full-source read');release();await Promise.all([one,two]);
 assert.deepEqual(c.state.services[0]._worshipSourceRef,{history:['preserved']});assert.equal(c.state.services[0]._worshipSourceRefPartial,false);
 assert.ok(c.state.loadedWorshipServiceIds.has('s'));
 console.log('PASS view fast path, legacy/offline fallback, lookup cache invalidation, single aggregate read and full document adoption');
})().catch(e=>{console.error(e);process.exitCode=1});
