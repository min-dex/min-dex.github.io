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
                '꿈꾸는 어린이부 예배':['사도신경 (신앙고백)','찬양 (4곡)','예배의 부름','성경봉독','설교','기도','봉헌','나래파송 (공동체고백)','주기도문','광고'],
                'TOV 청소년부 예배':['준비','사도신경 (신앙고백)','찬양 (3곡)','대표기도','봉헌','성경봉독','설교','결단','주기도문','광고'],
                'RIA 청년부 예배':['준비','사도신경 (신앙고백)','대표기도','찬양 (4곡)','성경봉독','설교','결단','봉헌','광고','파송찬양','축도']
              };
              for(const [title,order] of Object.entries(expected)){
                const section=find(title);
                check(JSON.stringify([...section.querySelectorAll('.manual-order > li > strong')].map(e=>e.textContent))===JSON.stringify(order),title+' source order changed');
                check(section.textContent.includes('봉헌찬양')&&section.textContent.includes('봉헌기도'),'offering substeps missing');
              }
              check(find('귀여운 유치부 예배').textContent.includes('확인 필요'),'unknown preschool order invented');
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
