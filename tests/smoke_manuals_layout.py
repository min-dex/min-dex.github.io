import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ("chrome", "webkit"):
            browser = launch_chromium(p) if engine == "chrome" else p.webkit.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof renderManualsDetail === 'function' && !document.body.classList.contains('ui-booting')")
            page.evaluate('document.fonts.ready')
            print(engine, page.evaluate('''() => {
              const check=(value,message)=>{if(!value)throw Error(message)};
              state.module='manuals';state.search='';render();
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
            page.locator('#detailPane').screenshot(path=f'/tmp/mindex-manuals-{engine}-desktop.png')
            section=page.locator('.manual-section').filter(has=page.get_by_role('heading',name='RIA 청년부 예배',exact=True))
            section.screenshot(path=f'/tmp/mindex-manuals-{engine}-order.png')
            page.set_viewport_size({"width": 640, "height": 1000})
            assert page.locator('.manuals-shell').evaluate('e=>e.scrollWidth<=e.clientWidth+2'), 'manual overflow at narrow width'
            page.evaluate('refs.detailPane.scrollTop=0;window.scrollTo(0,0)')
            page.locator('#detailPane').screenshot(path=f'/tmp/mindex-manuals-{engine}-mobile.png')
            page.evaluate("applyTheme('dark')")
            page.locator('#detailPane').screenshot(path=f'/tmp/mindex-manuals-{engine}-dark.png')
            browser.close()
finally:
    server.shutdown()
