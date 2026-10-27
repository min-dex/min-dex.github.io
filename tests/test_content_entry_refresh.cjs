const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../mindex.single-song.js');
const single=globalThis.MindexSingleSong;
const record=(id,title)=>({id,revision:1,metadata:{title},content:{forms:[{id:'verse',lyrics:title}]}});
const a='SONG-CHLD-0001-0001',b='SONG-CHLD-0002-0001';
let flush,blocked=false,dirty=false,onRead=null,fail=false,reads=0,fullLoads=0,listReads=0,archiveReads=0,serviceReads=0;
const events={},db={},scheduled=[];
const state={module:'calendar',pageTabIndex:0,config:{url:'fixture'},dirty:{},cleanFingerprints:{},calendarData:[],
 songs:[],singleSongCatalog:null,singleSongRepository:null,serviceTypes:[],referenceLinks:[],scriptures:[],uiVerses:[],dirtyServiceTypeIds:new Set()};
const c={state,window:{addEventListener(n,fn){events[n]=fn}},document:{addEventListener(n,fn){events[n]=fn},querySelector(){return null}},
 Map,Set,JSON,console,structuredClone,setInterval(){},BroadcastChannel:class{},
 createLiveRefreshScheduler(p,f){flush=f;return delay=>scheduled.push(delay)},
 departmentRefreshBlocked:()=>blocked,hasDirtyChanges:()=>dirty,dirtyModuleFingerprint:()=>'',
 songLoadPromise:null,scriptureLoadPromise:null,referenceLinksLoadPromise:null,calendarLoadPromise:null,serviceDataLoadPromise:null,activeServiceSavePromise:null,
 pendingSundayEditSync:new Set(),CALENDAR_MIN_DATE:'2025-01-01',
 captureDetailViewportSnapshot:()=>({}),restoreDetailViewportSnapshot(){},refs:{detailPane:{querySelector:()=>null},songList:{scrollTop:37}},
 renderSongList(){},renderCalendarView(){},render(){},renderScriptureDetail(){},renderReferencesDetail(){},
 normalizeReferenceLink:r=>r,normalizeServerScripture:r=>r,extractUiVerses:()=>[],uiVerseSlot:()=>false,sortScriptures:(x,y)=>x.id.localeCompare(y.id),
 sortReferenceLinks:(x,y)=>x.id.localeCompare(y.id),sortSongs:(x,y)=>x.id.localeCompare(y.id),normalizeServerSong:r=>r,
 dirtyComparableValue:v=>v,clearSearchCaches(){},captureCleanFingerprint(){},isGlobalSearchActive:()=>false,isBibleTextSearchActive:()=>false,
 getSelectedScripture:()=>state.scriptures.find(r=>r.id===state.selectedScriptureId),
 getSelectedVersion:()=>state.songs.find(r=>r.id===state.selectedSongId)?.versions.find(v=>v.id===state.selectedVersionId),
 getPreferredVersionId:s=>s.versions[0].id,normalizeForms:x=>x,withLocalId:x=>x,
 isPresenterOutputRoute:()=>false,isSetlistArchiveView:()=>state.module==='setlists',createUuid:()=>String(Math.random()),
 connectDepartmentRealtime(){},showToast(){},
 fetchAllRows:async make=>({data:await make().range(0,999)}),
};
c.window.MINDEX_SERVICE_LIST_LIVE={invalidate(){},reconcile(){},async refresh(){listReads++;return true}};
c.window.MINDEX_ARCHIVE_LIVE={reconcile(){},async refresh(){archiveReads++;return true}};
c.window.MINDEX_SERVICE_ENTRY={async check(){serviceReads++;return true}};
c.client={from(table){const q={select(){return q},order(){return q},eq(){return q},gte(){return q},in(){return q},async range(){reads++;const value=structuredClone(db[table]||[]);if(onRead){const f=onRead;onRead=null;f()}if(fail)throw Error('offline');return {data:value}}};return q}};
c.fetchAllRows=async make=>make().range(0,999);state.client=c.client;
c.MindexSingleSong={...single,async loadActivation(){fullLoads++;const records=structuredClone(db.native);if(onRead){const f=onRead;onRead=null;f()}if(fail)throw Error('offline');return {phase:'native',records}}};
vm.createContext(c);vm.runInContext(fs.readFileSync('mindex.content-live.js','utf8'),c);
const live=c.window.MINDEX_CONTENT_LIVE;
async function enter(module){state.module=module;live.enter();await flush()}
(async()=>{
 db.mindex_sunday_calendar=[{id:'new-date',date:'2026-11-01',note:'new'}];
 await enter('calendar');assert.equal(state.calendarData[0].note,'new');assert.equal(c.refs.songList.scrollTop,37);
 db.mindex_sunday_calendar[0].note='return';await enter('calendar');assert.equal(state.calendarData[0].note,'return');
 for(const protect of ['blocked','dirty']){
  if(protect==='blocked')blocked=true;else dirty=true;
  const before=reads;db.mindex_sunday_calendar[0].note=protect;await enter('calendar');assert.equal(reads,before);assert.equal(state.calendarData[0].note,'return');
  blocked=dirty=false;await flush();assert.equal(state.calendarData[0].note,protect);
  state.calendarData[0].note='return';
 }
 db.mindex_sunday_calendar[0].note='race';onRead=()=>events.input();await enter('calendar');assert.equal(state.calendarData[0].note,'return');await flush();assert.equal(state.calendarData[0].note,'race');
 db.mindex_sunday_calendar[0].note='wrong page';onRead=()=>{state.module='manuals'};await enter('calendar');assert.equal(state.calendarData[0].note,'race');await flush();
 fail=true;await enter('calendar');assert.equal(state.calendarData[0].note,'race');fail=false;await flush();assert.equal(state.calendarData[0].note,'wrong page');
 db.mindex_reference_links=[{id:'ref',title:'fresh'}];await enter('references');assert.equal(state.referenceLinks[0].title,'fresh');
 db.mindex_scriptures=[{id:'scripture',title:'fresh'}];await enter('scripture');assert.equal(state.scriptures[0].title,'fresh');
 for(const module of ['home','service','presenter','bulletin'])await enter(module);
 assert.equal(listReads,4);state.selectedServiceId='service';await enter('service');assert.equal(serviceReads,1);state.selectedServiceId=null;
 await enter('setlists');assert.equal(archiveReads,1);
 state.singleSongRepository={read:async ids=>db.native.filter(record=>ids.includes(record.id))};state.singleSongCatalog=single.createCatalog([record(a,'old')]);state.songs=[state.singleSongCatalog.appSong(a)];
 state.selectedSongId=state.selectedVersionId=a;db.native=[record(a,'updated'),record(b,'added')];
 await enter('praise');assert.equal(state.songs.length,2);assert.equal(state.songs[0].title,'updated');assert.equal(state.forms[0].lyrics,'updated');assert.equal(state.singleSongCatalog.get(b).metadata.title,'added');
 db.native=[record(a,'updated')];await enter('praise');assert.equal(state.songs.length,1,'remove deleted non-selected song');
 db.native=[record(b,'only other')];await enter('praise');assert.equal(state.selectedSongId,a);assert.equal(state.songs.find(s=>s.id===a).title,'updated','retain deleted open record');
 db.native=[record(a,'racing')];onRead=()=>{dirty=true};await enter('praise');assert.equal(state.songs.find(s=>s.id===a).title,'updated');dirty=false;await flush();assert.equal(state.songs[0].title,'racing');
 const before=fullLoads;events.focus();await flush();assert(fullLoads>before,'window focus refreshes catalog');
 const targeted=fullLoads;live.receive({id:'saved-native',project:'fixture',kind:'song',recordId:a});await flush();
 assert.equal(fullLoads,targeted,'saved notification must not reload entire native catalog');
 state.singleSongRepository=null;state.singleSongCatalog=null;state.selectedSongId=state.selectedVersionId=null;
 db.mindex_songs=[{id:'legacy',title:'legacy refreshed',versions:[]}];await enter('praise');assert.equal(state.songs[0].title,'legacy refreshed');
 assert(scheduled.includes(15000),'failed read keeps retry backoff');
 const app=fs.readFileSync('app.js','utf8');
 assert.match(app.slice(app.indexOf('function runModuleEntryLoads('),app.indexOf('let songLoadContext')),/MINDEX_CONTENT_LIVE\?\.enter\(\)/);
 assert.match(app.slice(app.indexOf('async function applyBrowserHistorySnapshot('),app.indexOf('function readConfig(')),/MINDEX_CONTENT_LIVE\?\.enter\(\)/);
 console.log('PASS entry/tab/focus refresh, all routes, native membership, protected deferral, input/navigation races, failure retention and scroll');
})().catch(e=>{console.error(e);process.exitCode=1});
