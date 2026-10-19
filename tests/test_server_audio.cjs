const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
(async()=>{
 let manifest='{}',fail=true,uploads=0;
 global.MINDEX_SERVER_STORAGE={ready:true,getItem:()=>manifest,setItem:async(scope,key,value)=>{if(fail)throw Error('offline');manifest=value}};
 global.MINDEX_SERVER_STORAGE.updateItem=(scope,key,update)=>global.MINDEX_SERVER_STORAGE.setItem(scope,key,update(manifest));
 global.state={client:{storage:{from:()=>({upload:async()=>{uploads++;return {error:null}},getPublicUrl:path=>({data:{publicUrl:'https://media.fixture/'+path}})})}}};
 require('../mindex.song-timing.js');let T=global.MindexSongTiming;
 const slides=[{type:'lyrics',text:'First'},{type:'lyrics',text:'Second'}],audio=new Blob(['fixture audio']);
 const profile={key:'fixture',audio,audioName:'fixture.wav',audioFingerprint:createHash('sha256').update(Buffer.from(await audio.arrayBuffer())).digest('hex'),lyricsFingerprint:T.fingerprint(slides),duration:20,starts:[1,8],enabled:true};
 await assert.rejects(T.save({...profile,audioFingerprint:'wrong'},slides),/지문/);assert.equal(uploads,0);
 await assert.rejects(T.save(profile,slides),/offline/);
 assert.equal(uploads,1);assert.ok(profile.audioUrl);assert.equal(T.ownsSource(profile.audioUrl),false);
 fail=false;await T.save(profile,slides);assert.equal(uploads,1,'retry must retain uploaded immutable URL');assert.equal(T.ownsSource(profile.audioUrl),true);
 const record=JSON.parse(manifest).fixture;assert.equal(record.audio,undefined);assert.equal(record.audioBytes,undefined);assert.deepEqual(record.starts,[1,8]);
 delete require.cache[require.resolve('../mindex.song-timing.js')];require('../mindex.song-timing.js');T=global.MindexSongTiming;
 assert.equal(T.ownsSource(profile.audioUrl),false);await T.initializeServerProfiles();assert.equal(T.ownsSource(profile.audioUrl),true);
 console.log('PASS audio fingerprint validation, immutable upload reuse after failed metadata save, confirmed activation and server-only reload');
})().catch(error=>{console.error(error);process.exitCode=1});
