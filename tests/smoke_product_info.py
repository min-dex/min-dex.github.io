"""Product/build labels with static fixtures only; no app state, profile or updates."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
import json
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for channel in ('development','test','release','missing'):
    page=browser.new_page(viewport={'width':390,'height':844})
    build={'schema':1,'productVersion':'0.1.1','channel':channel,'sourceCommit':'a'*40,'buildVersion':'fixture-build','changes':['입력 안정성을 개선했습니다.'],'upgradeNotes':'저장 후 업데이트해 주세요.'}
    page.route('**/mindex-build.json',lambda r:r.fulfill(body=json.dumps(build),content_type='application/json'))
    page.route('**/index.html',lambda r:r.fulfill(body='<html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="styles.monitor.css"></head><body><dialog class="monitor-panel" open></dialog></body></html>',content_type='text/html'))
    page.goto(url)
    page.evaluate("window.isPresenterOutputRoute=()=>false")
    if channel=='test':page.evaluate('(build)=>window.mindexElectron={isDesktop:true,getBuildInfo:async()=>({ok:true,installedVersion:"0.1.1-test",build})}',build)
    page.add_script_tag(url=url.replace('index.html','mindex.product-info.js'))
    page.wait_for_function("!document.querySelector('.monitor-panel').textContent.includes('확인 중')")
    text=page.locator('.monitor-panel').inner_text()
    assert {'development':'개발 빌드','test':'테스트 앱','release':'Mindex 0.1.1','missing':'제품 배포 정보 없음'}[channel] in text, (channel,text)
    if channel!='missing':
     page.locator('summary').click();assert '입력 안정성' in page.locator('.monitor-panel').inner_text()
     if channel=='test':assert '설치 버전 0.1.1-test' in page.locator('.monitor-panel').inner_text()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.close()
   browser.close();print('PASS',engine,'development/test/release/missing receipt, installed vs build labels, changelog and narrow layout',flush=True)
finally:server.shutdown()
