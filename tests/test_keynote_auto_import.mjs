import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

test('KEY upload automatically attaches prepared slides, keeps authored fields and stops on save uncertainty/edit/project races',async()=>{
  for(const mode of ['success','conversion-failure','source-uncertain','sidecar-uncertain','edit','project','cancel']) {
    const item={id:'item',raw_title:'keep title',memo:JSON.stringify({note:'keep note',lyrics:['keep'],timing:[1,2],offeringVariants:{praise:'keep'}})};
    const authored=JSON.parse(item.memo);let saves=0,attaches=0,uploads=0,removed=0,prepared=false;
    const state={selectedServiceId:'service',services:[{id:'service'}],config:{url:'project'},dirty:{service:false},client:{storage:{from:()=>({remove:async paths=>{removed+=paths.length;}})}}};
    const manifest=new File([JSON.stringify({pages:20})],'manifest.json');Object.defineProperty(manifest,'webkitRelativePath',{value:'playback/manifest.json'});
    const ctx=vm.createContext({console,File,Blob,URL,Map,Set,Uint8Array,TextDecoder,crypto:webcrypto,Promise,JSON,Number,Error,
      window:{confirm:()=>mode!=='cancel'},state,
      input:{files:[new File(['selected KEY'],'slides.key')],dataset:{serviceId:'service'},disabled:false,value:'selected'},
      getServiceItems:()=>[item],parseServiceItemMemo:JSON.parse,serializeServiceItemMemo:JSON.stringify,normalizeServiceAsset:x=>x,
      showToast(){},markServiceElementDirty(){},renderCurrentServiceModuleDetail(){},renderServiceList(){},updateSaveState(){},
      preparePresenterKeynoteBrowserFile:async()=>{if(mode==='conversion-failure')throw Error('conversion failed');prepared=true;return [manifest];},
      saveServiceItemMutation:async()=>{saves++;if(mode==='source-uncertain')throw Error('uncertain');state.dirty.service=mode==='edit';if(mode==='project')state.config.url='other';return true;},
      importPresenterKeynoteHtml:async(input,options)=>{attaches++;assert.equal(options.requireClean,true);assert.equal(options.confirmed,true);assert.equal(input.dataset.keynoteItemId,'item');if(mode==='sidecar-uncertain'){state.dirty.service=true;return false;}return true;}
    });
    vm.runInContext(fs.readFileSync(new URL('../mindex.pptx.js',import.meta.url),'utf8'),ctx);
    ctx.sourceUpload=async(_file,upload)=>{assert.equal(prepared,true);uploads++;return 'https://media.example/source.key';};
    vm.runInContext('uploadPresenterPptxSource=sourceUpload',ctx);
    ctx.item=item;
    const result=await vm.runInContext('importPresenterPptx(input,item)',ctx);
    assert.equal(result,mode==='success');
    const content=JSON.parse(item.memo);for(const key of Object.keys(authored))assert.deepEqual(content[key],authored[key]);
    assert.equal(item.raw_title,'keep title');assert.equal(ctx.input.disabled,false);assert.equal(vm.runInContext('presenterPptxImports.size',ctx),0);
    assert.equal(uploads,['conversion-failure','cancel'].includes(mode)?0:1);
    assert.equal(attaches,['success','sidecar-uncertain'].includes(mode)?1:0);
    assert.equal(saves,['conversion-failure','cancel'].includes(mode)?0:1);assert.equal(removed,0,'uncertain committed media must remain');
  }
});

test('20-slide PPTX upload stays direct and does not contact the Mac companion',async()=>{
  const item={id:'item',memo:JSON.stringify({note:'keep'})};let saves=0,helperCalls=0;const messages=[];
  const bucket={upload:async()=>({}),getPublicUrl:p=>({data:{publicUrl:'https://media.example/'+p}})};
  const state={selectedServiceId:'service',services:[{id:'service'}],config:{url:'project'},dirty:{service:false},client:{storage:{from:()=>bucket}}};
  const ctx=vm.createContext({console,File,Blob,URL,Map,Set,Uint8Array,TextDecoder,crypto:webcrypto,Promise,JSON,Number,Error,
    window:{confirm:()=>true},state,item,PRESENTER_MEDIA_STORAGE_BUCKET:'media',PRESENTER_MEDIA_CACHE_CONTROL:'3600',input:{files:[new File(['pptx fixture'],'slides.pptx')],dataset:{serviceId:'service'},value:'selected',disabled:false},
    getServiceItems:()=>[item],parseServiceItemMemo:JSON.parse,serializeServiceItemMemo:JSON.stringify,normalizeServiceAsset:x=>x,
    showToast:message=>messages.push(message),markServiceElementDirty(){},renderCurrentServiceModuleDetail(){},renderServiceList(){},updateSaveState(){},
    preparePresenterKeynoteBrowserFile:async()=>{helperCalls++;throw Error('PPTX must not need a helper');},
    saveServiceItemMutation:async()=>{saves++;state.dirty.service=false;return true;}
  });
  vm.runInContext(fs.readFileSync(new URL('../mindex.pptx.js',import.meta.url),'utf8'),ctx);
  ctx.parseFixture=async()=>({deck:{width:1920,slides:Array.from({length:20},()=>({animations:[],elements:[]})),dispose(){}},runtime:{slideToPng:async()=>new Blob(['thumb']),groupSteps:()=>[]}});
  vm.runInContext("parsePresenterPptx=parseFixture;uploadPresenterPptxSource=async()=> 'https://media.example/source.pptx'",ctx);
  assert.equal(await vm.runInContext('importPresenterPptx(input,item)',ctx),true,messages.join(';'));
  assert.equal(helperCalls,0);assert.equal(saves,1);
  const memo=JSON.parse(item.memo);assert.equal(memo.note,'keep');assert.equal(memo.asset.slides.length,20);assert.equal(memo.asset.original.format,'pptx');
});
