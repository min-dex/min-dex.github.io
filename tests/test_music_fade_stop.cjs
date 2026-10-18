const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
function fixture() {
  let now=1000, id=0;
  const timers=new Map(), retired=[];
  const audio={paused:false,ended:false,currentTime:42,volume:.6,src:'a',pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},removeAttribute(){this.src=''}};
  const music={audio,playing:true,pending:false,volumeLevel:3,fadeStopEnabled:true,fadeStop:null,playSerial:0,sourceKey:'a',mode:'manual'};
  const c=vm.createContext({state:{serviceMusic:music,presenter:{},services:[]},Date:{now:()=>now},
    setInterval(fn){timers.set(++id,fn);return id},clearInterval(id){if(timers.has(id))retired.push(timers.get(id));timers.delete(id)},clearTimeout(){},
    renderPresenterControlState(){},updateServiceMusicTransportControls(){},serviceMusicSourceIsSlotOwned:()=>false,
    currentPresenterAudioContext:()=>({}),syncServiceMusicSyncedLyricsWithCurrentTime(){},showToast(){}});
  vm.runInContext(source.slice(source.indexOf('function getServiceMusicAudio()'),source.indexOf('function presenterSyncTimelineForSlide(')),c);
  return {c,music,audio,retired,tick(ms){now+=ms;[...timers.values()].forEach(fn=>fn())}};
}
(async()=>{
  let f=fixture();f.c.runServiceMusicAction('stop');assert.ok(f.music.fadeStop);assert.equal(f.audio.paused,false);
  f.tick(600);assert.ok(Math.abs(f.audio.volume-.3)<.001);assert.equal(f.audio.currentTime,42);
  f.c.getServiceMusicAudio();assert.ok(Math.abs(f.audio.volume-.3)<.001,'getter must not undo fade');
  f.c.setServiceMusicVolume(4);assert.ok(Math.abs(f.audio.volume-.4)<.001);
  f.tick(600);assert.equal(f.audio.paused,true);assert.equal(f.audio.currentTime,0);assert.equal(f.audio.volume,.8);assert.equal(f.music.fadeStop,null);
  await f.c.runServiceMusicAction('toggle');assert.equal(f.audio.paused,false);assert.equal(f.audio.volume,.8);
  f=fixture();f.music.fadeStopEnabled=false;f.c.runServiceMusicAction('stop');assert.equal(f.audio.paused,true);assert.equal(f.audio.currentTime,0);
  f=fixture();f.c.runServiceMusicAction('stop');f.tick(300);f.c.runServiceMusicAction('stop');assert.equal(f.audio.paused,true);assert.equal(f.audio.volume,.6);
  f=fixture();f.c.runServiceMusicAction('stop');f.tick(300);f.c.runServiceMusicAction('toggle');assert.equal(f.audio.paused,true);assert.equal(f.audio.currentTime,42);assert.equal(f.audio.volume,.6);f.tick(1500);assert.equal(f.audio.currentTime,42);
  f=fixture();f.c.runServiceMusicAction('stop');f.tick(300);f.c.setServiceMusicSource(f.audio,'b','manual');f.audio.paused=false;f.audio.currentTime=7;f.music.playing=true;f.retired.forEach(fn=>fn());f.tick(1500);assert.equal(f.audio.currentTime,7);assert.equal(f.audio.volume,.6);assert.equal(f.audio.paused,false);
  f=fixture();f.music.pending=true;f.c.runServiceMusicAction('stop');assert.equal(f.music.pending,false);assert.equal(f.music.fadeStop,null);assert.equal(f.audio.paused,true);
  f=fixture();f.c.runServiceMusicAction('stop');f.c.stopServiceMusicPlayback({clearSource:true});f.tick(1300);assert.equal(f.music.fadeStop,null);assert.equal(f.audio.volume,.6);assert.equal(f.audio.src,'');
  f=fixture();let resolve;f.audio.play=()=>new Promise(r=>resolve=r);f.c.resumeServiceMusicAfterInterruption();f.c.runServiceMusicAction('stop');f.tick(1200);resolve();await Promise.resolve();await Promise.resolve();assert.equal(f.music.playing,false);assert.equal(f.audio.paused,true);
  console.log('PASS fade timing, stop/pause/restart, volume, source replacement, stale timer, pending cancellation and output stop');
})().catch(e=>{console.error(e);process.exitCode=1});
