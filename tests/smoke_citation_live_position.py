"""Adding a live citation reference must not move the on-air position to the element's first slide."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

SCRIPT = '''async ({autoOutput, startVerse, added}) => {
  const check=(v,m)=>{if(!v)throw Error(m)};
  const serviceId='citation-position',elementId='cit-el';
  state.bibleTranslations=[{id:'translation',name:'개역개정'}];
  const rows=(book,chapter,verses)=>verses.map(verse=>({book_code:book,chapter,verse,text:'본문'+verse}));
  state.bibleVerseCache.set(bibleVerseCacheKey('translation','MAT',5),rows('MAT',5,[45,46,47,48,49,50]));
  state.bibleVerseCache.set(bibleVerseCacheKey('translation','JHN',3),rows('JHN',3,[16,17]));
  state.bibleVerseCacheVersion++;
  state.services=[{id:serviceId,type_id:'fixture'}];state.selectedServiceId=serviceId;state.module='presenter';
  state.serviceItems[serviceId]=[{id:elementId,service_id:serviceId,label:'인용 구절',raw_title:'마 5:45-48',
    memo:JSON.stringify({elementType:'scripture_body',scriptureReferences:['마 5:45-48']})}];
  state.presenter.serviceId=serviceId;
  validateScriptureReferences=async()=>({valid:true,references:[{}]});
  isPresenterOutputWindowOpen=()=>true;presenterControllerIsLive=()=>true;
  publishPresenterState=()=>{};renderPresenterControlState=()=>{};updateSaveState=()=>{};showToast=()=>{};
  const refresh=refreshPresenterForService;
  saveServiceItemPatch=async()=>{refresh(serviceId,{renderControls:false});return true};
  refresh(serviceId,{publish:false,renderControls:false});
  const verseOf=()=>{const s=state.presenter.slides[state.presenter.index];return s?.scriptureVerse||0};
  state.presenter.index=state.presenter.slides.findIndex(s=>s.type==='scripture'&&Number(s.scriptureVerse)===startVerse);
  check(state.presenter.index>=0 && verseOf()===startVerse,'fixture did not start on verse '+startVerse);
  const input=document.createElement('input');
  input.dataset.serviceId=serviceId;input.dataset.presenterCitationElementId=elementId;
  presenterCitationAutoOutput=autoOutput;input.value=added;
  const result=await appendPresenterCitationReference(input);
  check(result.ok,'append failed '+JSON.stringify(result));
  return {verse:verseOf(),slide:state.presenter.slides[state.presenter.index]?.id,count:state.presenter.slides.length};
}'''


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            for added, expected_verse in (('마 5:49', 47), ('요 3:16', 47)):
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(url + '?output=presenter', wait_until='domcontentloaded')
                page.wait_for_function("typeof appendPresenterCitationReference==='function' && !document.body.classList.contains('ui-booting')")
                result = page.evaluate(SCRIPT, {'autoOutput': False, 'startVerse': 47, 'added': added})
                assert result['verse'] == expected_verse, (added, result)
                page.close()
            browser.close()
        print('PASS live citation append keeps the on-air verse (same chapter and other book)')
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
