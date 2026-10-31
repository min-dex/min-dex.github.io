# coding: utf-8
"""Offline preview checks only; never loads the operational app or its data."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
import os
OUT = Path(os.environ.get('MINDEX_PREVIEW_OUTPUT', '/tmp/mindex-1-preview-evidence')); OUT.mkdir(parents=True, exist_ok=True)
for svg in ROOT.rglob('*.svg'):
    ET.parse(svg)
for theme in ('dark', 'light'):
    for size in (16, 32, 48, 64, 128, 180, 192, 256, 512, 1024):
        with Image.open(ROOT / 'icons' / f'icon-{theme}-{size}.png') as image:
            assert image.size == (size, size)
    with Image.open(ROOT / 'icons' / f'favicon-{theme}.ico') as image:
        assert {(16,16),(32,32),(48,48),(256,256)} <= image.ico.sizes()
assert not json.loads((ROOT / 'release-checklist.json').read_text())['all_features_release_approved']
with sync_playwright() as playwright:
    for engine in ('chromium', 'webkit'):
        browser = getattr(playwright, engine).launch()
        context = browser.new_context(viewport={'width':1280,'height':1000}, color_scheme='dark')
        page = context.new_page()
        errors = []
        external = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: external.append(request.url) if request.url.startswith(('https:', 'http:')) else None)
        page.goto((ROOT / 'preview.html').as_uri())
        assert page.locator('#releaseDialog').is_visible()
        assert page.evaluate("getComputedStyle(document.querySelector('.version')).fontSize === getComputedStyle(document.querySelector('.wordmark')).fontSize")
        page.keyboard.press('Escape')
        assert not page.locator('#releaseDialog').is_visible()
        page.reload()
        assert not page.locator('#releaseDialog').is_visible()
        page.locator('#homeIntro > summary').click()
        page.wait_for_function("localStorage.getItem('mindex1-preview.intro') === 'closed'")
        page.reload()
        assert not page.locator('#homeIntro').get_attribute('open')
        assert not page.locator('#homeIntro').evaluate('(x)=>x.open')
        page.get_by_role('button', name='1.0 업데이트 내용').click()
        assert page.locator('#releaseDialog').is_visible()
        page.get_by_role('button', name='확인했어요').click()
        page.wait_for_function("document.querySelector('#openRelease')===document.activeElement")
        # Follow OS changes until the user explicitly selects a preview theme.
        page.emulate_media(color_scheme='light')
        page.wait_for_function("document.documentElement.dataset.theme === 'light'")
        assert page.locator('html').get_attribute('data-theme') == 'light'
        assert page.locator('#favicon').get_attribute('href').endswith('favicon-light.svg')
        page.get_by_role('button', name='다크로 보기').click()
        page.reload()
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        page.locator('#homeIntro > summary').click()
        page.wait_for_function("document.querySelector('#homeIntro').open")
        page.screenshot(path=str(OUT / f'preview-dark{ "" if engine == "chromium" else "-webkit"}.png'), full_page=True)
        page.get_by_role('button', name='라이트로 보기').click()
        page.screenshot(path=str(OUT / f'preview-light{ "" if engine == "chromium" else "-webkit"}.png'), full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        # Force lazy gallery images into view before checking decoding.
        for img in page.locator('.shots img').all():
            img.scroll_into_view_if_needed()
            img.evaluate('(x)=>x.decode()')
        assert page.locator('img').evaluate_all('(xs)=>xs.every(x=>x.complete && x.naturalWidth>0)')
        assert not errors, errors
        assert not external, external
        context.close()
        denied = browser.new_context()
        denied.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage disabled')}})")
        page = denied.new_page()
        page.goto((ROOT / 'preview.html').as_uri())
        page.get_by_role('button', name='확인했어요').click()
        page.locator('#theme').click()
        assert not page.locator('#releaseDialog').is_visible()
        denied.close()
        browser.close()
        print(f'PASS {engine}: first-run/reopen, collapse persistence, theme/icon sync, equal type size, mobile, images, storage fallback, no external requests')
