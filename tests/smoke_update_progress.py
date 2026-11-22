"""The toolbar update button shows the download percentage the whole time it downloads."""
import tempfile
from pathlib import Path

from smoke_app import launch_chromium, start_local_app_server, sync_playwright

BRIDGE = '''
() => { window.mindexElectron = {isDesktop: true, platform: 'darwin',
  onUpdateState: cb => { window.__emitUpdate = cb; },
  getUpdateState: async () => ({ok: true, state: {status: 'idle'}}),
  checkForUpdates: async () => ({ok: true, state: {status: 'idle'}}),
  openBroadcast: async () => ({ok: true}),
  downloadUpdate: async () => ({ok: true}), installUpdate: async () => ({ok: true})};
  bindElectronDesktopEvents(); }
'''


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            for width in (1440, 900):
                page = browser.new_page(viewport={'width': width, 'height': 800})
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof bindElectronDesktopEvents==='function' && !document.body.classList.contains('ui-booting')")
                page.evaluate(BRIDGE)  # the native shell is simulated after the web app boots
                page.wait_for_timeout(400)
                measure = '''() => { const b=document.getElementById('desktopUpdateBtn'), l=b.querySelector('.desktop-update-progress'), items=[...b.parentElement.children].filter(e=>e.getBoundingClientRect().width);
                  const r=b.getBoundingClientRect(), a=b.parentElement.getBoundingClientRect(), lr=l.getBoundingClientRect();
                  return {text:l.textContent, shown:!l.hidden && lr.width>0, label:b.getAttribute('aria-label'), width:r.width, inside:r.left>=a.left-1 && r.right<=a.right+1,
                          labelInside:lr.left>=r.left-1 && lr.right<=r.right+1,
                          centers:items.map(e=>{const x=e.getBoundingClientRect();return x.left+x.width/2})}; }'''
                idle = page.evaluate(measure)
                assert not idle['shown'] and idle['label'] == '업데이트 확인', idle
                for percent, text in ((0, '0%'), (42.4, '42%'), (100, '100%')):
                    page.evaluate('percent => window.__emitUpdate({status:"downloading", percent, version:"9.9.9"})', percent)
                    page.wait_for_timeout(100)
                    m = page.evaluate(measure)
                    assert m['text'] == text and m['shown'] and m['inside'] and m['labelInside'], (width, percent, m)
                    assert m['label'] == f'업데이트 다운로드 중 {text}', m
                    assert abs(m['width'] - idle['width']) < 1, (idle, m)
                    gaps = [round(m['centers'][i + 1] - m['centers'][i], 2) for i in range(len(m['centers']) - 1)]
                    assert max(gaps) - min(gaps) < 1, (width, percent, gaps)
                    if width == 1440 and percent == 42.4:
                        screenshot = Path(tempfile.gettempdir()) / 'mindex-update-progress.png'
                        page.screenshot(path=str(screenshot), clip={'x': 0, 'y': 0, 'width': 1440, 'height': 120})
                page.evaluate('window.__emitUpdate({status:"downloaded", version:"9.9.9", presenterOpen:true})')
                page.wait_for_timeout(100)
                done = page.evaluate(measure)
                assert not done['shown'] and done['label'] == '업데이트 확인', done
                page.close()
            browser.close()
        print('PASS update percentage stays visible without disturbing six-button spacing (1440/900)')
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
