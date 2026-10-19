from urllib.parse import urlsplit
"""Instance-only offering toggle, persistence, projection and restore."""

from smoke_app import launch_chromium, start_local_app_server, sync_playwright
from smoke_app import prepare_server_state_fixture


def run(browser, url):
    context = browser.new_context()
    context.add_init_script("Element.prototype.requestFullscreen=async()=>{};Element.prototype.webkitRequestFullscreen=()=>{};window.open=()=>null")
    context.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).netloc == urlsplit(url).netloc else route.abort())
    page = context.new_page()
    page.goto(url + '?output=presenter', wait_until='domcontentloaded')
    page.wait_for_function("typeof replaceServiceOfferingSpecial === 'function'")
    prepare_server_state_fixture(page)
    results = page.evaluate("""async () => {
      const check = (ok, msg) => { if (!ok) throw Error(msg); };
      const clone = value => JSON.parse(JSON.stringify(value));
      const sid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const columns = {inputMode:true, contentState:true};
      const results = [];
      refs.detailPane = document.createElement('section');
      document.body.append(refs.detailPane);
      requireClient = () => true;
      ensureWorshipServiceRowsLoadedForPersistence = async () => {};
      worshipElementTypedStateColumns = async () => columns;
      captureWorshipRecoverySnapshot = () => {};
      updateSaveState = () => {};
      refreshPresenterForService = () => {};
      renderServiceList = () => {};
      render = () => {};
      captureCleanFingerprint = () => {};
      let fail = false, writes = [];
      state.client = {from:()=>{throw Error('Direct table write attempted')}};
      worshipAtomicClient = async () => ({commit:async request => {
        writes.push(clone(request));
        if(fail)throw Error('injected failure');
        return {sections:clone(request.rows.sections),elements:clone(request.rows.elements),
          service:{source_ref:{mindexServiceDocument:clone(request.document)}}};
      }});
      const fixture = type => {
        // Build a real service scaffold for the atomic element-save path.
        const service = {id:sid, type_id:type, date:'2026-09-13'};
        state.services = [service];
        state.selectedServiceId = sid;
        state.saving = false; activeServiceSavePromise = null;
        state.dirtyServiceElementIds = new Map();
        state.dirtyServiceStructureIds = new Set();
        state.dirtyServiceTypeIds = new Set();
        state.templateElementSuppressions = new Map();
        state.dirty.service = false;
        // Keep sibling slots so source replacement exercises normal service shape.
        const scaffold = buildWorshipServiceScaffold(sid, type, {service});
        const items = groupWorshipElements(scaffold.sections, scaffold.elements)[sid];
        const item = items.find(x => x.label === '봉헌찬송');
        if (!item) throw Error(type+' scaffold has no 축도');
        item.assignee = '원래 담당 목사';
        item.memo = serializeServiceItemMemo({...parseServiceItemMemo(item.memo), note:'원래 메모'});
        item._worshipElementTemplateModified = true;
        const rows = buildWorshipPersistenceRows(service, items, {}, {}, {elementTypedStateColumns:columns});
        state.worshipSections = rows.sections; state.worshipElements = rows.elements;
        state.serviceItems = {[sid]:groupWorshipElements(rows.sections, rows.elements)[sid]};
        refs.detailPane.innerHTML = '';
        writes = []; fail = false;
        return service;
      };
      const service = fixture('sunday-second');
      let target = getServiceItems(sid).find(x => x.label === '봉헌찬송');
      const other = clone(target);
      check(await setServiceOfferingSpecial(sid, target.id, true), 'save failed');
      check(writes.some(x => x.rows.elements.some(e => e.source_ref?.slotKey === 'offering.special')), 'replacement not sent to RPC');
      check(other.label === '봉헌찬송', 'separate instance changed');
      check(writes.at(-1).document.sourceText.includes('[봉헌특송]'), 'source label not updated');
      check(!writes.at(-1).document.sourceText.includes('[봉헌찬송]'), 'old source block remained');
      target = getServiceItems(sid).find(x => x.label === '봉헌특송');
      check(await setServiceOfferingSpecial(sid, target.id, false), 'restore save failed');
      check(writes.at(-1).document.sourceText.includes('[봉헌찬송]') && !writes.at(-1).document.sourceText.includes('[봉헌특송]'), 'source reversal failed');
      target = getServiceItems(sid).find(x => x.label === '봉헌찬송');
      const praiseMemo = target.memo;
      check(await setServiceOfferingSpecial(sid, target.id, 'video'), 'video save failed');
      target = getServiceItems(sid).find(x => x.label === '봉헌영상');
      check(target && serviceItemSlotKey(target) === 'offering.media', 'video lost in projection');
      check(!getServiceItems(sid).some(x => x.label === '봉헌찬송'), 'duplicate hymn');
      check(!sundaySharedContentKey(target, service), 'video linked to shared hymn');
      check(writes.at(-1).document.sourceText.includes('[봉헌영상]'), 'video source missing');
      target.raw_title = '봉헌 영상 제목';
      target.memo = serializeServiceItemMemo({...parseServiceItemMemo(target.memo), asset:{url:'https://example.test/offering.mp4',type:'video'}});
      Object.assign(state.serviceItems[sid].find(x => x.id === target.id), target);
      const videoMemo = target.memo;
      check(await setServiceOfferingSpecial(sid, target.id, 'special'), 'video to special failed');
      target = getServiceItems(sid).find(x => x.label === '봉헌특송');
      check(parseServiceItemMemo(target.memo).note === parseServiceItemMemo(praiseMemo).note, 'praise memo lost');
      check(await setServiceOfferingSpecial(sid, target.id, 'video'), 'video restore failed');
      target = getServiceItems(sid).find(x => x.label === '봉헌영상');
      check(target.raw_title === '봉헌 영상 제목', 'video title lost');
      check(parseServiceItemMemo(target.memo).asset.url === parseServiceItemMemo(videoMemo).asset.url, 'video asset lost');
      check(await setServiceOfferingSpecial(sid, target.id, 'hymn'), 'hymn restore failed');
      target = getServiceItems(sid).find(x => x.label === '봉헌찬송');
      results.push('three modes / atomic reload / video asset restoration / shared exclusion');
      fail = true;
      check(await setServiceOfferingSpecial(sid, target.id, true) === false, 'failure reported success');
      check(state.dirty.service && getServiceItems(sid).some(x => x.label === '봉헌특송'), 'failure lost draft');
      results.push('real save path / restore / failure retains draft');
      fail = false;
      target = getServiceItems(sid).find(x => x.label === '봉헌특송');
      refs.detailPane.innerHTML = presenterServiceInputControls(target, getServiceItems(sid).findIndex(x => x.id === target.id), service);
      refs.detailPane.addEventListener('click', handleDetailClick);
      document.getElementById('presenterOutputRoot')?.remove();
      return results;
    }""")
    for result in results:
        print('PASS', result, flush=True)
    page.get_by_role('button', name='찬송', exact=True).click()
    page.wait_for_function("!state.saving && getServiceItems(state.selectedServiceId).some(x => x.label === '봉헌찬송')")
    print('PASS actual delegated button click', flush=True)
    context.close()


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    print(engine, flush=True)
                    run(browser, url)
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
