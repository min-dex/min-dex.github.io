const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root='./';const source=fs.readFileSync(root+'app.js','utf8')+'\n'+fs.readFileSync(root+'mindex.praise-storage.js','utf8');
function fn(name){const re=new RegExp('(?:async )?function '+name+'\\(');const start=source.search(re);assert.ok(start>=0);const tail=source.slice(start);const next=tail.slice(1).search(/\n(?:async )?function \w+\(/);return next<0?tail:tail.slice(0,next+1);}
function env(){let release;const response=new Promise(r=>release=r);const q={update(){return q},upsert(){return q},eq(){return q},is(){return q},select(){return q},order(){return q},single(){return response}};q.then=(yes,no)=>response.then(yes,no);
 const state={saving:false,client:{from:()=>q},config:{url:'fixture'},cleanFingerprints:{},forms:[],dirty:{scripture:true,references:true,song:true},scriptures:[{id:'s',title:'title',text:'first'}],referenceLinks:[{id:'r',title:'first',url:'https://example.org'}]};
 const c={state,structuredClone,mergeEditorDraft,dirtyComparableValue:x=>x,dirtyModuleFingerprint:()=>JSON.stringify(state.referenceLinks),window:{},requireClient:()=>true,updateSaveState:()=>{},showToast:()=>{},render:()=>{},captureCleanFingerprint:()=>{},getSelectedScripture:()=>state.scriptures[0],normalizeServerScripture:x=>x,sortScriptures:()=>0,normalizeReferenceLink:x=>({...x}),sortReferenceLinks:()=>0,normalizeReferenceUrl:x=>x,nullIfBlank:x=>x||null,referenceUrlIsValid:()=>true,referenceTableErrorMessage:e=>e.message};vm.createContext(c);return {c,state,release};}
let mergeEditorDraft;
(async()=>{
 ({mergeEditorDraft}=await import('../mindex.draft-merge.mjs'));
 let e=env();vm.runInContext(fn('saveScripture'),e.c);let pending=e.c.saveScripture();e.state.scriptures[0].text='typed while saving';e.release({data:{id:'s',title:'title',text:'first'}});await pending;
 assert.equal(e.state.scriptures[0].text,'typed while saving');assert.equal(e.state.dirty.scripture,true);console.log('PASS scripture late input retained');
 e=env();vm.runInContext(fn('saveReferenceLinks'),e.c);pending=e.c.saveReferenceLinks();e.state.referenceLinks[0].title='typed while saving';e.release({data:[{id:'r',title:'first',url:'https://example.org'}]});await pending;assert.equal(e.state.referenceLinks[0].title,'typed while saving');assert.equal(e.state.dirty.references,true);console.log('PASS references late input retained');
 e=env();const song={id:'song',title:'first',memo:null,scripture:[],metadata:{},versions:[]};e.state.cleanFingerprints.praise=JSON.stringify({song});const initial=structuredClone(song);e.state.client.rpc=(name)=>name==='get_praise_snapshot_v1'?Promise.resolve({data:{song:initial}}):new Promise(resolve=>{e.release=resolve});Object.assign(e.c,{praisePendingSaves:new WeakMap(),createUuid:()=> 'request',praiseSnapshotSong:x=>x.song,praiseSaveComparable:x=>JSON.stringify(x),getSelectedSong:()=>song,normalizeSongMetadata:x=>x,hasPromotedSongMetadataColumns:()=>false,hasSongColumn:()=>false,aggregateSongPraiseTypes:()=>[],saveSongRelationsIfAvailable:async()=>false,cleanSongTitleForSave:s=>s.title,serializeSongMemo:()=>null,normalizeServerSong:x=>x,clearSearchCaches:()=>{},cleanList:()=>[]});vm.runInContext(fn('saveSongMeta').replace(/const \{ mergeEditorDraft \} = await import\([^;]+;/g,'') ,e.c);pending=e.c.saveSongMeta(song);await new Promise(setImmediate);song.title='typed while saving';e.release({data:{snapshot:{song:{...initial,title:'first',memo:null}}}});await pending;assert.equal(song.title,'typed while saving');assert.equal(e.state.dirty.song,true);console.log('PASS praise late input retained');
 for(const name of ['restoreServiceSourceHistory','restoreServiceSourceRecovery']){
 const textarea={value:'new unsaved source',isConnected:true,dispatchEvent:()=>{}};let confirms=0,archives=0;const c={createUuid:()=> 'fixture',state:{config:{url:'fixture'},selectedServiceId:'s',services:[{id:'s'}]},serviceSourceTextareaForService:()=>textarea,serviceDocumentHistoryFromRef:()=>[{sourceText:'old source'}],latestWorshipRecoverySnapshotForService:()=>({}),serviceDocumentFromRecoverySnapshot:()=>({sourceText:'old source'}),showToast:()=>{},Event,window:{confirm:()=>{confirms++;return true}},persistServerValue:()=>{archives++}};
 vm.createContext(c);vm.runInContext(fn('restoreServiceSourceText')+'\n'+fn(name),c);await c[name]('s',0);assert.equal(textarea.value,'old source');assert.equal(confirms,1);assert.equal(archives,1);console.log('PASS '+name+': confirm and archive before replace');
 textarea.value='  unsaved\n';c.window.confirm=()=>false;
 assert.equal(await c[name]('s',0),false);assert.equal(textarea.value,'  unsaved\n');
 c.window.confirm=()=>true;c.persistServerValue=async()=>{throw Error('offline')};
 assert.equal(await c[name]('s',0),false);assert.equal(textarea.value,'  unsaved\n');
 let resume;c.persistServerValue=()=>new Promise(resolve=>resume=resolve);
 const restoring=c[name]('s',0);textarea.value='newest input';resume();
 assert.equal(await restoring,false);assert.equal(textarea.value,'newest input');

 }
})().catch(error=>{console.error(error);process.exitCode=1});
