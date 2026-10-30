"""Audit bulk-input examples using each service's real template and parser."""
import json
import os
from urllib.parse import urlsplit

os.environ["MINDEX_SMOKE_OFFLINE"] = "1"

import smoke_app
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    smoke_app.extract_supa_config = lambda: ('', '')
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ("chrome", "webkit"):
                browser = launch_chromium(p) if engine == "chrome" else p.webkit.launch()
                page = browser.new_page()
                page.route("**/*", lambda route: route.continue_() if urlsplit(route.request.url).netloc == urlsplit(url).netloc and route.request.method in ("GET", "HEAD") else route.abort())
                page.route("**/mindex-release.json*", lambda route: route.fulfill(json={"version": "inline-source-test"}))
                page.add_init_script("window.open=()=>null;window.print=()=>{throw Error('print forbidden')}")
                page.goto(url+"?mindexSmokeRaw=1", wait_until="domcontentloaded")
                page.wait_for_function("typeof presenterPreparationPlaceholderForService === 'function' && !document.body.classList.contains('ui-booting')")
                result = page.evaluate("""() => {
                  const results=[],failures=[];
                  const check=(value,message)=>{if(!value)failures.push(message)};
                  const cases=Object.keys(SERVICE_TYPE_DISPLAY_NAMES).filter(t=>!/[가-힣]/.test(t))
                    .map(type=>[type,'2026-09-13']);
                  for(const date of ['2026-08-07','2026-08-14','2026-08-21','2026-08-28',
                    '2026-09-04','2026-09-11','2026-09-18','2026-09-25']) cases.push(['friday',date]);
                  for(const [type,date] of cases){
                    const target=type==='friday'?autoFridayServiceTarget(date):{};
                    const service={...target,id:'matrix-'+type+date,type_id:target.typeId||type,date,
                      _worshipSourceRef:target.sourceRef};
                    state.services=[service];
                    state.selectedServiceId=service.id;
                    state.loadedWorshipServiceIds=new Set([service.id]);
                    state.serviceTypes=[{id:type,name:SERVICE_TYPE_DISPLAY_NAMES[type]}];
                    const scaffold=buildWorshipServiceScaffold(service.id,service.type_id,{service});
                    state.serviceItems={[service.id]:groupWorshipElements(scaffold.sections,scaffold.elements)[service.id]||[]};
                    const items=servicePrepEditorItems(service.id);
                    const examples=presenterPreparationPlaceholderForService(service);
                    const expected=items.filter(i=>presenterServiceInputHasEditableField(i,service)).flatMap(i=>
                      presenterPreparationPlaceholderLinesForItem(i,service,presenterServiceInputItem(i,service)));
                    const parsed=parsePresenterPreparationInput(expected.length?examples:'');
                    const plan=planPresenterPreparationEntries(parsed.entries,service);
                    check(!parsed.errors.length && !plan.errors.length,`${type} ${date}: ${[...parsed.errors,...plan.errors].join(', ')}`);
                    check(parsed.entries.length===expected.length,`${type}: missing examples ${parsed.entries.length}/${expected.length}`);
                    check(plan.planned.every(p=>!p.projected || items.some(i=>i.id===p.projected.id)),`${type}: synthetic target`);
                    check(!/^(대기 영상|사도신경|주기도문):/m.test(examples),`${type}: fixed content example`);
                    const form=expected.length?presenterPreparationFormFromExamples(examples):'';
                    const blank=parsePresenterPreparationInput(form,{skipEmptyLabels:true});
                    check(form.split('\\n').filter(Boolean).length===(expected.length?examples.split('\\n').length:0),`${type}: form label count`);
                    const half=expected.length?examples.split('\\n').map((line,i)=>i%2?line:line.slice(0,line.search(/[:：]/)+1)+' ').join('\\n'):'';
                    const partial=parsePresenterPreparationInput(half,{skipEmptyLabels:true});
                    check(!partial.errors.length,`${type}: half-filled form errors: ${partial.errors.join(', ')}`);
                    check(expected.length<2||(partial.entries.length>0&&partial.entries.length<expected.length),`${type}: half-filled entries ${partial.entries.length}/${expected.length}`);
                    check(!blank.errors.length && !blank.entries.length,`${type}: blank form must apply nothing: ${blank.errors.join(', ')} ${blank.entries.map(e=>e.label+'='+e.content).join(', ')}`);
                    const host=document.createElement('div');
                    host.style.width='300px';
                    host.innerHTML=renderServiceCurrentSidebar(service,[]);
                    document.body.append(host);
                    const inputs=[...host.querySelectorAll('[data-presenter-preparation-field]')];
                    check(inputs.length===presenterPreparationStructuredFields(service).length,`${type} ${date}: rendered field count differs ${JSON.stringify({actual:inputs.map(input=>input.dataset.presenterPreparationFieldLabel),expected:presenterPreparationStructuredFields(service).map(field=>field.label),items:items.map(item=>({label:item.label,id:item.id}))})}`);
                    const fieldValues=presenterPreparationFieldValues(service,presenterPreparationDisplayTextForService(service));
                    const actual=inputs.map(input=>({label:input.dataset.presenterPreparationFieldLabel,value:input.value}));
                    const expectedValues=fieldValues.map(field=>({label:field.label,value:field.value}));
                    const canonical=rows=>JSON.stringify(rows.map(row=>[row.label,row.value]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
                    check(actual.every(row=>row.label),`${type} ${date}: field without label`);
                    check(new Set(inputs.map(input=>JSON.stringify([input.closest(".svc-outline-editor")?.dataset.inlineItemId,input.dataset.presenterPreparationFieldLabel,input.dataset.preparationRole]))).size===inputs.length,`${type} ${date}: duplicate field binding`);
                    check(canonical(actual)===canonical(expectedValues),`${type} ${date}: exact label/value mapping differs ${JSON.stringify({actual,expected:expectedValues})}`);
                    check(inputs.every(input=>input.closest('.svc-outline-editor[data-inline-item-id][data-service-id]')),`${type} ${date}: field missing inline item owner`);
                    const panels=[...host.querySelectorAll('.svc-outline-editor')];
                    const toggles=[...host.querySelectorAll('[data-presenter-inline-toggle]')];
                    check(panels.length===toggles.length&&new Set(panels.map(panel=>panel.dataset.inlineItemId)).size===panels.length,`${type} ${date}: duplicate or missing inline editor`);
                    check(panels.every(panel=>panel.hidden&&panel.dataset.serviceId===service.id&&toggles.some(toggle=>toggle.dataset.presenterInlineToggle===panel.dataset.inlineItemId&&toggle.getAttribute('aria-controls')===panel.id)),`${type} ${date}: inline toggle ownership mismatch`);
                    check(!host.querySelector('[data-presenter-preparation-form]'),`${type}: form button remains`);
                    host.remove();
                    results.push({type,date,lines:parsed.entries.length,fields:inputs.length,missing:0,duplicates:0});
                  }
                  check(presenterPreparationPlaceholderLinesForItem({label:'참고 화면'},null,{mode:'asset',memo:{}}).length===0,'asset example');
                  check(presenterPreparationPlaceholderLinesForItem({label:'주기도문'},null,{mode:'benediction',memo:{benedictionReplacement:{}}}).length===0,'replaced benediction example');
                  if(failures.length)throw Error(failures.join('\\n'));
                  return results;
                }""")
                print(engine, json.dumps(result, ensure_ascii=False), flush=True)
                page.unroute_all(behavior="wait")
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
