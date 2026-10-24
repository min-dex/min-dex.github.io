"""Original Keynote/PPTX preservation without production storage or database writes."""
import os
import unicodedata
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

server,url=start_local_app_server()
try:
 with sync_playwright() as p, TemporaryDirectory() as tmp:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(accept_downloads=True)
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith(('blob:','data:')) else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function('typeof importPresenterPptx===\'function\' && !document.body.classList.contains(\'ui-booting\')')
   page.evaluate('''()=>{
    window.check=(v,m)=>{if(!v)throw Error(m)};
    window.sid='original-fixture';window.saved=null;window.saves=0;window.removed=[];window.stored=new Map();window.failUpload=false;window.failSave=false;window.race=null;
    const service={id:sid,type_id:'children'};
    window.item=normalizeServiceItem({id:'original-item',service_id:sid,label:'설교 자료',memo:serializeServiceItemMemo({elementType:'image',inputMode:'asset',referenceMedia:true,note:'Keep note',asset:{kind:'image',url:'https://example.invalid/old.png'}})},0);
    state.services=[service];state.selectedServiceId=sid;state.serviceItems={[sid]:[item]};
    state.config.url='original-fixture';
    state.client={storage:{from:()=>({
     upload:async(path,blob)=>{if(failUpload)throw Error('upload failed');stored.set(new URL('/deck-store/'+path,location.href).href,blob);if(race)race();return {}},
     getPublicUrl:path=>({data:{publicUrl:new URL('/deck-store/'+path,location.href).href}}),
     remove:async paths=>{removed.push(...paths);paths.forEach(path=>stored.delete(new URL('/deck-store/'+path,location.href).href));return {}}
    })}};
    const nativeFetch=window.fetch;window.fetch=(address,options)=>String(address).includes('/deck-store/')?Promise.resolve(stored.has(String(address))?new Response(stored.get(String(address))):new Response('',{status:404})):nativeFetch(address,options);
    window.confirm=()=>true;showToast=text=>window.lastToast=text;
    renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};updateSaveState=()=>{};markServiceElementDirty=()=>{};
    saveServiceItemMutation=async()=>{saves++;if(failSave)throw Error('uncertain save');saved=JSON.parse(JSON.stringify(item));return true};
    window.file=new File([new Uint8Array([80,75,3,4,0,255,13,10]),'original notes and hidden slides'],'설교 원본.key',{type:'application/vnd.apple.keynote'});
    window.input=()=>({files:[file],dataset:{serviceId:sid},value:'selected'});
   }''')
   result=page.evaluate('''async()=>{
    const before=await presenterPptxDigest(await file.arrayBuffer());
    check(await importPresenterPptx(input(),item),'key import failed');
    const memo=parseServiceItemMemo(saved.memo),asset=normalizeServiceAsset(memo.asset);
    check(memo.note==='Keep note'&&memo.elementType==='file'&&asset.kind==='file'&&!asset.slides&&!asset.pptx,'key converted or note lost');
    check(asset.original.name===file.name&&asset.original.sha256===before&&asset.original.size===file.size,'original metadata lost');
    const records=normalizeServiceDocumentSourceRecords([{elementId:item.id,asset}]);
    check(records[0].asset.original.sha256===before,'document source metadata lost');
    const rows=sanitizeWorshipPersistenceRows({sections:[],elements:[{id:item.id,asset,config:{asset}}]});
    check(rows.elements[0].asset.original.sha256===before&&rows.elements[0].config.asset.original.sha256===before,'persistence dropped original');
    check(await presenterPptxDigest(await readPresenterPptxSource(new URL(asset.original.url)))===before,'original bytes changed');
    refs.detailPane.insertAdjacentHTML('beforeend',renderPresenterAssetUpload(item,0,memo,sid));
    check(document.querySelector('[aria-label="원본 자료 교체"]').accept==='.key,.pptx','replacement accept');
    return {saved,hash:before};
   }''')
   with page.expect_download() as download:
    page.locator('[data-deck-original-download]').click()
   path=download.value.path();assert Path(path).read_bytes()==bytes([80,75,3,4,0,255,13,10])+b'original notes and hidden slides'
   assert unicodedata.normalize('NFC',download.value.suggested_filename)=='설교 원본.key',repr(download.value.suggested_filename)
   page.evaluate('''async()=>{
    const small=file;
    file=new File([new Uint8Array(50*1024*1024+37)],'large-original.key');
    check(await importPresenterPptx(input(),item),'large key import failed');
    const original=parseServiceItemMemo(item.memo).asset.original;
    check(original.url.endsWith('source.key.parts.json'),'large Keynote not chunked');
    const manifest=JSON.parse(await stored.get(original.url).text());
    check(manifest.parts.length===4&&manifest.format==='mindex-deck-parts-v1','large key manifest');
    check(await presenterPptxDigest(await readPresenterPptxSource(new URL(original.url)))===original.sha256,'large key bytes changed');
    const part=manifest.parts[0],blob=stored.get(part.url);stored.set(part.url,new Blob([new Uint8Array(blob.size).fill(1)]));
    let rejected=false;try{await readPresenterPptxSource(new URL(original.url))}catch{rejected=true}check(rejected,'corrupt key accepted');stored.set(part.url,blob);
    file=small;
    const old=item.memo,count=saves;
    failUpload=true;check(!await importPresenterPptx(input(),item)&&item.memo===old&&saves===count,'failed upload changed item');failUpload=false;
    race=()=>{item.raw_title='late edit'};const n=removed.length;
    check(!await importPresenterPptx(input(),item)&&item.memo===old&&item.raw_title==='late edit'&&saves===count&&removed.length>n,'late edit not protected');race=null;
    race=()=>{state.config.url='different-project'};
    check(!await importPresenterPptx(input(),item)&&saves===count,'project race adopted');race=null;state.config.url='original-fixture';
    const n2=stored.size;failSave=true;check(!await importPresenterPptx(input(),item)&&stored.size>n2&&parseServiceItemMemo(item.memo).asset.original,'uncertain save purged source');failSave=false;
   }''')
   # A real page reload discards transient JS objects; persisted serialized metadata remains usable.
   page.reload();page.wait_for_function('typeof normalizeServiceAsset===\'function\' && !document.body.classList.contains(\'ui-booting\')')
   page.evaluate('''saved=>{
    const row=JSON.parse(JSON.stringify(saved));const asset=normalizeServiceAsset(parseServiceItemMemo(row.memo).asset);
    state.selectedServiceId=row.service_id;state.serviceItems={[row.service_id]:[row]};
    refs.detailPane.insertAdjacentHTML('beforeend',renderPresenterAssetUpload(row,0,{asset},row.service_id));
    if(!asset.original||!document.querySelector('[data-deck-original-download]'))throw Error('reload lost original');
   }''',result['saved'])
   page.route('**/deck-store/**',lambda r:r.fulfill(body=bytes([80,75,3,4,0,255,13,10])+b'original notes and hidden slides',content_type='application/vnd.apple.keynote'))
   with page.expect_download() as restored_download:
    page.locator('[data-deck-original-download]').click()
   assert Path(restored_download.value.path()).read_bytes()==bytes([80,75,3,4,0,255,13,10])+b'original notes and hidden slides'
   print('PASS',engine,'Keynote exact bytes/name/hash, download, reload, replacement, draft/project races, failed upload and uncertain save retention',flush=True)
   browser.close()
finally:server.shutdown()
