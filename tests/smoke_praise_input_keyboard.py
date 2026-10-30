"""Offline real Praise input events: IME must not submit an unfinished draft."""
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
              const record={id,revision:1,metadata:{title:'입력 검증'},relations:{same_song:[],related:[]},
                content:{name:'원곡',forms:[{id:crypto.randomUUID(),part_type:'Lyrics',label:'Lyrics',lyrics:'첫 줄\\n둘째 줄\\n\\n다음 화면'}],
                  audio_set:{enabled:true,audioUrl:'https://example.test/audio.mp3',starts:[1,9]}}};
              installSingleSongSession([record],MindexSingleSong.createRepository({read:async()=>[],commit:async()=>{throw Error('unexpected write')}}));
              persistUiState=()=>{};state.client={};state.connectionError='';state.auth.session={user:{id:'fixture'}};
              state.module='praise';state.search='';state.selectedSongId=id;state.selectedVersionId=id;
              state.forms=structuredClone(record.content.forms);state.dirty.song=false;state.dirty.forms=false;
              window.inputSaves=0;saveAll=async()=>{inputSaves++};renderDetail();
              window.protectedInputState=JSON.stringify({forms:state.forms,audio:getSelectedVersion().audio_set,relations:state.singleSongCatalog.get(id).relations,items:state.serviceItems});
            }""")
            page.locator('[data-open-metadata]').click()
            result = page.evaluate("""() => {
              const failures=[];
              for(const selector of ['[data-song-field="title"]','[data-version-name-field]','[data-version-output-title-field]']){
                const field=document.querySelector(selector);if(!field)throw Error('Missing '+selector);
                field.focus();field.value='한글 입력';field.setSelectionRange(2,2);
                field.dispatchEvent(new Event('input',{bubbles:true}));
                for(const props of [{isComposing:true},{keyCode:229}]){
                  const before=inputSaves,event=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...props});
                  field.dispatchEvent(event);
                  if(inputSaves!==before||event.defaultPrevented)failures.push(selector+': IME submitted/prevented '+JSON.stringify(props));
                }
                if(document.activeElement!==field||field.selectionStart!==2)failures.push(selector+': focus/caret moved');
                for(const key of ['Tab']){
                  const before=inputSaves;field.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
                  if(inputSaves!==before)failures.push(selector+': '+key+' saved');
                }
                const before=inputSaves;
                field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
                if(inputSaves!==before+1)failures.push(selector+': ordinary Enter did not save once');
              }
              const beforeEscape=inputSaves;document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
              if(inputSaves!==beforeEscape)failures.push('Escape saved');
              if(protectedInputState!==JSON.stringify({forms:state.forms,audio:getSelectedVersion().audio_set,relations:state.singleSongCatalog.get(state.selectedSongId).relations,items:state.serviceItems}))failures.push('Protected content changed');
              return failures;
            }""")
            print(engine, result or 'PASS composition/229 ignored; Enter saves once; Escape/Tab do not save; focus/caret/content preserved', flush=True)
            failures.extend((engine, item) for item in result)
            page.set_viewport_size({'width':390, 'height':844})
            page.locator('[data-open-metadata]').click()
            field = page.locator('[data-version-output-title-field]')
            field.fill('모바일 입력 유지')
            field.focus()
            count = page.evaluate('inputSaves')
            page.keyboard.press('Tab')
            assert page.evaluate('inputSaves') == count
            assert field.input_value() == '모바일 입력 유지'
            assert not field.evaluate('(el)=>document.activeElement===el')
            print(engine, 'PASS 390px viewport title draft and actual Tab focus traversal', flush=True)
            browser.close()
finally:
    server.shutdown()
assert not failures, failures
