from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ("chrome", "webkit"):
                browser = launch_chromium(p) if engine == "chrome" else p.webkit.launch()
                page = browser.new_page()
                page.route("**/*supabase*/**", lambda route: route.abort())
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_function("typeof uploadServiceItemAssetFile === 'function'")
                print(engine, page.evaluate("""async () => {
                  const check = (v,m) => { if (!v) throw Error(m); };
                  const sid = '11111111-1111-4111-8111-111111111111';
                  const service = {id:sid,type_id:'fixture'};
                  state.services=[service]; state.selectedServiceId=sid;
                  let items=[{id:'new-image-item',label:'광고 이미지',
                    _worshipSectionKey:'announcements',
                    memo:serializeServiceItemMemo({elementType:'image',inputMode:'asset',asset:{kind:'image'}})}];
                  getServiceItems=()=>items;
                  renderCurrentServiceModuleDetail=()=>{};
                  renderServiceList=()=>{}; updateSaveState=()=>{}; markServiceElementDirty=()=>{};
                  const notices=[]; showToast=m=>notices.push(m);
                  let saves=0, fail='', removed=[];
                  state.client={storage:{from:()=>({
                    upload:async(path,file)=>{
                      items=structuredClone(items); // Projection rebuild while upload is pending.
                      if(file.name===fail) return {error:new Error('upload failure')};
                      return {};
                    },
                    getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}}),
                    remove:async paths=>{removed.push(...paths);return {};}
                  })}};
                  saveServiceItemMutation=async()=>{
                    saves++;
                    const rows=buildWorshipPersistenceRows(service,items);
                    items=groupWorshipElements(rows.sections,rows.elements)[sid];
                    return true;
                  };
                  const file=name=>new File(['fixture'],name,{type:'image/png'});
                  const input=files=>({files,dataset:{serviceId:sid,serviceItemIndex:'0'},value:'selected'});
                  await uploadServiceItemAssetFile(input([file('one.png'),file('two.png'),file('three.png')]));
                  let asset=parseServiceItemMemo(items[0].memo).asset;
                  check(saves===1,'batch saved more than once: '+saves);
                  check(asset.slides?.length===3,'batch lost images: '+JSON.stringify(asset));
                  await uploadServiceItemAssetFile(input([file('four.png')]));
                  asset=parseServiceItemMemo(items[0].memo).asset;
                  check(asset.slides.length===4,'single selection replaced existing images');
                  check(asset.slides.map(s=>s.name).join(',')==='one.png,two.png,three.png,four.png','wrong order');
                  const section={sectionKey:'announcements',sectionLabel:'광고',sectionTitle:'광고',sectionName:'광고'};
                  const slides=presenterElementSlideFromMemo(items[0],section,0,parseServiceItemMemo(items[0].memo),'광고',service);
                  check(slides.length===4,'saved round-trip did not render all images');
                  const before=items[0].memo;
                  fail='bad.png';
                  await uploadServiceItemAssetFile(input([file('pending.png'),file('bad.png')]));
                  check(items[0].memo===before && saves===2,'failed batch changed saved images');
                  check(removed.length===1,'staged upload not cleaned up');
                  check(!presenterReferenceMediaBatchServices.has(sid),'batch lock leaked');
                  items[0].memo=serializeServiceItemMemo({elementType:'image',inputMode:'asset',
                    asset:{kind:'image',url:'https://example.test/legacy.png',name:'legacy.png'}});
                  fail='';
                  await uploadServiceItemAssetFile(input([file('new.png')]));
                  asset=parseServiceItemMemo(items[0].memo).asset;
                  check(asset.slides.length===2 && asset.slides[0].name==='legacy.png','legacy single image lost');
                  const one=presenterElementSlideFromMemo(items[0],section,0,{elementType:'image',inputMode:'asset',
                    asset:{kind:'image',url:'https://example.test/stale.png',slides:[{url:'https://example.test/current.png'}]}},'광고',service);
                  check(one[0]?.imageSrc==='https://example.test/current.png','one-page deck ignored');
                  return 'PASS batch save, projection refresh, persisted round-trip, append, failure and single-page deck';
                }"""), flush=True)
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
