"""Offline Praise header geometry across themes, widths and media error states."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, launch_chromium, sync_playwright

server, url = start_local_app_server()
failures = []
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch(headless=True)
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda r: r.abort())
            page.route('**/app.runtime.js*', lambda r: r.fulfill(
                path=str(Path(__file__).resolve().parents[1] / 'app.js'), content_type='text/javascript'))
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("typeof renderNativeVersionMetadata==='function' && !document.body.classList.contains('ui-booting')")
            page.evaluate("""() => {
              const id='SONG-CONT-0001-0001';
              const record={id,revision:1,metadata:{title:'아주 긴 찬양 제목을 입력해도 음원 요약과 악보 버튼을 읽을 수 있어야 해요'},relations:{same_song:[],related:[]},
                content:{name:'원곡',forms:[{id:crypto.randomUUID(),part_type:'Lyrics',label:'Lyrics',lyrics:'첫 줄\\n둘째 줄\\n\\n다음 화면'}],
                  audio_set:{enabled:true,duration:20,audioFingerprint:'layout-fixture',audioUrl:new URL('/tests/layout-audio.mp3',location.href).href,starts:[1,9]}}};
              installSingleSongSession([record],MindexSingleSong.createRepository({read:async()=>[],commit:async()=>{throw Error('unexpected write')}}));
              persistUiState=()=>{};state.client={};state.connectionError='';state.auth.session={user:{id:'fixture'}};
              state.module='praise';state.search='';state.selectedSongId=id;state.selectedVersionId=id;
              state.forms=structuredClone(record.content.forms);state.dirty.song=false;state.dirty.forms=false;
              renderDetail();
              window.protectedLayoutState=JSON.stringify({forms:state.forms,audio:getSelectedVersion().audio_set,relations:state.singleSongCatalog.get(id).relations,items:state.serviceItems});
            }""")
            import json
            out=Path(os.environ.get('MINDEX_PRAISE_LAYOUT_OUTPUT','/private/tmp/mindex-praise-header-layout'));out.mkdir(parents=True,exist_ok=True)
            for theme in ('light','dark'):
                page.evaluate('(theme)=>applyTheme(theme)',theme)
                for width in (1280,390):
                    page.set_viewport_size({'width':width,'height':844})
                    page.evaluate("state.metadataPopupOpen=false;renderSongList();renderDetail();document.body.dataset.module='praise'")
                    panel=page.locator('[data-praise-version-media]')
                    if panel.evaluate('(e)=>e.open'):panel.locator('summary').click()
                    for surface in ('lyrics','media','metadata'):
                        if surface=='metadata':page.locator('[data-open-metadata]').click()
                        if surface=='media':
                            if not page.locator('[data-praise-version-media]').evaluate('(e)=>e.open'):
                                page.locator('[data-praise-version-media] > summary').focus()
                                page.keyboard.press('Enter')
                            page.evaluate("document.querySelector('[data-praise-version-media] audio').dispatchEvent(new Event('error'))")
                            assert page.locator('[data-praise-audio-error]').is_visible()
                        page.screenshot(path=str(out/f'{engine}-{theme}-{width}-{surface}.png'),full_page=True)
                        report=page.evaluate("""()=>({theme:document.documentElement.dataset.theme,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
                          native:Boolean(getSelectedSong()?._singleSongRecord),bodyTheme:document.body.dataset.theme,bodyClass:document.body.className,headerRects:[...document.querySelector('.version-compare-title').children].map(e=>{const r=e.getBoundingClientRect();return {cls:e.className,top:r.top,bottom:r.bottom,height:r.height}}),controls:[...document.querySelectorAll('#detailPane input,#detailPane textarea,#detailPane button,.metadata-popover input,.metadata-popover button')].filter(e=>e.getClientRects().length).map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,cls:e.className,label:e.getAttribute('aria-label')||e.title||e.textContent.trim().slice(0,45),size:s.fontSize,weight:s.fontWeight,height:r.height,padding:s.padding,color:s.color,background:s.backgroundColor,disabled:e.disabled,x:r.x,right:r.right}})})""")
                        (out/f'{engine}-{theme}-{width}-{surface}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
                        assert page.evaluate("protectedLayoutState===JSON.stringify({forms:state.forms,audio:getSelectedVersion().audio_set,relations:state.singleSongCatalog.get(state.selectedSongId).relations,items:state.serviceItems})")
                        rects=[r for r in report['headerRects'] if r['height']>0]
                        for previous,current in zip(rects,rects[1:]):
                            if current['top']<previous['bottom']-0.5:failures.append((engine,theme,width,surface,previous['cls'],current['cls']))
                        print(engine,theme,width,surface,'checked',flush=True)
            browser.close()
finally:
    server.shutdown()
assert not failures, failures
