"""Reading verses belong to the sermon without a second editable element."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1440, 'height': 1000})
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(url + '?mindexSmokeRaw=1', wait_until='domcontentloaded')
                page.wait_for_function("typeof buildServicePresenterSlidesUncached === 'function'")
                result = page.evaluate('''() => {
                  const service = {id:'sermon-fixture',type_id:'sunday-main',date:'2026-09-27'};
                  const reading = {id:'reading',service_id:service.id,label:'성경봉독',
                    raw_title:'출애굽기 17:1-2',sort_order:1,
                    _worshipSectionId:'reading-section',_worshipSectionKey:'scripture_reading',
                    _worshipSlotKey:'word.reading',memo:serializeServiceItemMemo({
                      elementType:'scripture_body',inputMode:'scripture',
                      manualScripture:{reference:'출애굽기 17:1-2',verses:[
                        {number:'1',text:'이스라엘 자손의 온 회중이'},
                        {number:'2',text:'백성이 모세와 다투어 이르되'}]}})};
                  const sermon = {id:'sermon',service_id:service.id,label:'설교',
                    raw_title:'불평이 기적으로',assignee:'김남영 목사',sort_order:2,
                    _worshipSectionId:'sermon-section',_worshipSectionKey:'sermon',
                    _worshipSlotKey:'sermon.title',memo:serializeServiceItemMemo({elementType:'title_person'})};
                  const citation = {id:'citation',service_id:service.id,label:'인용 구절',sort_order:3,
                    _worshipSectionId:'sermon-section',_worshipSectionKey:'sermon',
                    _worshipSlotKey:'sermon.citation.1',memo:serializeServiceItemMemo({elementType:'scripture_body'})};
                  state.services=[service];state.serviceItems[service.id]=[reading,sermon,citation];
                  const build=()=>buildServicePresenterSlidesUncached(service.id,{
                    service,items:state.serviceItems[service.id],allowHydration:false});
                  const slides=build();
                  const body=slides.filter(s=>s.elementId==='sermon'&&s.type==='scripture');
                  if(body.length!==2) throw Error('Missing sermon verses: '+JSON.stringify(slides));
                  if(body.some(s=>s.sectionId!=='sermon-section'||!s.scriptureContext.startsWith('sermon')))
                    throw Error('Wrong sermon ownership');
                  const title=slides.findIndex(s=>s.elementId==='sermon');
                  if(slides[title+1]!==body[0]||slides[title+2]!==body[1]) throw Error('Wrong slide order');
                  if(slides.filter(s=>s.elementId==='reading'&&s.type==='scripture').length!==2)
                    throw Error('Reading changed');
                  if(state.serviceItems[service.id].length!==3) throw Error('Created a domain element');
                  const html=renderPresenterSlideBoard(slides,0,service.id);
                  refs.detailPane.innerHTML=html;
                  applyPresenterPreviewScales(refs.detailPane);
                  const sermonHtml=renderPresenterSlideFrame(body[0]);
                  if(!sermonHtml.includes('이스라엘 자손의 온 회중이')) throw Error('Missing rendered text');
                  const memo=parseServiceItemMemo(reading.memo);
                  memo.manualScripture.verses[0].text='수정한 성경봉독 본문';
                  reading.memo=serializeServiceItemMemo(memo);
                  state.serviceItems[service.id]=[reading,sermon,citation];
                  if(!build().some(s=>s.elementId==='sermon'&&s.text.includes('수정한 성경봉독 본문')))
                    throw Error('Reading update not reflected');
                  return {verses:body.length,contexts:body.map(s=>s.scriptureContext),htmlHasText:html.includes('이스라엘 자손의 온 회중이')};
                }''')
                assert result['htmlHasText'], result
                thumb = page.locator('[data-presenter-element-key="sermon"][data-presenter-slide-id*="scripture:"]').first
                thumb.scroll_into_view_if_needed()
                assert thumb.is_visible()
                page.screenshot(path=f'/tmp/sermon-reading-{engine}.png', full_page=True)
                print('PASS', engine, result, flush=True)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
