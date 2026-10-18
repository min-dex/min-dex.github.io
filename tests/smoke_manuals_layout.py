import os
import sys
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ("chrome", "webkit"):
            browser = launch_chromium(p) if engine == "chrome" else p.webkit.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            page.add_init_script("Element.prototype.requestFullscreen=async()=>{};window.open=()=>null")
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof renderManualsDetail === 'function' && !document.body.classList.contains('ui-booting')")
            page.evaluate('document.fonts.ready')
            print(engine, page.evaluate('''() => {
              const check=(value,message)=>{if(!value)throw Error(message)};
              state.module='manuals';state.search='';render();syncBrowserHistory({replace:true});
              check(JSON.stringify([...refs.songList.querySelectorAll('[data-home-module]')].map(e=>e.textContent.trim()))===JSON.stringify(['교회력','예배 매뉴얼','역대 찬양 콘티','참고자료']),'operations sidebar order: '+JSON.stringify([...refs.songList.querySelectorAll('[data-home-module]')].map(e=>e.textContent.trim())));
              const sections=[...refs.detailPane.querySelectorAll('.manual-section')];
              const links=[...refs.detailPane.querySelectorAll('.manuals-index a')];
              check(sections.length>8,'manual sections missing');
              check(links.length===sections.length,'manual index count');
              check(refs.detailPane.querySelector('.manuals-notice'),'manual source notice missing');
              check(!refs.detailPane.querySelector('.manual-checklist-group'),'manual bullets incorrectly split into groups');
              check(refs.detailPane.querySelector('.manuals-head p'),'manual summary missing');
              check(sections.every((section,index)=>section.id && links[index].getAttribute('href')===`#${section.id}`),'manual index targets');
              check(sections.every(section=>section.querySelector('.manual-section-head') && section.querySelector('.manual-section-content')),'manual section hierarchy');
              const categories=[...refs.detailPane.querySelectorAll('.manual-category-title')].map(e=>e.textContent);
              check(JSON.stringify(categories)===JSON.stringify(['예배 이해·부서별 순서','준비·진행·마무리','민덱스 사용법']),'manual category order');
              const find=title=>sections.find(s=>s.querySelector('h4').textContent===title);
              const expected={
                "어린이부 예배": [
                  "사도신경 Apostles’ Creed (신앙고백)",
                  "찬양 Praise (4 songs)",
                  "예배의 부름 (Opening)",
                  "성경봉독 Scripture Reading",
                  "설교 Sermon",
                  "기도 Prayer",
                  "봉헌 Offering",
                  "나래파송 Sending (공동체고백)",
                  "주기도문 Lord’s Prayer",
                  "광고 Announcements"
                ],
                "TOV 청소년부 예배": [
                  "준비 Preparation",
                  "사도신경 Apostles’ Creed (신앙고백)",
                  "찬양 Praise (3 songs)",
                  "대표기도 Opening Prayer",
                  "봉헌 Offering",
                  "성경봉독 Scripture Reading",
                  "설교 Sermon",
                  "결단 Commitment",
                  "주기도문 Lord’s Prayer",
                  "광고 Announcements"
                ],
                "RIA 청년부 예배": [
                  "준비 Preparation",
                  "사도신경 Apostles’ Creed (신앙고백)",
                  "대표기도 Opening Prayer",
                  "찬양 Praise (4 songs)",
                  "성경봉독 Scripture Reading",
                  "설교 Sermon",
                  "결단 Commitment",
                  "봉헌 Offering",
                  "광고 Announcements",
                  "파송찬양 Sending Song",
                  "축도 Benediction"
                ]
              };
              for(const [title,order] of Object.entries(expected)){
                const section=find(title);
                check(JSON.stringify([...section.querySelectorAll('.manual-order > li > strong')].map(e=>e.textContent))===JSON.stringify(order),title+' source order changed');
                check(section.textContent.includes('봉헌찬양')&&section.textContent.includes('봉헌기도'),'offering substeps missing');
              }
              check(!refs.detailPane.textContent.includes('귀여운')&&!refs.detailPane.textContent.includes('꿈꾸는'),'department adjectives retained');
              check(find('예배의 구성과 네 가지 흐름').textContent.includes('Classic Components')&&find('예배의 구성과 네 가지 흐름').textContent.includes('Fourfold Order of Worship'),'worship order English headings missing');
              const children=find('어린이부 예배'),youth=find('TOV 청소년부 예배'),youngAdult=find('RIA 청년부 예배');
              for(const section of [children,youth,youngAdult]){
                check(section.textContent.includes('Offertory Song')&&section.textContent.includes('Prayer of Dedication')&&section.textContent.includes('Fellowship'),'nested English names missing');
              }
              check(youth.textContent.includes('Corporate Prayer')&&youth.textContent.includes('Prayer of Commitment'),'youth nested names missing');
              check(youngAdult.textContent.includes('Corporate Prayer')&&youngAdult.textContent.includes('Song of Response')&&youngAdult.textContent.includes('Prayer of Commitment'),'young adult nested names missing');
              check(find('유치부 예배').textContent.includes('확인 필요'),'unknown preschool order invented');
              check(find('순서와 미확인 항목의 적용 기준').textContent.includes('확인 필요'),'unconfirmed scheduling missing');
              check(find('음악 관리와 페이드아웃 정지').textContent.includes('기본 체크'),'fade default missing');
              check(find('사진·타이밍 편집').textContent.includes('0.2초'),'photo validation missing');
              check(find('자동 넘김과 수동 전환').textContent.includes('음악은 계속'),'manual override contract missing');
              check(refs.detailPane.querySelectorAll('.manual-sources a[href^="https://www.notion.so/"]').length===2,'original source links missing');
              check(!refs.detailPane.querySelector('[data-song-timing-open],[data-service-item-commit],[data-presenter-action]'),'manual caused operational actions');
              return 'PASS grouped navigation, exact source department order, unknowns, current music/photo controls and read-only source links';
            }'''))
            for width in (1440, 640, 390):
                page.set_viewport_size({"width": width, "height": 900})
                before = page.evaluate("({url:location.href,history:history.length})")
                links = page.locator('.manuals-index a')
                for activation in ('click', 'Enter'):
                    for index in range(links.count()):
                        link = links.nth(index)
                        target = link.get_attribute('href')
                        if activation == 'click':
                            link.click()
                        else:
                            link.focus()
                            page.keyboard.press('Enter')
                        page.wait_for_function("([id,url])=>state.module==='manuals' && location.href===url && document.activeElement===document.querySelector(id+' h4')", arg=[target,before['url']])
                        result = page.evaluate("""id=>{
                            const pane=refs.detailPane,section=pane.querySelector(id),heading=section.querySelector('h4');
                            const r=heading.getBoundingClientRect(),p=pane.getBoundingClientRect();
                            return {visible:r.top>=p.top&&r.bottom<=p.bottom,history:history.length,outer:window.scrollY};
                        }""",target)
                        assert result['visible'], (engine,width,activation,index,result)
                        assert result['history']==before['history'] and result['outer']==0, result
                print(engine, width, links.count(), 'PASS all TOC click/Enter targets, route/history preserved, heading focus and internal scroll')
                page.locator('#detailPane').screenshot(path=f'/tmp/mindex-manuals-{engine}-{width}-linked.png')
            page.set_viewport_size({'width':1440,'height':1100})
            page.evaluate('refs.detailPane.scrollTop=0')
            page.locator('#detailPane').screenshot(path=f'/tmp/mindex-manuals-{engine}-desktop.png')
            section=page.locator('.manual-section').filter(has=page.get_by_role('heading',name='RIA 청년부 예배',exact=True))
            section.screenshot(path=f'/tmp/mindex-manuals-{engine}-order.png')
            page.set_viewport_size({"width": 640, "height": 1000})
            assert page.locator('.manuals-shell').evaluate('e=>e.scrollWidth<=e.clientWidth+2'), 'manual overflow at narrow width'
            page.evaluate('refs.detailPane.scrollTop=0;window.scrollTo(0,0)')
            page.locator('#detailPane').screenshot(path=f'/tmp/mindex-manuals-{engine}-mobile.png')
            page.evaluate("applyTheme('dark')")
            page.locator('#detailPane').screenshot(path=f'/tmp/mindex-manuals-{engine}-dark.png')
            # Original Notion hosts can be handed off outside macOS WebKit before a popup
            # event. Check exact host URLs in Linux CI; on macOS WebKit retain DOM URL
            # assertions and exercise the same anchors against isolated local responses.
            context = page.context
            context.route('https://www.notion.so/**', lambda r: r.fulfill(status=200, content_type='text/html', body='<title>Isolated manual source</title>'))
            context.route('**/manual-source-fixture/*', lambda r: r.fulfill(status=200, content_type='text/html', body='<title>Isolated manual source</title>'))
            sources = page.locator('.manual-sources a')
            original_urls = sources.evaluate_all('es=>es.map(e=>e.href)')
            assert original_urls == page.evaluate('MINDEX_MANUALS[0].sources.map(s=>s.url)')
            mapped = sys.platform == 'darwin' and engine == 'webkit'
            if mapped:
                sources.evaluate_all("es=>es.forEach((e,i)=>e.href=new URL('/manual-source-fixture/'+i,location.href).href)")
            route_before = page.url
            history_before = page.evaluate('history.length')
            for index in range(sources.count()):
                for activation in ('click', 'Enter'):
                    link = sources.nth(index)
                    expected = link.get_attribute('href')
                    with context.expect_page(timeout=10000) as opened:
                        if activation == 'click':
                            link.click()
                        else:
                            link.focus()
                            page.keyboard.press('Enter')
                    popup = opened.value
                    popup.wait_for_load_state()
                    assert popup.url == expected
                    assert popup.evaluate('window.opener===null')
                    assert page.url == route_before and page.evaluate('state.module') == 'manuals'
                    assert page.evaluate('history.length') == history_before
                    popup.close()
            print(engine, 'PASS both source links click/Enter, noopener and app route/history preserved;', 'macOS isolated destinations' if mapped else 'original source URLs')
            browser.close()
finally:
    server.shutdown()
