import argparse
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    args = parser.parse_args()
    server, url = (None, args.url) if args.url else start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_function("typeof renderPresenterControlState === 'function'")
            result = page.evaluate('''() => {
              const service={id:'outline-fixture',type_id:'young-adult',date:'2026-09-06',title:'테스트 예배'};
              const item={id:'praise-fixture',service_id:service.id,label:'찬양 2',raw_title:'250 구주의 십자가 보혈로',
                song_id:'song-fixture',version_id:'old',sort_order:1};
              state.client=state.client||{};state.auth.session={user:{id:'offline-fixture'}};state.connectionError='';
      state.module='presenter'; state.selectedServiceId=service.id;
              state.services=[service]; state.serviceItems={[service.id]:[item]};
              state.songs=[]; clearSearchCaches();
              refs.songList.innerHTML=renderServiceCurrentSidebar(service);
              refs.detailPane.innerHTML=renderServicePresenterControls(service,presenterSlidesForService(service.id),false,0);
              const before=refs.songList.textContent;
              const staleMarkup=refs.songList.innerHTML;
              state.songs=[{id:'song-fixture',title:'구주의 십자가 보혈로',hymn_no:'250',versions:[
                {id:'old',name:'통일 182',hymn_no:'통 182',forms:[{id:'v1',part_type:'Verse',part_number:1,lyrics:'첫 줄\\n둘째 줄'}]}
              ]}]; clearSearchCaches();
              refreshPresenterForService(service.id);
              const after=refs.songList.textContent;
              const row=refs.songList.querySelector('[data-service-outline-item-id="praise-fixture"]');
              const slideIndex=Number(row?.dataset.serviceOutlineSlide);
              const slides=presenterSlidesForService(service.id);
              refs.songList.innerHTML=staleMarkup;
              state.serviceError=''; state.serviceTypes=[{id:'young-adult',name:'청년부 예배'}];
              renderPresenterDetail();
              const fullRender=refs.songList.textContent;
              const scrolls=[];
              refs.detailPane.scrollTo=options=>scrolls.push(options);
              handleServiceOutlineSlideClick(refs.songList.querySelector('[data-service-outline-item-id="praise-fixture"]'));
              return {before,after,fullRender,slideIndex,slide:slides[slideIndex]?.title,label:row?.getAttribute('aria-label'),
                immediate:scrolls.length>0 && scrolls.every(options=>options.behavior==='auto')};
            }''')
            assert '250 구주의' in result['before'], result
            assert '통 182 구주의' in result['after'], result
            assert '통 182 구주의' in result['fullRender'], result
            assert '통 182 구주의' in result['label'], result
            assert result['slideIndex'] >= 0 and '구주의' in result['slide'], result
            assert result['immediate'], result
            print('PASS delayed song hydration refreshes outline title and slide target; outline jumps are immediate')
            details = page.evaluate("""() => {
              const service = state.services[0];
              const cases = [
                {label:'설교',raw_title:'하나님의 소원',assignee:'김목사 목사'},
                {label:'특송',raw_title:'말씀 앞에서',assignee:'청년부 찬양팀'},
                {label:'대표기도',raw_title:'정진화 장로',assignee:'정진화 장로'},
                {label:'특송',raw_title:'말씀 앞에서',assignee:''},
                {label:'특송',raw_title:'청년부 찬양팀',assignee:'청년부 찬양팀'},
                {label:'특송',raw_title:'',assignee:'청년부 찬양팀'},
              ];
              const before = JSON.stringify(cases);
              const rows = cases.map((item,index) => {
                const host = document.createElement('div');
                host.innerHTML = renderServiceOutlineChildRow(service,item,index,-1,[]);
                return {text:host.querySelector('strong')?.textContent || '',
                  hint:host.querySelector('button').title,
                  aria:host.querySelector('button').getAttribute('aria-label')};
              });
              return {rows,unchanged:before === JSON.stringify(cases)};
            }""")
            expected = ['하나님의 소원 / 김목사 목사', '말씀 앞에서 / 청년부 찬양팀',
                        '정진화 장로', '말씀 앞에서', '청년부 찬양팀', '청년부 찬양팀']
            assert details['unchanged'], details
            for row, text in zip(details['rows'], expected):
                assert row['text'] == text, details
                assert text in row['hint'] and text in row['aria'], details
            print('PASS outline titles include assignees without duplicate names or source mutations')
            browser.close()
    finally:
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
