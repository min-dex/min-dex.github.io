const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
let metadata,versions,units,events,failUnits=false,unavailable=true;
const c=vm.createContext({console,state:{songs:[],client:{}},linkedSongLoadPromises:new Map(),isUuid:()=>true,
 songLookupMap:()=>new Map(c.state.songs.map(s=>[s.id,s])),songById:id=>c.state.songs.find(s=>s.id===id),
 normalizeServerSong:r=>({...r}),sortSongs:()=>0,clearSearchCaches:()=>{},isUnavailableRelationError:()=>unavailable,
 fetchSupabaseBatches:async(ids,fn)=>fn(ids),yieldToBrowser:async()=>{},
 fetchSupabasePaged:async(table)=>{events.push(table);if(table==='mindex_songs')return metadata.promise;if(table==='mindex_song_versions')return versions.promise;if(failUnits)throw Error('units failed');return units.promise},
 attachRelationalSongVersionRows:(v,u,ids)=>{assert.ok(c.state.songs.length,'must load metadata before publish');events.push('publish');for(const s of c.state.songs)if(ids.includes(s.id)){s._relationalVersionsLoaded=true;s.units=u}},
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../mindex.praise-storage.js'),'utf8'),c);
for(const name of ['loadSongsForIds','songNeedsRelationalHydration','loadMissingSongsForIds','loadRelationalSongVersionData','publishRelationalSongVersionData']){
 const re=new RegExp('(?:async )?function '+name+'\\(');const start=app.search(re);assert.ok(start>=0,name);
 vm.runInContext(app.slice(start,app.indexOf('\n}\n',start)+2),c);
}
const tick=()=>new Promise(r=>setImmediate(r));
const reset=()=>{metadata=deferred();versions=deferred();units=deferred();events=[];c.state.songs=[]};
(async()=>{
 reset();const one=c.loadSongsForIds(['s']);const two=c.loadSongsForIds(['s']);await tick();
 assert.equal(events.filter(x=>x==='mindex_songs').length,1,'deduplicate metadata');
 assert.equal(events.filter(x=>x==='mindex_song_versions').length,2,'parallel source/canonical lookups');
 versions.resolve([{id:'v',source_song_id:'s'}]);await tick();
 assert.ok(events.includes('mindex_version_units'),'units start before metadata finishes');
 units.resolve([{id:'u',version_id:'v'}]);await tick();assert.ok(!events.includes('publish'));
 metadata.resolve([{id:'s'}]);await Promise.all([one,two]);assert.equal(events.filter(x=>x==='publish').length,1);
 const count=events.length;await c.loadSongsForIds(['s']);assert.equal(events.length,count,'warm cache');
 reset();failUnits=true;const failed=c.loadSongsForIds(['s']);metadata.resolve([{id:'s'}]);versions.resolve([{id:'v',source_song_id:'s'}]);await failed;
 assert.ok(!c.state.songs[0]._relationalVersionsLoaded,'failed units must remain retryable');
 failUnits=false;units.resolve([{id:'u'}]);await c.loadSongsForIds(['s']);assert.ok(c.state.songs[0]._relationalVersionsLoaded);
 assert.equal(c.linkedSongLoadPromises.size,0);
 reset();delete c.state.songVersionTablesSupported;unavailable=false;failUnits=true;
 const transient=c.loadSongsForIds(['s']);metadata.resolve([{id:'s'}]);versions.resolve([{id:'v',source_song_id:'s'}]);
 await assert.rejects(transient,/units failed/,'network failure must reach the worship retry UI');
 assert.equal(c.state.songVersionTablesSupported,undefined,'temporary errors must not disable tables');
 assert.equal(c.linkedSongLoadPromises.size,0,'retry lock must clear');
 failUnits=false;units.resolve([{id:'u'}]);await c.loadSongsForIds(['s']);assert.ok(c.state.songs[0]._relationalVersionsLoaded);
 console.log('PASS parallel metadata/version/unit pipeline, publication barrier, deduplication, warm cache and retry');
})().catch(e=>{console.error(e);process.exitCode=1});
