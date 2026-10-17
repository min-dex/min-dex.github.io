"""Startup branding owns auth/initial data, never the home button or later loads."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright

OVERRIDES=r'''
connectClient=()=>{state.client={};state.module='home';state.selectedSongId=null;state.selectedBookCode=null;state.selectedScriptureId=null;};
requestPresenterScreens=async()=>{};
worshipAtomicClient=async()=>({});
initializeAuth=async()=>{window.bootPhase='auth';await new Promise(resolve=>window.resolveBootAuth=resolve);};
canUseClientData=()=>window.bootAllowed!==false;
loadServiceData=async()=>{window.bootPhase='data';await new Promise((resolve,reject)=>{window.resolveBootData=resolve;window.rejectBootData=reject;});};
'''

def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as p:
   for engine in ('chromium','webkit'):
    browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
    for outcome in ('success','failure','signed-out'):
     page=browser.new_page()
     def route(r):
      parsed=urlsplit(r.request.url)
      if parsed.hostname not in ('127.0.0.1','localhost') or r.request.method!='GET':r.abort();return
      if parsed.path in ('/app.js','/app.runtime.js'):r.fulfill(body=Path(parsed.path.lstrip('/')).read_text()+OVERRIDES,content_type='text/javascript');return
      r.continue_()
     page.route('**/*',route)
     page.goto(url,wait_until='domcontentloaded')
     page.wait_for_function("window.bootPhase==='auth'")
     assert page.locator('.mindex-boot').is_visible()
     assert page.locator('#brandNameHome .loading-status').count()==0
     if outcome=='signed-out':page.evaluate("window.bootAllowed=false")
     page.evaluate('resolveBootAuth()')
     if outcome!='signed-out':
      page.wait_for_function("window.bootPhase==='data'")
      page.wait_for_timeout(200)
      assert page.locator('.mindex-boot').is_visible(),'branding left before data finished'
      page.evaluate("rejectBootData(Error('fixture failure'))" if outcome=='failure' else 'resolveBootData()')
     page.wait_for_function("!document.body.classList.contains('ui-booting')")
     page.wait_for_function("getComputedStyle(document.querySelector('.mindex-boot')).visibility==='hidden'")
     assert page.locator('.topbar-brand-icon').is_visible()
     page.evaluate("state.loadingModules.add('praise');state.module='praise';renderLoadingStatus()")
     assert not page.locator('.mindex-boot').is_visible(),'later load reopened splash'
     assert page.locator('.topbar-brand-icon').is_visible(),'later load hid home cross'
     page.close()
     print('PASS',engine,outcome,'auth/data gate, static home cross, later load isolation',flush=True)
    browser.close()
 finally:server.shutdown()
if __name__=='__main__':main()
