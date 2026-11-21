import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import * as engine from '../mindex.keynote-html-engine.mjs';
import test from 'node:test';
const hash = async value => Buffer.from(await webcrypto.subtle.digest('SHA-256',value)).toString('hex');
const sourceHash='a'.repeat(64);
const contents={'assets/player/main.js':Buffer.from('fixture'),'assets/header.json':Buffer.from('{}'),'assets/slide/thumbnail.jpeg':Buffer.from('thumb')};
const entries=Object.fromEntries(await Promise.all(Object.entries(contents).map(async ([name,bytes])=>[name,{size:bytes.length,sha256:await hash(bytes)}])));
const manifest={format:'apple-keynote-html-v1',sourceSha256:sourceHash,pages:1,scenes:1,slides:[{thumbnail:'assets/slide/thumbnail.jpeg',sceneStart:0,scenes:1}],files:entries};
contents['manifest.json']=Buffer.from(JSON.stringify(manifest));
async function run(mode){
 const scenario=mode.replace("large-", ""), large=mode.startsWith("large-");
 const data={...contents}, videoName="assets/포함영상.mp4";let video;
 if(large){video=Buffer.alloc(50*1024*1024+17,7);const m=structuredClone(manifest);m.files[videoName]={size:video.length,sha256:await hash(video)};data[videoName]=video;data["manifest.json"]=Buffer.from(JSON.stringify(m));}
 const memo={userMemo:'preserved',offeringVariants:{praise:{value:'unchanged'}},asset:{kind:'file',original:{format:'key',name:'original.key',sha256:sourceHash,url:'https://example.test/original.key'},custom:'preserved'}};
 let item={id:'item',memo:JSON.stringify(memo),title:'keep-title',lyrics:'keep-lyrics',form:'V-C',timing:[1,2]};
 const state={client:{},config:{url:'https://example.test'},selectedServiceId:'service',dirty:{service:false}};
 let uploads=[],removed=[],saves=0,toasts=[];const stored=new Map();
 const bucket={getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}}),upload:async (path,file)=>{uploads.push(path);assert(file.size<=50*1024*1024,'bucket object limit');if(scenario==='race'&&uploads.length===1)item.title='user-edited-during-upload';if(scenario==='storage-failure'&&path.endsWith('part-2.bin'))return {error:Error('fixture storage failure')};if(large)stored.set(path,new Uint8Array(await file.arrayBuffer()));return {};},remove:async paths=>{removed.push(...paths);return {};}};
 state.client.storage={from:()=>bucket};
 const context=vm.createContext({console,window:{MINDEX_RELEASE:'test',confirm:()=>true},state,crypto:webcrypto,TextDecoder,Uint8Array,URL,Map,Set,Error,JSON,Number,Promise,
 getServiceItems:()=>{if(scenario==='projection')item=structuredClone(item);return [item]},parseServiceItemMemo:value=>JSON.parse(value),normalizeServiceAsset:value=>value||{},serializeServiceItemMemo:value=>JSON.stringify(value),
 showToast:(...args)=>toasts.push(args),presenterPptxImports:new Set(),PRESENTER_MEDIA_STORAGE_BUCKET:'media',PRESENTER_MEDIA_CACHE_CONTROL:'3600',presenterPptxDigest:hash,
 markServiceElementDirty:()=>{},saveServiceItemMutation:async()=>{saves++;return scenario!=='uncertain';},renderCurrentServiceModuleDetail:()=>{},renderServiceList:()=>{},updateSaveState:()=>{}});
 vm.runInContext(fs.readFileSync(new URL('../mindex.keynote-html.js',import.meta.url),'utf8'),context);
 // Vendor runtime compatibility is tested separately; this fixture isolates the atomic attachment boundary.
 context.moduleFixture={...engine,assertKnownKeynoteHtmlRuntime:()=>{}};vm.runInContext('keynoteHtmlRuntime=async()=>moduleFixture',context);
 const files=Object.entries(data).map(([name,bytes])=>Object.defineProperty(new Blob([bytes]),'webkitRelativePath',{value:'export/'+name}));
 context.input={dataset:{serviceId:'service',keynoteItemId:'item'},files,value:'set',disabled:false};
 if(scenario==='dirty')state.dirty.service=true;
 const result=await vm.runInContext(scenario==='dirty'?'importPresenterKeynoteHtml(input,{requireClean:true})':'importPresenterKeynoteHtml(input)',context);
 assert.equal(item.lyrics,'keep-lyrics');assert.equal(item.form,'V-C');assert.deepEqual(item.timing,[1,2]);
 const after=JSON.parse(item.memo);assert.deepEqual(after.offeringVariants,memo.offeringVariants);assert.equal(after.userMemo,memo.userMemo);assert.deepEqual(after.asset.original,memo.asset.original);assert.equal(after.asset.custom,'preserved');
 if(scenario==='success'||scenario==='projection'){assert.equal(result,true);assert.equal(saves,1);assert.ok(after.asset.keynoteHtml);assert.equal(removed.length,0);}
 if(scenario==='race'){assert.equal(result,false);assert.equal(saves,0);assert.equal(item.title,'user-edited-during-upload');assert.equal(item.memo,JSON.stringify(memo));assert.equal(removed.length,uploads.length);}
 if(scenario==='uncertain'){assert.equal(result,false);assert.equal(saves,1);assert.equal(removed.length,0);assert.ok(after.asset.keynoteHtml);assert.equal(state.dirty.service,true);}
 if(scenario==='dirty'){assert.equal(result,false);assert.equal(saves,0);assert.equal(uploads.length,0);assert.equal(item.memo,JSON.stringify(memo));assert.equal(state.dirty.service,true);}
 if(large&&scenario==='success'){
  const path=[...stored.keys()].find(x=>x.endsWith('manifest.json')),bytes=stored.get(path),m=JSON.parse(new TextDecoder().decode(bytes));
  assert.equal(after.asset.keynoteHtml.sha256,await hash(bytes));assert.equal(m.files[videoName].sha256,await hash(video));
  const prefix=path.slice(0,-'manifest.json'.length),joined=m.files[videoName].parts.map(part=>stored.get(prefix+part.path));
  assert.equal(await hash(await new Blob(joined).arrayBuffer()),await hash(video));assert(!stored.has(prefix+videoName));
 }
 if(scenario==='storage-failure'){assert.equal(result,false);assert.equal(saves,0);assert.equal(item.memo,JSON.stringify(memo));assert.equal(removed.length,stored.size);}
 return {mode,result,uploads:uploads.length,saves,removed:removed.length,preserved:true};
}
for(const mode of ['success','projection','race','uncertain','dirty'])test('sidecar attachment '+mode+' preserves original/input/timing and atomic outcome',async()=>{await run(mode)});

for(const mode of ['large-success','large-race','large-uncertain','large-storage-failure'])test('large media attachment '+mode+' respects bucket limit and preserves authored data',async()=>{await run(mode)});

test('native ending transition requests common next exactly once and preserves a real last build',()=>{
 for(const terminalTransition of [true,false]){
  const original={format:'key',sha256:sourceHash},sidecar={sha256:'b'.repeat(64),url:'https://example.test/deck/manifest.json',pages:2};
  const slide={elementId:'item',asset:{original,keynoteHtml:sidecar}},key=JSON.stringify(['service','item',original.sha256,sidecar.sha256]);
  const state={presenter:{serviceId:'service',slides:[slide],index:0,pptxProgress:{key,command:{id:'last-next',action:'next'}}}};let next=0;
  const context=vm.createContext({window:{},state,Map,Set,URL,Number,JSON,document:{querySelectorAll:()=>[]},publishPresenterState(){},renderPresenterControlState(){},showToast(){},runPresenterAction:action=>{assert.equal(action,'next');next++}});
  vm.runInContext(fs.readFileSync(new URL('../mindex.keynote-html.js',import.meta.url),'utf8'),context);
  context.metadata={key,run:'run',version:1,id:'last-next',accepted:true,checkpoint:{scene:2,phase:'final',slide:1,nextScene:-1,atEnd:true,terminalTransition}};
  vm.runInContext('adoptPresenterKeynoteHtmlMetadata(metadata);adoptPresenterKeynoteHtmlMetadata(metadata)',context);
  assert.equal(next,terminalTransition?1:0);
 }
});
