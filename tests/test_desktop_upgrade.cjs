// Disposable TEST installation only; all records and credentials are synthetic.
const { _electron }=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function main(){
 const [exe,proof,phase,sha,version]=process.argv.slice(2);
 assert(['seed','restart','upgrade'].includes(phase));
 let record=phase==='seed'?{token:crypto.randomBytes(16).toString('hex'),rows:{}}:JSON.parse(fs.readFileSync(proof));
 const originalRows=JSON.stringify(record.rows);
 let restoring=false;
 const app=await _electron.launch({executablePath:path.resolve(exe),env:{...process.env,MINDEX_ISOLATED_TEST:'1',MINDEX_TEST_PROFILE_TOKEN:record.token}});
 try {
  const native=await app.evaluate(({app})=>({profile:app.getPath('userData'),version:app.getVersion(),isolation:globalThis.__mindexTestIsolation,packaged:app.isPackaged}));
  assert(native.packaged&&native.isolation.networkBlocked);
  assert.equal(native.version,version);
  const expected=path.join(fs.realpathSync(os.tmpdir()),'mindex-isolated-upgrade-'+record.token,'userData');
  assert.equal(native.profile,expected);
  if(record.profile)assert.equal(record.profile,native.profile);
  const page=await app.firstWindow();
  await page.waitForFunction(()=>typeof fetchWorshipServiceListRows==='function'&&!!window.MINDEX_SERVER_STORAGE);
  const info=await page.evaluate(()=>window.mindexElectron.getBuildInfo());
  assert(info.testBuild || info.build.channel === "internal");assert.equal(info.build.sourceCommit,sha);
  let bundledAudio = null;
  let previewCacheContract = null;
  let preciseAudio = null;
  if(phase==='upgrade'){
   previewCacheContract=await page.evaluate(()=>{
    const source='https://fixture.supabase.co/storage/v1/object/public/media/loop.mp4?keep=value';
    const slide={backgroundVideo:source};const before=JSON.stringify(slide);
    const preview=presenterBackgroundVideoPreviewSource(source);
    if(preview!==source+'&mindexPreview=1'||presenterBackgroundVideoPreviewSource(preview)!==preview)throw Error('Installed preview cache key mismatch');
    if(presenterSlideBackgroundVideoSource(slide,true)!==source||JSON.stringify(slide)!==before)throw Error('Installed output source changed');
    for(const other of ['relative.mp4','https://example.invalid/video.mp4?keep=value','https://fixture.supabase.co/storage/v1/object/sign/media/loop.mp4?token=synthetic']){
     if(presenterBackgroundVideoPreviewSource(other)!==other)throw Error('Installed non-public source changed');
    }
    return {stablePreviewKey:true,canonicalOutput:true,slideUnchanged:true,nonPublicUnchanged:true};
   });
   assert(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>w.webContents.isAudioMuted())));
   bundledAudio=await page.evaluate(async()=>{
    const url=new URL('./assets/presenter/dawn-free-prayer-f9ebf1aeed23.mp3',location.href);
    if(url.protocol!=='file:')throw Error('Installed audio must use the bundled local protocol');
    const audio=new Audio();audio.muted=true;audio.preload='metadata';
    let timer;
    const waitFor=(event)=>new Promise((resolve,reject)=>{
     audio.addEventListener(event,resolve,{once:true});
     audio.addEventListener('error',()=>reject(Error('Bundled MP3 error '+audio.error?.code)),{once:true});
    });
    try{
     return await Promise.race([(async()=>{
      const ready=waitFor('loadedmetadata');audio.src=url.href;audio.load();await ready;
      const duration=audio.duration;
      if(Math.abs(duration-3169.543625)>0.1)throw Error('Bundled MP3 duration mismatch');
      const progressing=waitFor('timeupdate');await audio.play();await progressing;
      if(audio.paused||audio.currentTime<=0||!audio.muted)throw Error('Bundled MP3 did not advance muted');
      const progressed=audio.currentTime;
      const seeking=waitFor('seeked');audio.currentTime=duration-2;await seeking;
      if(Math.abs(audio.currentTime-(duration-2))>0.5)throw Error('Bundled MP3 end seek failed');
      const emptied=waitFor('emptied');audio.pause();audio.removeAttribute('src');audio.load();await emptied;
      // Chromium retains the last currentSrc after emptied; selected source and decoder state are authoritative.
      if(!audio.paused||audio.hasAttribute('src')||audio.readyState!==audio.HAVE_NOTHING||![audio.NETWORK_EMPTY,audio.NETWORK_NO_SOURCE].includes(audio.networkState))throw Error('Bundled MP3 was not released '+JSON.stringify({paused:audio.paused,src:audio.getAttribute('src'),currentSrc:audio.currentSrc,ready:audio.readyState,network:audio.networkState}));
      return {protocol:url.protocol,duration,progressed,seekedNearEnd:true,muted:true,released:true};
     })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bundled MP3 acceptance timeout')),30000);})]);
    }finally{clearTimeout(timer);audio.pause();audio.removeAttribute('src');audio.load();}
   });
   preciseAudio=await page.evaluate(async fingerprints=>{
    let timer;try{return await Promise.race([(async()=>{
    const source=SERVICE_SLOT_MUSIC['dawn.free'].source;
    if(!source.endsWith('dawn-free-prayer-f9ebf1aeed23.mp3'))throw Error('Installed dawn default is stale');
    const audio=MindexPreciseAudio.attach(new Audio());audio.muted=true;
    try {
     const ready=new Promise((resolve,reject)=>{audio.addEventListener('loadedmetadata',resolve,{once:true});audio.addEventListener('error',()=>reject(Error('Precise local source failed')),{once:true});});
     audio.src=new URL(source,location.href).href;audio.load();await ready;
     const transport=await audio.mindexPreciseAudio.prepare();
     if(!transport||transport.decoder.calibration.score<=.995)throw Error('Packaged precise transport unavailable');
     const correlations=[];
     for(const anchor of fingerprints.anchors){
      const part=await transport.decoder.chunk(Math.floor(anchor.time/transport.decoder.chunkSeconds));
      const start=Math.round((anchor.time-part.start)*fingerprints.sampleRate);
      const left=part.buffer.getChannelData(0),right=part.buffer.getChannelData(1);
      let dot=0,actualPower=0,referencePower=0;
      anchor.samples.forEach((expected,k)=>{const at=start+k*anchor.stride,actual=(left[at]+right[at])/2;dot+=actual*expected;actualPower+=actual*actual;referencePower+=expected*expected;});
      const correlation=dot/Math.sqrt(actualPower*referencePower);
      if(!(correlation>.995))throw Error('Packaged PCM position mismatch at '+anchor.time);
      correlations.push({time:anchor.time,correlation});
     }
     return {localSource:true,defaultSource:source,calibration:transport.decoder.calibration.score,correlations};
    }finally{audio.pause();audio.removeAttribute('src');audio.load();}
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Installed precise audio timeout')),60000);})]);}finally{clearTimeout(timer);}
   },JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/prayer-audio-timing-fingerprints.json'),'utf8')));
  }
  await page.exposeFunction('fixtureRpc',(name,args)=>{
   if(args.p_key==='mindex.ui.presenterThumbScale')assert.equal(args.p_scope,'device');
   const scope=args.p_scope==='shared'?'shared':args.p_scope+':'+args.p_token;
   const rows=record.rows[scope]||{};
   if(name==='mindex_state_read_v1')return {data:Object.values(rows),error:null};
   assert.equal(name,'mindex_state_write_v1');assert(phase==='seed'||restoring,'Readback must not mutate saved records');
   assert.equal(args.p_revision,'0');assert(!rows[args.p_key]);
   const row={key:args.p_key,value:args.p_value,revision:'1',requestId:args.p_request_id};
   (record.rows[scope]||= {})[row.key]=row;return {data:row,error:null};
  });
  const data=await page.evaluate(async seed=>{
   const service={id:'fixture-worship',service_date:'2026-11-04',service_alias:'설치 보존 시험'};
   const client=window.supabase.createClient('https://fixture.invalid','fixture-public-id',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async (url,options)=>{
    if(!String(url).includes('/rest/v1/mindex_worship_service')||(options?.method||'GET')!=='GET')throw Error('Unexpected fixture request');
    return new Response(JSON.stringify([service]),{status:200,headers:{'Content-Type':'application/json'}});
   }}});
   state.client=client;
   const storage=window.MINDEX_SERVER_STORAGE;
   await storage.initialize({rpc:(name,args)=>window.fixtureRpc(name,args)},'upgrade-fixture');
   const draft={schema:1,module:'service',id:service.id,value:{service,items:[{id:'synthetic-item',raw_title:'저장 전 제목\n원문 보존 & < >',raw_body:'가상 내용\n두 번째 줄'}],serviceTypes:[]},fields:[]};
   const values={
    'mindex.editor.draft.v2:service:fixture-worship:rehearsal':JSON.stringify(draft),
    'mindex.editor.recovery.v1:service:fixture-worship:rehearsal':JSON.stringify({schema:1,module:'service',id:service.id,draft,current:{service,items:[],serviceTypes:[]},createdAt:'2026-11-04T00:00:00.000Z'}),
    'mindex.theme':'dark','mindex.music.fadeStop':'true','mindex.ui.presenterThumbScale':'1.5'
   };
   if(seed)for(const [key,value]of Object.entries(values))await storage.setItem('local',key,value);
   const actual=Object.fromEntries(Object.keys(values).map(key=>[key,storage.getItem('local',key)]));
   for(const key in values)if(actual[key]!==values[key])throw Error('Raw fixture mismatch: '+key);
   if(readPresenterThumbScale()!=='1.5')throw Error('Controller scale recovery mismatch');
   const restored=JSON.parse(actual[Object.keys(values)[0]]);
   if(restored.value.items[0].raw_body!==draft.value.items[0].raw_body)throw Error('Draft text recovery mismatch');
   return {worship:await fetchWorshipServiceListRows(),values:actual,recoveredText:restored.value.items[0].raw_body,identity:localStorage.getItem('mindex.server.identity:upgrade-fixture')};
  },phase==='seed');
  assert.equal(data.identity.length,64);
  if(phase==='seed'){
   record={...record,profile:native.profile,data,hashes:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,hash(v)]))};
   fs.writeFileSync(proof,JSON.stringify(record,null,2));
  }else{
   assert.deepEqual(data,record.data);assert.equal(JSON.stringify(record.rows),originalRows);
   assert.deepEqual(Object.fromEntries(Object.entries(data).map(([k,v])=>[k,hash(v)])),record.hashes);
  }
  const beforeRestore=structuredClone(record.rows);
  restoring=true;
  page.once('dialog',dialog=>dialog.accept());
  const restored=await page.evaluate(async()=>{
   const key='mindex.editor.draft.v2:service:fixture-worship:rehearsal';
   const draft=JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',key));
   Object.assign(state,{module:'service',selectedServiceId:draft.id,services:[draft.value.service],serviceItems:{[draft.id]:[]},serviceTypes:[]});
   state.dirty.service=false;
   const ok=await MINDEX_EDITOR_DRAFTS.restoreDraft(draft);
   if(!ok)throw Error('Real draft restore rejected');
   return {items:state.serviceItems[draft.id],dirty:state.dirty.service};
  });
  const draft=JSON.parse(record.data.values['mindex.editor.draft.v2:service:fixture-worship:rehearsal']);
  assert.deepEqual(restored.items,draft.value.items);assert(restored.dirty);
  for(const [scope,rows]of Object.entries(beforeRestore))for(const [key,row]of Object.entries(rows))assert.deepEqual(record.rows[scope][key],row);
  console.log(JSON.stringify({phase,source:sha,version,profile:native.profile,appId:'kr.mindex.app.test',networkBlocked:true,restoredByApp:true,bundledAudio,previewCacheContract,preciseAudio,hashes:record.hashes,valueHashes:Object.fromEntries(Object.entries(data.values).map(([k,v])=>[k,hash(v)]))}));
 }finally{
  // Test teardown discards only the recovered synthetic editor, not persisted records.
  for(const page of app.windows())await page.close({runBeforeUnload:false});
  await app.close();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
