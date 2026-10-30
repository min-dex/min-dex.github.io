"""Actual inline template defaults, draft values and row-scoped Enter routing."""
import os
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
import smoke_app
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    smoke_app.extract_supa_config = lambda: ('', '')
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page()
                    page.route('**/*', lambda route: route.continue_() if
                               urlsplit(route.request.url).netloc == urlsplit(url).netloc and
                               route.request.method in ('GET', 'HEAD') else route.abort())
                    page.route('**/mindex-release.json*', lambda route: route.fulfill(json={'version': 'inline-source-test'}))
                    page.add_init_script("window.open=()=>null;window.print=()=>{throw Error('print forbidden')}")
                    page.goto(url+'?mindexSmokeRaw=1', wait_until='domcontentloaded')
                    page.wait_for_function("typeof renderServiceCurrentSidebar==='function' && !document.body.classList.contains('ui-booting')")
                    page.evaluate("""() => {
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const service={id:'__prep_values_default__',type_id:'sunday-main',date:'2026-09-20',title:'주일예배 [3부]'};
                      state.services=[service];state.presenterPreparationDrafts={};
                      state.selectedServiceId=service.id;state.loadedWorshipServiceIds=new Set([service.id]);
                      const scaffold=buildWorshipServiceScaffold(service.id,service.type_id,{service});
                      state.serviceItems={[service.id]:groupWorshipElements(scaffold.sections,scaffold.elements)[service.id]||[]};
                      const fields=()=>{const host=document.createElement('div');host.innerHTML=renderServiceCurrentSidebar(service,[]);return [...host.querySelectorAll('[data-presenter-preparation-field]')]};
                      const inputs=fields();
                      check(inputs.length>0&&inputs.some(input=>input.value),'template defaults missing');
                      check(inputs.every(input=>input.dataset.presenterPreparationFieldLabel),'fixed field label missing');
                      check(inputs.some(input=>input.dataset.presenterPreparationFieldLabel==='찬양 1'),'numbered praise label spacing');
                      check(inputs.some(input=>input.dataset.presenterPreparationFieldLabel==='인용 구절'),'citation label spacing');
                      const defaults=presenterPreparationFieldValues(service,presenterPreparationDisplayTextForService(service));
                      check(inputs.every(input=>defaults.some(field=>field.label===input.dataset.presenterPreparationFieldLabel&&field.value===input.value)),'default value differs from source');
                      check(inputs.some(input=>!input.value&&input.placeholder),'empty field must keep example only in placeholder');
                      state.presenterPreparationDrafts[service.id]='찬양1: 주 은혜임을';
                      const draftFields=fields();
                      check(draftFields.some(input=>input.dataset.presenterPreparationFieldLabel.replace(/\s/g,'')==='찬양1'&&input.value==='주 은혜임을'),'typed draft missing '+JSON.stringify(draftFields.map(input=>({label:input.dataset.presenterPreparationFieldLabel,value:input.value}))));
                      const legacyDraft='찬양1: 주 은혜임을\\n설교: 은혜의 길 / 김민수 목사\\n대표기도: 박지훈 집사';
                      state.presenterPreparationDrafts[service.id]=legacyDraft;
                      const restored=fields();
                      const valueFor=label=>restored.find(input=>input.dataset.presenterPreparationFieldLabel===label)?.value;
                      check(valueFor('설교 제목')==='은혜의 길'&&valueFor('설교자')==='김민수 목사','legacy paired title/person lost '+JSON.stringify(restored.map(input=>[input.dataset.presenterPreparationFieldLabel,input.value])));
                      check(valueFor('대표기도')==='박지훈 집사','legacy person-only draft lost');
                      check(state.presenterPreparationDrafts[service.id]===legacyDraft,'render changed original legacy draft');
                      delete state.presenterPreparationDrafts[service.id];
                      check(JSON.stringify(fields().map(input=>[input.dataset.presenterPreparationFieldLabel,input.value]))===JSON.stringify(inputs.map(input=>[input.dataset.presenterPreparationFieldLabel,input.value])),'cleared draft did not restore exact defaults');
                      state.module='presenter';document.body.dataset.module='presenter';
                      refs.songList.innerHTML=renderServiceCurrentSidebar(service,[]);
                      check(!refs.songList.querySelector('[data-presenter-preparation-form]'),'obsolete form button remains');
                      window.inlineEnterCalls=[];
                      // Routing-only spy: actual atomic saves/failure/receipts have their own inline smoke.
                      commitPresenterInlineInput=async panel=>{inlineEnterCalls.push({itemId:panel.dataset.inlineItemId,serviceId:panel.dataset.serviceId});return true};
                    }""")
                    toggle = page.locator('[data-presenter-inline-toggle]').first
                    item_id = toggle.get_attribute('data-presenter-inline-toggle')
                    toggle.click()
                    panel = page.locator(f'.svc-outline-editor[data-inline-item-id="{item_id}"]')
                    field = panel.locator('input[data-presenter-preparation-field]').first
                    field.fill('Enter 저장 대상')
                    field.press('Enter')
                    assert page.evaluate('inlineEnterCalls') == [{'itemId': item_id, 'serviceId': '__prep_values_default__'}], 'Enter did not target its row'
                    assert field.input_value() == 'Enter 저장 대상', 'Enter routing lost draft'
                    field.dispatch_event('keydown', {'key': 'Enter', 'isComposing': True, 'bubbles': True})
                    assert page.evaluate('inlineEnterCalls.length') == 1, 'IME Enter triggered save'
                    page.unroute_all(behavior='wait')
                    print('PASS', engine, 'inline defaults, exact draft/default values, placeholder separation, row Enter and IME routing', flush=True)
                finally:
                    browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
