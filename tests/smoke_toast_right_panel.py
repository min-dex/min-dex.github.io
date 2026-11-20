"""Notifications use the right panel's column and width (presenter and any open right sidebar)."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

MEASURE = '''async (module) => {
  // Exercise a real transition even when restored UI state already selected Presenter.
  if (module === 'presenter' && state.module === 'presenter') await switchModule('praise');
  await switchModule(module);
  applyRightSidebarVisibility(module === 'presenter');
  await new Promise((resolve, reject) => {
    let frames = 0;
    const ready = () => {
      const width = document.querySelector('.right-sidebar').getBoundingClientRect().width;
      const open = document.body.classList.contains('right-sidebar-open');
      if (module === 'presenter' ? open && width > 200 : !open) return resolve();
      if (++frames > 120) return reject(new Error(`right panel did not settle for ${module}`));
      requestAnimationFrame(ready);
    };
    ready();
  });
  showToast('송출 중인 화면을 갱신했어요.', 'info');
  const region = document.getElementById('toastRegion').getBoundingClientRect();
  const panel = document.querySelector('.right-sidebar').getBoundingClientRect();
  const toast = document.querySelector('#toastRegion .toast');
  toast.hidden = false;
  const card = toast.getBoundingClientRect();
  return {region: [region.left, region.right, region.width], panel: [panel.left, panel.right, panel.width],
          card: [card.left, card.right, card.width], inset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s3'))};
}'''


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            for width in (1440, 1100, 960):
                page = browser.new_page(viewport={'width': width, 'height': 800})
                page.add_init_script("sessionStorage.setItem('mindex.ui.module', 'presenter')")
                page.route('**/*supabase*/**', lambda route: route.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof showToast==='function' && !document.body.classList.contains('ui-booting')")
                near = lambda a, b: abs(a - b) <= 1
                m = page.evaluate(MEASURE, 'presenter')
                assert m['panel'][2] > 200, (width, m)
                assert near(m['region'][0], m['panel'][0]) and near(m['region'][1], m['panel'][1]), (width, m)
                assert near(m['card'][2], m['panel'][2] - 2 * m['inset']), (width, m)
                page.evaluate("document.querySelectorAll('#toastRegion .toast').forEach(t => t.remove())")
                other = page.evaluate(MEASURE, 'praise')  # no right panel: previous floating size is kept
                assert near(other['region'][2], min(360, width - 32)) and near(other['region'][1], width - other['inset'] - 5), (width, other)
                page.close()
            browser.close()
        print('PASS toast column and width follow the right panel at 1440/1100/960')
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
