const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const audio={paused:false,ended:false,currentTime:8,src:'shared.wav',volume:1,pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},removeAttribute(){this.src=''}};
 const music={audio,playing:true,pending:false,mode:'presenter-audio',sourceKey:'shared.wav',timingGroupId:'first',ownerServiceId:'service',playSerial:0,volumeLevel:5};
 const slide=(id,group,start)=>({id,elementId:group,type:'lyrics',syncTimeline:{groupId:group,audioSrc:'shared.wav',start,lead:0,localTiming:true}});
 const state={serviceMusic:music,presenter:{serviceId:'service',index:0,slides:[slide('a','first',2),slide('b','first',6),slide('c','second',2),slide('d','second',6)],liveScripture:{}},module:'presenter',selectedServiceId:'service'};
 const c=vm.createContext({state,Date,Audio:function(){},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},normalizePresenterMediaSource:s=>String(s||''),presenterSlideIsHidden:s=>!!s.hiddenInPresentation,presenterSlideAudioSource:s=>s?.syncTimeline?.audioSrc||'',presenterFileDisplayTitle:()=>'',presenterFileTypeLabel:()=>'',presenterPlaybackConfig:p=>p||{},clampPresenterIndex:i=>i,syncSelectedServiceItemToPresenterSlide(){},publishPresenterState(){},renderPresenterControlState(){},scrollPresenterBoardToIndexStable(){},updateServiceMusicTransportControls(){},showToast(){},serviceMusicSourceIsSlotOwned:()=>false,currentPresenterAudioContext:()=>({})});
 vm.runInContext(fs.readFileSync('mindex.presenter-live.js','utf8'),c);
 return {c,state,music,audio};
}
(async()=>{
 for(const mutation of [f=>{f.state.presenter.index=2},f=>{f.music.ownerServiceId='other-service'},f=>{f.audio.paused=true},f=>{f.audio.ended=true},f=>{f.music.pending=true}]){
  const f=fixture();mutation(f);const before=f.state.presenter.index;
  assert.equal(f.c.syncServiceMusicSyncedLyricsWithCurrentTime(),false,'A different occurrence/owner or inactive audio must not drive slides');
  assert.equal(f.state.presenter.index,before);
 }
 let f=fixture();assert.equal(f.c.syncServiceMusicSyncedLyricsWithCurrentTime(),true);assert.equal(f.state.presenter.index,1);
 f=fixture();f.c.suspendServiceMusicAutoSync();assert.equal(f.c.syncServiceMusicSyncedLyricsWithCurrentTime(),false);assert.equal(f.audio.currentTime,8);assert.equal(f.audio.paused,false);
 f=fixture();let settle;f.audio.play=()=>new Promise(r=>settle=r);f.music.playing=false;
 const pending=f.c.runServiceMusicAction('toggle');const serial=f.music.playSerial;
 f.c.stopServiceMusicPlayback({render:false});settle();await pending;
 assert.equal(f.music.playing,false);assert.equal(f.music.pending,false);assert.equal(f.audio.paused,true);assert.ok(f.music.playSerial>serial);
 f=fixture();let old;f.audio.play=()=>new Promise(r=>old=r);f.music.playing=false;
 const oldPlay=f.c.runServiceMusicAction('toggle');
 f.c.setServiceMusicSource(f.audio,'new.wav','presenter-audio');old();await oldPlay;
 assert.equal(f.music.sourceKey,'new.wav');assert.equal(f.music.playing,false);assert.equal(f.music.pending,false);
 console.log('PASS occurrence/service ownership, paused/ended/pending gates, manual navigation, stop/source-switch late play completion');
})().catch(e=>{console.error(e);process.exitCode=1});
