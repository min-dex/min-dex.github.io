const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {configureTestIsolation}=require('../electron/test-isolation');
test('test isolation is opt-in, rejects real packages and blocks before renderer startup',async()=>{
 assert.equal(configureTestIsolation({}, {}, {}),null);
 assert.throws(()=>configureTestIsolation({}, {}, {MINDEX_ISOLATED_TEST:'1'}),/test package/);
 const paths={},listeners={};let intercept;
 const app={setPath:(k,v)=>paths[k]=v,commandLine:{appendSwitch(){}},whenReady:()=>Promise.resolve(),on:(k,f)=>listeners[k]=f};
 const session={defaultSession:{webRequest:{onBeforeRequest:(_filter,f)=>intercept=f},setPermissionRequestHandler(f){this.permission=f},setPermissionCheckHandler(f){this.check=f}}};
 const state=configureTestIsolation({app,session},{mindexTestBuild:true},{MINDEX_ISOLATED_TEST:'1'});
 try{assert.equal(Object.keys(paths).length,4);assert.ok(Object.values(paths).every(p=>p.startsWith(state.profile)));await Promise.resolve();assert(state.networkBlocked);intercept({},result=>assert.equal(result.cancel,true));assert.equal(state.blockedRequests,1);assert.equal(session.defaultSession.check(),false);let muted=false;listeners['web-contents-created']({}, {setAudioMuted:v=>muted=v,setWindowOpenHandler:f=>assert.equal(f().action,'deny'),on(){}});assert(muted);}finally{fs.rmSync(state.profile,{recursive:true,force:true});}
});
