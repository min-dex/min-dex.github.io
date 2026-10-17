"""Explicit network diagnostic: public static files only; never executes Mindex."""
import json
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://min-dex.github.io/'

def main():
    html = (ROOT / 'index.html').read_text()
    version = json.loads((ROOT / 'mindex-release.json').read_text())['version']
    files = []
    for group in ('modules', 'styles'):
        block = re.search(r'const ' + group + r' = \[(.*?)\];', html, re.S)[1]
        files.extend(re.findall(r'"([^"]+)"', block))
    assert files and all(re.fullmatch(r'(?:vendor/)?[A-Za-z0-9._-]+\.(?:js|css)', name) for name in files)
    urls = [ORIGIN + name + ('' if name.startswith('vendor/') else '?v=' + version) for name in files]
    samples = []
    with sync_playwright() as playwright:
        for _ in range(4):
            browser = playwright.chromium.launch(headless=True)
            try:
                page = browser.new_page()
                # A non-HTML file establishes same origin without app/DB execution.
                page.goto(ORIGIN + 'favicon.ico', wait_until='load', timeout=30000)
                result = page.evaluate('''async urls => {
                  const start = performance.now();
                  const files = await Promise.all(urls.map(async url => {
                    const begin = performance.now();
                    try {
                      const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
                      const headerMs = performance.now() - begin;
                      const bytes = (await response.arrayBuffer()).byteLength;
                      return {path: new URL(url).pathname, status: response.status, headerMs,
                        totalMs: performance.now() - begin, bytes};
                    } catch (error) {
                      return {path: new URL(url).pathname, error: String(error), totalMs: performance.now() - begin};
                    }
                  }));
                  return {totalMs: performance.now() - start, files};
                }''', urls)
                samples.append(result)
                print(json.dumps({'sample': len(samples), 'totalMs': result['totalMs'],
                                  'failed': [f['path'] for f in result['files'] if f.get('status') != 200]}), flush=True)
            finally:
                browser.close()
    output = ROOT / 'output/startup-network/static-delivery.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'version': version, 'samples': samples}, indent=2) + '\n')

if __name__ == '__main__':
    main()
