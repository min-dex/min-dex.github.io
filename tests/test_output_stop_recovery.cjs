const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('mindex.presenter-controller.js','utf8');
const start=source.indexOf('function stopPresenterOutput('),end=source.indexOf('\nfunction presenterStoppedPayload(',start);
for(const synchronized of [false,true]){
 const calls=[];
 const state={presenter:{channel:{postMessage(){throw Error('closed channel')}},serviceId:'service',slides:[{id:'ready',ready:true},{id:'song'}],index:1,outputGeneration:2,outputWindow:{closed:false},outputClientId:'client',outputSessionId:'session',liveScripture:{active:true,slide:{}},livePraise:{}},serviceMusic:{playing:true,mode:synchronized?'presenter-audio':'manual',sourceKey:'audio'}};
 const c=vm.createContext({state,Date,window:{},liveScriptureRequestSerial:0,presenterLaunchRequestSerial:0,MindexSongTiming:{ownsSource:()=>synchronized},isPresenterPreparationSlide:s=>s.ready,clearPresenterBoardSelection(){calls.push('selection')},emptyLivePraiseState:()=>({active:false}),stopServiceMusicPlayback(){calls.push('music');state.serviceMusic.playing=false},clearPresenterOutputVideoWarmup(){},stopPresenterOutputWindowMonitor(){calls.push('monitor')},closePresenterBrowserWindow(){calls.push('close')},presenterStoppedPayload:()=>({stopped:true}),publishPresenterPayload(){calls.push('publish')},refreshPresenterOutputConnectionState(){},renderPresenterControlState(){}});
 vm.runInContext(source.slice(start,end),c);
 assert.doesNotThrow(()=>c.stopPresenterOutput('service'),'Transport failure must not abort stop/reset');
 assert.equal(state.presenter.outputWindow,null);assert.equal(state.presenter.index,0);
 assert.equal(state.presenter.liveScripture.active,false);assert.equal(state.presenter.safetyBlank,false);
 assert.equal(c.liveScriptureRequestSerial,1);assert.equal(c.presenterLaunchRequestSerial,1);
 assert.equal(calls.filter(x=>x==='music').length,synchronized?1:0);
 for(const name of ['selection','monitor','close','publish'])assert.ok(calls.includes(name),name);
}
console.log('PASS closed-channel stop completes cancellation/reset/window close; synchronized audio stops and background music survives');
