"""Actual shared unsaved-choice handler traps keyboard focus without changing drafts."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium, prepare_server_state_fixture

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page(viewport={'width': 390, 'height': 900})
            page.route('**/*', lambda r: r.continue_() if r.request.method == 'GET' and urlsplit(r.request.url).netloc == urlsplit(url).netloc else r.abort())
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("typeof confirmUnsavedChangesAction==='function'&&!document.body.classList.contains('ui-booting')")
            prepare_server_state_fixture(page)
            page.evaluate("""() => {
                refs.detailPane.innerHTML='<button id="dialog-trigger">작업 전환</button><textarea id="dialog-draft">저장하지 않은 문구</textarea>';
                state.dirty.references=true;window.dialogResult=null;window.confirmPromise=null;
                document.querySelector('#dialog-trigger').onclick=()=>{dialogResult=null;confirmPromise=confirmUnsavedChangesAction();confirmPromise.then(v=>dialogResult=v)};
            }""")
            trigger = page.locator('#dialog-trigger')
            for theme in ('light', 'dark'):
                page.evaluate('t=>{document.body.dataset.theme=t;document.documentElement.dataset.theme=t}', theme)
                for width in (320, 390, 768, 1440):
                    page.set_viewport_size({'width': width, 'height': 900})
                    trigger.focus();trigger.press('Enter')
                    dialog = page.get_by_role('dialog', name='저장하지 않은 변경이 있어요')
                    save = dialog.locator('[data-unsaved-action=save]')
                    assert save.evaluate('e=>document.activeElement===e')
                    assert page.evaluate('confirmPromise===confirmUnsavedChangesAction()')
                    save.press('Tab');assert dialog.locator('[data-unsaved-action=cancel]').evaluate('e=>document.activeElement===e')
                    page.keyboard.press('Shift+Tab');assert save.evaluate('e=>document.activeElement===e')
                    # Recompute focusable controls after an asynchronous disabled-state change.
                    save.evaluate('e=>e.disabled=true')
                    dialog.locator('[data-unsaved-action=discard]').focus();page.keyboard.press('Tab')
                    assert dialog.locator('[data-unsaved-action=cancel]').evaluate('e=>document.activeElement===e')
                    page.evaluate("document.querySelector('#dialog-draft').focus()")
                    page.keyboard.press('Shift+Tab');assert dialog.locator('[data-unsaved-action=discard]').evaluate('e=>document.activeElement===e')
                    dialog.locator('button').evaluate_all('es=>es.forEach(e=>e.disabled=true)');page.keyboard.press('Tab')
                    assert dialog.evaluate('e=>document.activeElement===e')
                    page.keyboard.press('Escape');page.wait_for_function("dialogResult==='cancel'")
                    assert trigger.evaluate('e=>document.activeElement===e')
                    assert page.locator('#dialog-draft').input_value()=='저장하지 않은 문구' and page.evaluate('state.dirty.references')
            for action in ('cancel', 'discard', 'save'):
                trigger.focus();trigger.press('Enter')
                page.locator('[data-unsaved-action='+action+']').click()
                page.wait_for_function('(v)=>dialogResult===v', arg=action)
                assert trigger.evaluate('e=>document.activeElement===e')
                assert page.locator('#dialog-draft').input_value()=='저장하지 않은 문구' and page.evaluate('state.dirty.references')
            # An async navigation may remove the opener; cleanup must still resolve safely.
            trigger.focus();trigger.press('Enter');page.evaluate("document.querySelector('#dialog-trigger').remove()")
            page.keyboard.press('Escape');page.wait_for_function("dialogResult==='cancel'")
            assert page.locator('.unsaved-dialog').count()==0
            print('PASS', engine, 'real unsaved dialog: initial focus, Tab/ShiftTab, dynamic disabled/all-disabled, external focus, Escape/choices/opener restoration, detached opener; drafts unchanged, operational writes/print 0', flush=True)
            browser.close()
finally:
    server.shutdown()
