from smoke_app import launch_chromium, start_local_app_server, sync_playwright


server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ("chrome", "webkit"):
          browser = launch_chromium(p) if engine == "chrome" else p.webkit.launch()
          page = browser.new_page(viewport={"width": 1920, "height": 1080})
          page.route("**/*supabase*/**", lambda route: route.abort())
          page.goto(url, wait_until="domcontentloaded")
          page.wait_for_function("typeof renderPresenterServiceScriptureInput === 'function'")
          result = page.evaluate("""() => {
          document.body.classList.remove('ui-booting'); document.body.dataset.theme='dark';
          const service={id:'citation-compact', type_id:'sunday-main'};
          const item={id:'citation-item',service_id:service.id,label:'인용 구절',raw_title:'누가복음 18:35-43; 데살로니가전서 5:14; 빌립보서 4:6-7; 로마서 8:26-27, 34-35',_worshipSectionKey:'sermon',memo:serializeServiceItemMemo({elementType:'scripture',scriptureReferences:['누가복음 18:35-43','데살로니가전서 5:14','빌립보서 4:6-7','로마서 8:26-27','로마서 8:34-35']})};
          state.services=[service]; state.serviceItems[service.id]=[item]; state.bibleTranslations=[];
          const host=document.createElement('div');host.style.cssText='width:2000px;padding:20px;background:#181816';
          host.innerHTML=`<div class="svc-board-subgroup-controls"><div class="svc-board-subgroup-control-item">${renderPresenterServiceScriptureInput(item,0,parseServiceItemMemo(item.memo),service)}</div></div>`;
          document.body.append(host);
          const outer=host.querySelector('.svc-board-subgroup-controls');
          const input=host.querySelector('.svc-presenter-input-control-wrap');
          const summary=host.querySelector('summary');
          const box=outer.getBoundingClientRect(), inputBox=input.getBoundingClientRect(), summaryBox=summary.getBoundingClientRect();
          const details=host.querySelector('details'); details.open=true;
          const expanded=host.querySelector('.svc-presenter-scripture-parts').getBoundingClientRect().height;
          return {height:box.height,top:inputBox.top-box.top,bottom:box.bottom-Math.max(inputBox.bottom,summaryBox.bottom),summaryHeight:summaryBox.height,expanded};
          }""")
          assert result["top"] <= 10 and result["bottom"] <= 10, result
          assert result["height"] <= result["summaryHeight"] + 20, result
          assert result["expanded"] > 0, result
          print(engine, "PASS closed citation controls have no phantom grid row")
          browser.close()
finally:
    server.shutdown()
