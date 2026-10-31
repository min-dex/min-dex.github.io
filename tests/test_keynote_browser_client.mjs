import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as engine from '../mindex.keynote-html-engine.mjs';
const hash=async value=>Buffer.from(await webcrypto.subtle.digest('SHA-256',value)).toString('hex');
const bytes=new TextEncoder().encode('selected key'),sourceHash=await hash(bytes);
const resources={'assets/player/main.js':new TextEncoder().encode('protocol fixture'),'assets/header.json':new TextEncoder().encode('{}'),'assets/slide.jpeg':new TextEncoder().encode('thumbnail')};
const files=Object.fromEntries(await Promise.all(Object.entries(resources).map(async([name,b])=>[name,{size:b.length,sha256:await hash(b)}])));
const manifest={format:'apple-keynote-html-v1',sourceSha256:sourceHash,pages:1,scenes:1,slides:[{thumbnail:'assets/slide.jpeg',sceneStart:0,scenes:1}],files};
function context(extra={}) {
  return vm.createContext({console,File,URL,AbortController,setTimeout,clearTimeout,crypto:webcrypto,TextDecoder,Uint8Array,JSON,Number,Promise,Date,Error,Map,Set,
    document:{addEventListener(){}},presenterPptxDigest:hash,showToast(){},
    keynoteHtmlRuntime:async()=>({...engine,assertKnownKeynoteHtmlRuntime:()=>{}}),...extra});
}
test('browser conversion verifies source and every resource; edit and corruption abort before upload',async()=>{
  for(const mode of ['success','source-mismatch','resource-mismatch','edit']) {
    let unchanged=true,calls=0;
    const ctx=context({unchanged:()=>unchanged,file:new File([bytes],'selected.key'),fetch:async(url,options)=>{
      assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
      assert.equal(options.headers.Authorization,'Bearer '+'a'.repeat(64));calls++;
      if(url.endsWith('/convert'))return Response.json({id:'00000000-0000-4000-8000-000000000000',manifest:{...manifest,sourceSha256:mode==='source-mismatch'?'b'.repeat(64):sourceHash}});
      if(mode==='edit')unchanged=false;
      const name=url.split('/jobs/00000000-0000-4000-8000-000000000000/')[1];
      return new Response(mode==='resource-mismatch'?'tamper':resources[name]);
    }});
    vm.runInContext(fs.readFileSync(new URL('../mindex.keynote-browser.js',import.meta.url),'utf8'),ctx);
    vm.runInContext("presenterKeynoteBridgeSession='a'.repeat(64)",ctx);
    if(mode==='success'){
      const result=await vm.runInContext('preparePresenterKeynoteBrowserFile(file,unchanged)',ctx);
      assert.equal(result.length,4);assert.ok(result.every(f=>f.webkitRelativePath.startsWith('playback/')));
      assert.equal(JSON.parse(await result.find(f=>f.name==='manifest.json').text()).sourceSha256,sourceHash);
    }else await assert.rejects(vm.runInContext('preparePresenterKeynoteBrowserFile(file,unchanged)',ctx));
    assert.ok(calls>0);
  }
});

test('existing KEY automatic reconnect preserves content and guards dirty/project/selection races',async()=>{
  for(const mode of ['success','dirty','edit','project','selection','wrong-hash']) {
    const item={id:'item',memo:JSON.stringify({note:'preserve',asset:{original:{format:'key',name:'source.key',url:'https://media.example/source.key',sha256:mode==='wrong-hash'?'b'.repeat(64):sourceHash}}}),lyrics:'preserve lyrics',timing:[1,3]};
    const before=JSON.stringify(item),state={client:{},config:{url:'project'},selectedServiceId:'service',dirty:{service:mode==='dirty'}};
    let saves=0,reads=0;const ctx=context({state,button:{dataset:{serviceId:'service',keynoteItemId:'item'},disabled:false},
      presenterPptxImports:new Set(),getServiceItems:()=>[item],parseServiceItemMemo:JSON.parse,normalizeServiceAsset:x=>x,
      readPresenterPptxSource:async()=>{reads++;return bytes;},
      importPresenterKeynoteHtml:async(input,options)=>{saves++;assert.equal(options.requireClean,true);assert.equal(input.dataset.keynoteItemId,'item');return true;}});
    vm.runInContext(fs.readFileSync(new URL('../mindex.keynote-browser.js',import.meta.url),'utf8'),ctx);
    ctx.prepared=async()=>{
      if(mode==='edit')state.dirty.service=true;
      if(mode==='project')state.config.url='other';
      if(mode==='selection')state.selectedServiceId='other';
      return [];
    };vm.runInContext('connectPresenterKeynoteBridge=async()=>{};preparePresenterKeynoteBrowserFile=prepared',ctx);
    const result=await vm.runInContext('connectPresenterKeynoteItemAutomatically(button)',ctx);
    assert.equal(result,mode==='success');assert.equal(saves,mode==='success'?1:0);
    assert.equal(reads,mode==='dirty'?0:1);assert.equal(JSON.stringify(item),before);
    assert.equal(ctx.button.disabled,false);assert.equal(ctx.presenterPptxImports.size,0);
  }
});

test('native permission failure shows an actionable message without native details',async()=>{
  const ctx=context({fetch:async()=>Response.json({code:'automation-permission',error:'private native details'},{status:422})});
  vm.runInContext(fs.readFileSync(new URL('../mindex.keynote-browser.js',import.meta.url),'utf8'),ctx);
  await assert.rejects(vm.runInContext("presenterKeynoteBridgeRequest('/convert')",ctx),error=>error.message.includes('자동화 연결')&&!error.message.includes('private native'));
});
