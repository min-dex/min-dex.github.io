"""Praise identity outranks shared liturgical headings. Offline, no output window."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch(headless=True)
                page = browser.new_page()
                page.route('**/*', lambda r: r.abort() if '.supabase.co/' in r.request.url or r.request.method not in ('GET', 'HEAD', 'OPTIONS') else r.continue_())
                page.goto(url + '?output=presenter', wait_until='domcontentloaded')
                page.wait_for_function("typeof state !== \"undefined\" && typeof compactSearchValue === \"function\" && !document.body.classList.contains('ui-booting') && (typeof buildPresenterSlidesForServiceItem === 'function')")
                result = page.evaluate('''() => {
                  const assert=(value,msg)=>{if(!value)throw Error(msg)};
                  const version={id:'test-version',name:'새찬송가',praise_types:['hymn'],forms:normalizeForms([
                    {id:'v1',label:'Verse 1',part_type:'Verse',part_number:1,lyrics:'첫 절 가사'},
                    {id:'v2',label:'Verse 2',part_type:'Verse',part_number:2,lyrics:'둘째 절 가사'},
                    {id:'v3',label:'Verse 3',part_type:'Verse',part_number:3,lyrics:'셋째 절 가사'},
                    {id:'c',label:'Chorus',part_type:'Chorus',lyrics:'후렴 가사'}])};
                  const song={id:'test-song',title:'테스트 찬송',hymn_no:'359',praise_types:['hymn'],versions:[version]};
                  state.songs=[song];
                  const service={id:'test-service',type_id:'sunday-third',date:'2026-07-26'};
                  const item={id:'test-item',label:'파송찬송',song_id:song.id,version_id:version.id,
                    _worshipSectionKey:'sending',_worshipSectionTitle:'공동체고백',
                    memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-V2-C-Int-V3-C-C',formPreset:{forms:['V1','V2','C','Int','V3','C','C'],strength:'manual'}})};
                  const before=JSON.stringify({song,item});
                  for(const title of ['공동체고백','사도신경','주기도문']){
                    const candidate={...item,_worshipSectionTitle:title};
                    assert(!isLiturgicalBodyServiceItem(candidate),'praise classified as body');
                    const plan=presenterFormPlanForServiceItem(version,candidate,song);
                    const slides=buildPresenterSlidesForServiceItem(candidate,service,0,{allowHydration:false});
                    assert(slides.filter(s=>s.type==='lyrics').map(s=>s.text).join('|')==='첫 절 가사|둘째 절 가사|후렴 가사|셋째 절 가사|후렴 가사|후렴 가사','saved repeats/sequence lost');
                    assert(slides.filter(s=>s.type==='blank').length===1,'interlude missing');
                    assert(!plan.warnings.length,'unresolved form');
                    assert(!slides.some(s=>String(s.formKey||'').startsWith('liturgical:')),'body path used');
                  }
                  for(const label of ['사도신경','주기도문','공동체고백']){
                    const body={id:'body',label,_worshipSectionKey:'sending',memo:''};
                    assert(isLiturgicalBodyServiceItem(body),'actual body lost');
                    assert(buildPresenterLiturgicalBodySlides(body,{},0,service,parseServiceItemMemo(body.memo),label).some(s=>s.type==='liturgical-body'||String(s.formKey||'').startsWith('liturgical:')),'actual body rendering lost');
                  }
                  assert(JSON.stringify({song,item})===before,'saved data mutated');
                  return 'three headings, saved repeats/interlude, actual liturgical siblings, immutable source';
                }''')
                print('PASS', engine, result)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
