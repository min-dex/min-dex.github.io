import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { keynoteHtmlFrameBridge } from '../mindex.keynote-html-engine.mjs';

function fixture() {
 const messages=[], handlers=new Map(), tracks=[];let tick;
 class Track extends EventTarget {
  constructor(src){super();Object.assign(this,{src,currentSrc:src,currentTime:0,duration:6,paused:true,ended:false,isConnected:true,readyState:4,seeking:false,plays:0});tracks.push(this)}
  play(){this.paused=false;this.plays++;return Promise.resolve()}
  pause(){this.paused=true}
  removeAttribute(){this.src=''}load(){}
 }
 const e={state:'IdleAtInitialState',currentSceneIndex:0,currentSlideIndex:0,nextSceneIndex:1,advances:0,previous:0,
  script:{numScenes:3,slideList:['a','b'],events:[{effects:[]},{effects:[]},{effects:[]}]},scriptManager:{slideIndexFromSceneIndex:n=>n>1?1:0},
  advanceToNextBuild(){this.advances++;this.state='IdleAtFinalState';this.currentSlideIndex=this.nextSceneIndex>1?1:0;return true},
  goBackToPreviousBuild(){this.previous++;this.state='IdleAtInitialState';this.currentSceneIndex=Math.max(0,this.currentSceneIndex-1);this.nextSceneIndex=this.currentSceneIndex+1;},
  jumpToScene(n){this.currentSceneIndex=n;this.currentSlideIndex=n>1?1:0;this.nextSceneIndex=n===2?-1:n+1;this.state='IdleAtInitialState';this.onJump?.()},
  changeState(state){this.state=state},playCurrentScene(){this.state='Playing'}};
 const parent={postMessage:message=>messages.push(message)}, token='00000000-0000-4000-8000-000000000000';
 const context=vm.createContext({HTMLMediaElement:Track,window:{__mindexKeynoteController:e},parent,document:{querySelectorAll:()=>tracks.filter(x=>x.isConnected)},addEventListener:(name,fn)=>handlers.set(name,fn),setInterval:fn=>{tick=fn;return 1},clearInterval(){},setTimeout,clearTimeout,Promise,Map,Set,Date,Error,JSON,Number});
 vm.runInContext(`(${keynoteHtmlFrameBridge.toString()})(${JSON.stringify(token)})`,context);
 const send=async(request,source=parent,overrideToken=token)=>{handlers.get('message')({source,data:{type:'mindex-keynote-html-command',token:overrideToken,request}});await new Promise(setImmediate)};
 return {e,Track,tracks,messages,send,tick:()=>tick(),ready:()=>tick(),close:()=>handlers.get('pagehide')()};
}
test('opaque frame commands require parent/token and immutable receipts prevent replay',async()=>{
 const f=fixture();f.ready();
 await f.send({id:'next-0001',action:'next'},{});await f.send({id:'next-0001',action:'next'},undefined,'wrong');assert.equal(f.e.advances,0);
 await f.send({id:'next-0001',action:'next'});assert.equal(f.e.advances,1);
 await f.send({id:'next-0001',action:'next'});assert.equal(f.e.advances,1);assert.equal(f.messages.filter(x=>x.kind==='ack').length,2);
 await f.send({id:'previous1',action:'previous'});assert.equal(f.e.previous,1);assert.equal(f.messages.at(-1).accepted,true);
 f.close();
});
test('hold/resume excludes media paused by the native engine and ended media',async()=>{
 const f=fixture(),a=new f.Track('a.mp4');await a.play();assert.equal(a.plays,0);f.ready();
 await f.send({id:'play-0001',action:'play'});assert.equal(a.plays,1);a.pause();
 const b=new f.Track('b.mp4');await b.play();await f.send({id:'pause0001',action:'pause'});await f.send({id:'play-0002',action:'play'});
 assert.equal(a.plays,1);assert.equal(b.plays,2);
 b.ended=true;b.dispatchEvent(new Event('ended'));await f.send({id:'pause0002',action:'pause'});await f.send({id:'play-0003',action:'play'});assert.equal(b.plays,2);f.close();
});
test('restore final effect uses its canonical successor and awaits the current video position',async()=>{
 const f=fixture(),old=new f.Track('same.mp4');await old.play();let current;
 f.e.onJump=()=>{old.isConnected=false;current=new f.Track('same.mp4');void current.play()};f.ready();
 await f.send({id:'restore01',action:'restore',checkpoint:{scene:0,phase:'final',slide:0,nextScene:1,media:[{src:'same.mp4',time:1.25,paused:false,resume:true}]}});
 assert.equal(f.e.currentSceneIndex,1);assert.equal(f.e.advances,0);assert.equal(current.currentTime,1.25);assert.equal(current.paused,true);assert.equal(old.currentTime,0);
 const ack=f.messages.findLast(x=>x.kind==='ack');assert.equal(ack.checkpoint.media.find(x=>x.time===1.25)?.paused,true);
 await f.send({id:'resume001',action:'play'});assert.equal(current.plays,1);assert.equal(old.plays,0);f.close();
});

test('status reconnect cancels an old queued next instead of dispatching it later',async()=>{
 const f=fixture();f.ready();f.e.state='Playing';
 await f.send({id:'queued001',action:'next'});
 await f.send({id:'status001',action:'status'});
 f.e.state='IdleAtInitialState';await new Promise(resolve=>setTimeout(resolve,70));
 assert.equal(f.e.advances,0);assert.ok(f.messages.some(x=>x.kind==='ack'&&x.id==='status001'));
 await f.send({id:'fresh0001',action:'next'});assert.equal(f.e.advances,1);f.close();
});

test('terminal native scene retains the last page when Apple reports slide minus one',()=>{
 const f=fixture();f.ready();f.e.script.events[2].effects=[{type:'transition'}];Object.assign(f.e,{currentSceneIndex:2,nextSceneIndex:-1,currentSlideIndex:-1,state:'IdleAtFinalState'});f.tick();
 const value=f.messages.findLast(x=>x.kind==='checkpoint').checkpoint;assert.equal(value.atEnd,true);assert.equal(value.terminalTransition,true);assert.equal(value.slide,1);f.close();
});
