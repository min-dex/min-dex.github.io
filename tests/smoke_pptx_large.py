"""Large PPT transport/import: local files and isolated storage/save doubles."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from io import BytesIO
from functools import partial
import zipfile
from urllib.parse import urlsplit
from smoke_pptx import fixture
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    source = BytesIO(fixture())
    with zipfile.ZipFile(source, "a", zipfile.ZIP_STORED) as archive:
        archive.writestr("ppt/media/large-unused.bin", bytes(50 * 1024 * 1024))
    deck = source.getvalue()
    server, url = start_local_app_server()
    class FixtureHandler(server.RequestHandlerClass.func):
        def do_GET(self):
            if self.path == "/large-fixture.pptx":
                self.send_response(200)
                self.send_header("Content-Length", str(len(deck)))
                self.end_headers()
                self.wfile.write(deck)
            else:
                super().do_GET()
    server.RequestHandlerClass = partial(FixtureHandler, **server.RequestHandlerClass.keywords)
    try:
        with sync_playwright() as p:
            for engine in ("chromium", "webkit"):
                browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
                page = browser.new_page()
                page.route("**/*", lambda r: r.continue_() if urlsplit(r.request.url).hostname in ("localhost", "127.0.0.1") or r.request.url.startswith(("blob:", "data:")) else r.abort())
                page.goto(url)
                page.wait_for_function("typeof normalizeServiceItem==='function' && typeof state!=='undefined' && !document.body.classList.contains('ui-booting')")
                result = page.evaluate("""async () => {
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  const rejects=async (fn,label)=>{let failed=false;try{await fn()}catch{failed=true}check(failed,label)};
                  const file=new File([await(await fetch('/large-fixture.pptx')).arrayBuffer()],'large.pptx');
                  const stored=new Map(),removed=[];let uploads=0,saves=0,failAt=0,failSave=false;
                  const nativeFetch=window.fetch;
                  window.fetch=async (url,options)=>String(url).includes('/storage-test/')
                    ?stored.has(String(url))?new Response(stored.get(String(url))):new Response('',{status:404})
                    :nativeFetch(url,options);
                  const service={id:'large-fixture',type_id:'fixture'};
                  const item=normalizeServiceItem({id:'large-item',service_id:service.id,label:'참고 화면',memo:serializeServiceItemMemo({elementType:'image',asset:{kind:'image'},note:'Keep'})},0);
                  state.services=[service];state.selectedServiceId=service.id;state.serviceItems={[service.id]:[item]};
                  const address=path=>new URL('/storage-test/'+path,location.href).href;
                  state.client={storage:{from:()=>({
                    upload:async(path,blob)=>{uploads++;if(uploads===failAt)throw Error('upload failed');check(blob.size<=50*1024*1024,'storage limit exceeded');stored.set(address(path),blob);return {}},
                    getPublicUrl:path=>({data:{publicUrl:address(path)}}),
                    remove:async paths=>{removed.push(...paths);paths.forEach(path=>stored.delete(address(path)));return {}}
                  })}};
                  window.confirm=()=>true;showToast=()=>{};renderCurrentServiceModuleDetail=()=>{};renderServiceList=()=>{};updateSaveState=()=>{};markServiceElementDirty=()=>{};
                  saveServiceItemMutation=async()=>{saves++;if(failSave)throw Error('uncertain');return true};
                  const input=()=>({files:[file],dataset:{serviceId:service.id},value:'x'});
                  check(await importPresenterPptx(input(),item),'large import failed');
                  const memo=parseServiceItemMemo(item.memo),asset=memo.asset;
                  check(memo.note==='Keep'&&saves===1&&asset.slides.length===4,'import contract');
                  const source=new URL(asset.pptx.url),manifest=JSON.parse(await stored.get(source.href).text());
                  check(manifest.parts.length===4&&stored.size===9,'chunk/thumbnail count');
                  check(await presenterPptxDigest(await readPresenterPptxSource(source))===await presenterPptxDigest(await file.arrayBuffer()),'source bytes changed');
                  const loaded=await loadPresenterPptx(source.href);check(loaded.value.deck.slides.length===4,'source parse');
                  const host=document.createElement('div');document.body.append(host);
                  const session=await createPresenterPptxSession(host,loaded,0);session.sync(0);session.sync(1);check(host.dataset.pptxStep==='1','click effect');session.destroy();
                  const partUrl=manifest.parts[0].url,originalPart=stored.get(partUrl);
                  stored.set(partUrl,new Blob([new Uint8Array(originalPart.size)]));
                  await rejects(()=>readPresenterPptxSource(source),'corrupt part accepted');
                  stored.delete(partUrl);await rejects(()=>readPresenterPptxSource(source),'missing part accepted');stored.set(partUrl,originalPart);
                  const originalManifest=stored.get(source.href);
                  const bad={...manifest,parts:manifest.parts.map((part,i)=>i?part:{...part,url:'https://example.invalid/source.bin'})};
                  stored.set(source.href,new Blob([JSON.stringify(bad)]));
                  await rejects(()=>readPresenterPptxSource(source),'foreign part accepted');
                  stored.set(source.href,new Blob([JSON.stringify({...manifest,size:501*1024*1024})]));
                  await rejects(()=>readPresenterPptxSource(source),'oversize manifest accepted');stored.set(source.href,originalManifest);
                  const oversized=new URL('/storage-test/oversize',location.href).href;stored.set(oversized,new Blob(['too long']));
                  await rejects(()=>fetchPresenterPptxBytes(oversized,2),'unbounded response');stored.delete(oversized);
                  const oldMemo=item.memo,oldCount=stored.size;failAt=uploads+2;
                  check(!await importPresenterPptx(input(),item),'failed upload saved');
                  check(item.memo===oldMemo&&saves===1&&stored.size===oldCount&&removed.length===1,'partial cleanup');
                  failAt=0;failSave=true;const removedCount=removed.length;
                  check(!await importPresenterPptx(input(),item),'uncertain save accepted');
                  check(saves===2&&removed.length===removedCount&&stored.size===oldCount+9,'uncertain save removed source');
                  return {size:file.size,parts:manifest.parts.length,exactBytes:true,cleanup:true,corruption:true};
                }""")
                print("PASS", engine, result, flush=True)
                browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
