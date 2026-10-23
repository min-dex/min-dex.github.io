"""Read-only UI summaries across future worship templates; no operational writes."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.route('**/*supabase*/**', lambda r: r.abort())
            page.goto(url + '?output=presenter', wait_until='domcontentloaded')
            page.wait_for_function("typeof serviceItemSummaryDisplayParts === 'function'")
            print(page.evaluate('''() => {
              const check = (value, message) => { if (!value) throw Error(message); };
              const types = ['sunday-first','sunday-second','sunday-main','sunday-afternoon',
                'wednesday','friday','monthly','children','nursery','youth','young-adult',
                'special','holy-week-dawn','omer'];
              let compared = 0;
              let screenshot = '';
              for (const type_id of types) {
                const service = {id: 'future-' + type_id, type_id, date: '2099-10-25'};
                state.services.push(service);
                const scaffold = buildWorshipServiceScaffold(service.id, type_id, {service, items: []});
                state.serviceItems[service.id] = groupWorshipElements(scaffold.sections, scaffold.elements)[service.id] || [];
                // Special services intentionally have no fixed order: exercise user-added empty slots.
                if (type_id === 'special') state.serviceItems[service.id] = ['설교','대표기도'].map((label,index) => ({
                  id: 'special-' + index, service_id: service.id, label, raw_title: '', assignee: '', sort_order: index + 1,
                  memo: serializeServiceItemMemo({elementType:'title_person'})
                }));
                const items = getServiceItems(service.id);
                const before = JSON.stringify(items);
                const slides = items.flatMap((item,index) => buildPresenterSlidesForServiceItem(item,service,index));
                const outputBefore = JSON.stringify(slides);
                const groups = groupPresenterSlidesBySection(slides, service.id);
                for (const subgroup of groups.flatMap(group => group.subgroups)) {
                  const contexts = presenterBoardSubgroupInputContexts(service.id, subgroup);
                  if (contexts.length !== 1) continue;
                  const {item,index} = contexts[0];
                  if (serviceItemConnectedPraise(item) || isMonthlyCorporatePrayerGroupItem(item,parseServiceItemMemo(item.memo))) continue;
                  const sidebar = document.createElement('div');
                  sidebar.innerHTML = renderServiceOutlineChildRow(service,item,index,-1,slides);
                  const controller = document.createElement('div');
                  controller.innerHTML = renderPresenterBoardSubgroup(subgroup,-1,service.id,{showHead:true});
                  const title = sidebar.querySelector('strong')?.textContent || '';
                  const heading = controller.querySelector('.svc-board-subgroup-head');
                  check((heading?.querySelector('strong')?.textContent || '') === title, type_id + ': title ' + item.label);
                  check(heading?.querySelector('span')?.textContent === sidebar.querySelector('.service-outline-kind')?.textContent, type_id + ': label ' + item.label);
                  check(Boolean(sidebar.querySelector('.service-outline-badge')) === [...controller.querySelectorAll('.svc-presenter-warning')].some(x=>x.textContent==='입력 필요'), type_id + ': missing badge ' + item.label);
                  const assignee = controller.querySelector('[data-service-item-field="assignee"]');
                  if (assignee?.value) check(title.includes(assignee.value), type_id + ': assignee ' + item.label);
                  if (type_id === 'sunday-main' && item.label === '설교') screenshot = sidebar.innerHTML + controller.innerHTML;
                  compared++;
                }
                check(JSON.stringify(items) === before, type_id + ': input mutated');
                check(JSON.stringify(items.flatMap((item,index)=>buildPresenterSlidesForServiceItem(item,service,index))) === outputBefore, type_id + ': output mutated');
              }
              // Empty, partial, complete and legacy person-in-title input all agree.
              const service = {id:'summary-states',type_id:'special',date:'2099-10-25'};
              state.services.push(service);
              for (const [raw_title,assignee,expectedTitle,missing] of [
                ['', '', '', true], ['', '테스트 목사', '', true],
                ['테스트 설교', '', '테스트 설교', true],
                ['테스트 설교', '테스트 목사', '테스트 설교', false],
                ['테스트 목사', '', '', true], ['설교', '테스트 목사', '설교', true]
              ]) {
                const item = {id:'summary-item',service_id:service.id,label:'설교',raw_title,assignee,
                  memo:serializeServiceItemMemo({elementType:'title_person'})};
                state.serviceItems[service.id] = [item];
                const before = JSON.stringify(item);
                const model = serviceItemEditorModel(item,{service});
                const host = document.createElement('div');
                host.innerHTML = renderPresenterServiceTextInputs(item,0,model,parseServiceItemMemo(item.memo));
                check(host.querySelector('[data-service-item-field="raw_title"]').value === expectedTitle,'title input misclassified');
                check(host.querySelector('[data-service-item-field="assignee"]').value === (assignee || (raw_title==='테스트 목사' ? raw_title : '')),'assignee input misclassified');
                const slides = buildPresenterSlidesForServiceItem(item,service,0);
                host.innerHTML = renderServiceOutlineChildRow(service,item,0,-1,slides);
                check(Boolean(host.querySelector('.service-outline-badge'))===missing,'partial input hides missing badge');
                check(JSON.stringify(item)===before,'draft changed');
              }
              check(presenterBoardSubgroupContentTitle({sectionKey:'sermon',assignee:'테스트 목사'},'설교') === '', 'person used as sermon title');
              check(presenterBoardSubgroupContentTitle({sectionKey:'sermon',contentTitle:'실제 제목',assignee:'테스트 목사'},'설교') === '실제 제목','real title lost');
              document.documentElement.className = '';
              document.body.className = '';
              document.documentElement.dataset.theme = document.body.dataset.theme = 'dark';
              document.body.innerHTML = '<main id="summary-fixture" style="max-width:1000px;padding:24px;display:grid;grid-template-columns:240px minmax(0,1fr);gap:24px;align-items:start">'+screenshot+'</main>';
              return `PASS ${types.length} future service types, ${compared} editable summaries, partial inputs and unchanged output/data`;
            }'''))
            for width in (1280, 720):
                page.set_viewport_size({"width": width, "height": 900})
                assert page.locator('#summary-fixture [data-service-item-field="raw_title"]').input_value() == ''
                person = page.locator('#summary-fixture [data-service-item-field="assignee"]')
                assert person.input_value() == '김남영 목사'
                person.focus()
                assert person.evaluate('(el)=>el===document.activeElement')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path='/tmp/mindex-future-outline.png')
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
