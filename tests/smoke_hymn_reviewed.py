"""Offline reviewed-hymn playback; no services, DB writes or output windows."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url + '?output=presenter', wait_until='domcontentloaded')
            page.wait_for_function("typeof presenterHymnOnceOnlyIntro === 'function' && typeof serializeServiceItemMemo === 'function' && typeof presenterFormPlanForServiceItem === 'function'")
            result = page.evaluate('''() => {
              const assert=(ok,message)=>{if(!ok)throw Error(message)};
              const checked=[];
              for(const [id,number,count] of [
                ['5bf20e2d-cb7e-5c2a-86ca-0a75acfdd7c0','163',4],
                ['7ab06cc7-99cf-5e67-b236-78a6758734e8','166',3]
              ]) {
                const intro=Array(count).fill('할렐루야').join(' ')+'\\n';
                const forms=[1,2].map(n=>({id:'review-v'+n,label:'Verse '+n,
                  part_type:'Verse',part_number:n,sort_order:n,lyrics:intro+'본절 '+n+'\\n\\n끝말 할렐루야'}));
                const version={id,hymn_no:number,praise_types:['hymn'],forms};
                const song={id:'isolated-'+number,hymn_no:number,praise_types:['hymn'],versions:[version]};
                for(const sequence of [null,['V2'],['V2','V1','V2']]) {
                  const item={id:'isolated-item',label:'찬양',memo:serializeServiceItemMemo(sequence ? {
                    formHint:sequence.join('-'),formPreset:{forms:sequence,hint:sequence.join('-'),strength:'manual'}
                  } : {})};
                  const before=JSON.stringify({version,item,song});
                  const plan=presenterFormPlanForServiceItem(version,item,song);
                  assert(plan.forms.filter(f=>f.lyrics.startsWith(intro)).length===1,'intro count '+number);
                  assert(plan.forms[0]._presenterTitle,'default Title missing');
                  const content=plan.forms.filter(f=>!f._presenterTitle);
                  assert(content.length===(sequence?.length||2),'selected form count');
                  assert(content[0].id===(sequence ? 'review-v2' : 'review-v1'),'first selected verse');
                  assert(!plan.warnings.length,'unexpected warning');
                  assert(JSON.stringify({version,item,song})===before,'saved object mutated');
                  const reopened=JSON.parse(JSON.stringify(item));
                  assert(JSON.stringify(presenterFormPlanForServiceItem(version,reopened,song))===JSON.stringify(plan),'memo roundtrip');
                  checked.push(number+':'+(sequence||'default'));
                }
              }
              return checked;
            }''')
            print('PASS real app hymn intro plans and memo roundtrip:', result)
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
