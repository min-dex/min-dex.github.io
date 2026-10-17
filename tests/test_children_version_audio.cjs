const assert=require('node:assert/strict');
global.servicePraiseInputMode=item=>item.mode;
global.versionEffectivePraiseTypes=(song,version)=>version.types||[];
require('../mindex.song-timing.js');const T=global.MindexSongTiming;
(async()=>{
 const song={id:'song'},version={id:'version',types:['children'],_worshipVersionPersisted:true,lyric_signature:'source-hash',forms:[{id:'form',lyrics:'가사'}]};
 const slides=[{type:'lyrics',text:'가사',elementId:'item',syncTimeline:{legacy:true}}];
 const draft={audio:new Blob(['audio']),audioName:'track.wav',audioFingerprint:'sha',duration:10,starts:[2],enabled:true,forms:version.forms,sourceSignature:T.sourceSignature(version),lyricsFingerprint:T.fingerprint(slides)};
 let uploads=0,conflict=true,queries=[];
 global.PRESENTER_MEDIA_STORAGE_BUCKET='fixture';
 global.state={client:{storage:{from:()=>({upload:async()=>{uploads++;return{}},getPublicUrl:()=>({data:{publicUrl:'https://example.invalid/audio'}})})},from:table=>{
  assert.equal(table,'mindex_song_versions');const q={update(payload){assert.deepEqual(Object.keys(payload),['audio_set']);queries.push(['update',payload]);return q},eq(k,v){queries.push([k,v]);return q},is(k,v){queries.push([k,v]);return q},select:async()=>({data:conflict?[]:[{id:'version'}]})};return q;
 }}};
 version._audioSetSupported=false;await assert.rejects(T.saveToVersion(song,version,draft,slides),/DB 업데이트/);assert.equal(uploads,0);version._audioSetSupported=true;
 await assert.rejects(T.saveToVersion(song,version,draft,slides),/다른 곳/);assert.equal(version.audio_set,undefined);assert.equal(uploads,1);
 conflict=false;await T.saveToVersion(song,version,draft,slides);assert.equal(uploads,1);assert.equal(version.audio_set.audioUrl,'https://example.invalid/audio');assert.ok(queries.some(([k,v])=>k==='lyric_signature'&&v==='source-hash'));
 for(const mode of ['lyrics_db','score_db','manual_praise','audio_praise']){
  const item={id:'item',mode};const result=T.decorate(slides,item,song,version);
  assert.ok(result.every(s=>!s.syncTimeline),mode);assert.equal(T.audioFor(result,'item'),null,mode);
  assert.deepEqual(T.formsFor(item,song,version,['fallback']),['fallback']);
 }
 const item={id:'item',mode:'children_audio'},result=T.decorate(slides,item,song,version);
 assert.equal(result[0].syncTimeline.start,2);assert.equal(result[0].syncTimeline.lead,1);assert.equal(T.audioFor(result,'item').url,version.audio_set.audioUrl);
 assert.deepEqual(T.formsFor(item,song,version,[]),version.forms);
 const originalForms=version.audio_set.forms;
 version.audio_set.forms=[{id:'page',lyrics:'가\n사',audioSourceRange:[0,2]}];
 assert.equal(T.formsFor(item,song,version,[])[0].lyrics,'가\n사');
 version.audio_set.forms[0].lyrics='다른 가사';assert.deepEqual(T.formsFor(item,song,version,['fallback']),['fallback']);
 version.audio_set.forms[0]={_presenterBlank:true,lyrics:'hidden replacement'};assert.deepEqual(T.formsFor(item,song,version,['fallback']),['fallback']);
 version.audio_set.forms=originalForms;
 version.audio_set.enabled=false;assert.ok(!T.decorate(slides,item,song,version)[0].syncTimeline);
 version.audio_set.enabled=true;version.forms=[{id:'form',lyrics:'변경 가사'}];assert.ok(!T.decorate(slides,item,song,version)[0].syncTimeline);
 await assert.rejects(T.saveToVersion(song,version,draft,slides),/바뀌/);
 console.log('PASS version-owned CAS save/retry, audio-only mode gate, DB reload metadata, disabled/stale sets, unchanged fallback forms');
})().catch(e=>{console.error(e);process.exitCode=1});
