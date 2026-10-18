from urllib.parse import urlsplit
"""Instance-only offering toggle, persistence, projection and restore."""

from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def run(browser, url):
    context = browser.new_context()
    context.add_init_script("Element.prototype.requestFullscreen=async()=>{};Element.prototype.webkitRequestFullscreen=()=>{};window.open=()=>null")
    context.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).netloc == urlsplit(url).netloc else route.abort())
    page = context.new_page()
    page.goto(url + '?output=presenter', wait_until='domcontentloaded')
    page.wait_for_function("typeof replaceServiceOfferingSpecial === 'function'")
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
    page.get_by_role('button', name='봉헌찬송으로 변경').click()
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
