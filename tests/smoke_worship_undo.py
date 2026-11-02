"""Exercise the presenter DOM and picker through a simulated save receipt, offline."""
from smoke_presenter_focus import setup
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def check(page, url):
    page.add_init_script("""const listen=window.addEventListener;window.addEventListener=function(type,fn,...opts){if(type==='keydown' && String(fn).includes('handleServiceEditUndo')) window.undoBound=true; return listen.call(this,type,fn,...opts)}""")
    setup(page, url)
    page.evaluate("if (!window.undoBound) bindStaticEvents()")
    page.evaluate("""() => {
      window.undoSaves = 0;
      state.songs = ['old','new'].map(id=>({id,title:id,versions:[{id:id+'-v', label:'기본'}]}));
      const rows = getServiceItems(state.selectedServiceId);
      const ix = rows.findIndex(x => x.id==='item-0');
      Object.assign(rows[ix], {song_id:'old',version_id:'old-v',raw_title:''});
      window.undoMemo = rows[ix].memo;
      // Simulate the normalized save receipt and replacement of the service object.
      saveCommittedServiceItem = async (index,id) => {
        await Promise.resolve();
        state.serviceItems[id] = normalizeServiceItemsInCurrentOrder(state.serviceItems[id]);
        state.services = state.services.map(s=>s.id===id ? {...s} : s);
        window.undoSaves++;
        return true;
      };
      selectServiceSongForItem(ix,'new');
    }""")
    page.wait_for_function("window.undoSaves===1")
    page.locator("[data-presenter-focus-toggle=focus]").dispatch_event("click")
    page.locator('.svc-slide-thumb[data-presenter-index="1"]').focus()
    # Exercise a board with its editor inputs mounted outside the detail pane.
    page.evaluate("""()=>{const left=document.createElement('aside');document.body.prepend(left);
      refs.detailPane.querySelectorAll('[data-service-item-field]').forEach(el=>left.append(el));
      if (!left.childElementCount) throw Error('fixture did not render editor fields')}""")
    page.keyboard.press("Meta+z")
    state = page.evaluate("""()=>{const row=getServiceItems(state.selectedServiceId).find(r=>r.id==='item-0');
      return [row.song_id,row.version_id,row.memo===window.undoMemo,window.undoSaves]}""")
    assert state == ["old","old-v",True,1], state


def main():
    server,url=start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser = launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                check(browser.new_page(viewport={"width":1440,"height":900}),url)
                browser.close()
                print('PASS picker undo after normalized save and field-free focused presenter',engine)
    finally:
        server.shutdown()


if __name__=='__main__':
    main()
