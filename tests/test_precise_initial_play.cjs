const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Media extends EventTarget {
 constructor(){super();this.src='test.mp3';this.seconds=NaN;this.stopped=true;this.plays=0;}
 getAttribute(){return this.src} get currentTime(){return 0} set currentTime(v){}
 get duration(){return this.seconds} get paused(){return this.stopped} get ended(){return false} get seeking(){return false} get error(){return null}
 play(){this.plays++;this.stopped=false;return Promise.resolve()} pause(){this.stopped=true}
}
const scope={HTMLMediaElement:Media,AudioContext:class{resume(){return new Promise(()=>{})}},fetch(){throw Error('short clip must not download')},Event,DOMException,AbortController,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mindex.mp3-transport.js','utf8'),scope);
(async()=>{
 const a=scope.MindexPreciseAudio.attach(new Media());const pending=a.play();
 a.dispatchEvent(new Event('emptied'));a.seconds=255;a.dispatchEvent(new Event('loadedmetadata'));
 await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('first play remained pending')),100))]);
 assert.equal(a.plays,1);assert.equal(a.paused,false);
 const b=scope.MindexPreciseAudio.attach(new Media());const cancelled=b.play();b.pause();b.seconds=255;b.dispatchEvent(new Event('loadedmetadata'));
 await assert.rejects(cancelled,{name:'AbortError'});assert.equal(b.plays,0);
 console.log('PASS late short metadata + queued emptied plays once; explicit pause still cancels');
})().catch(e=>{console.error(e);process.exitCode=1});
