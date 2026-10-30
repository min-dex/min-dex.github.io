"""Bulletin overflow warnings and failed saves use distinct readable status colors."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
STATUS_PROBE='''(e,token)=>{
      const s=getComputedStyle(e),p=document.createElement('span');p.style.color=`var(${token})`;e.append(p);const expected=getComputedStyle(p).color;p.remove();
      const c=v=>{const a=(v.match(/[\\d.]+/g)||[]).map(Number);return v.startsWith('color(srgb')?a.map((n,i)=>i<3?n*255:n):a},blend=(a,b)=>{const x=a[3]??1;return [0,1,2].map(i=>a[i]*x+b[i]*(1-x)).concat(1)},L=c=>c.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
      let bg=[255,255,255,1];const parents=[];for(let n=e;n;n=n.parentElement)parents.unshift(n);for(const n of parents)bg=blend(c(getComputedStyle(n).backgroundColor),bg);
      const a=L(c(s.color)),b=L(bg);return {actual:s.color,expected,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    }'''
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for theme in ('light','dark'):
    context=browser.new_context(viewport={'width':1100,'height':900});context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page=context.new_page();page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("!!window.MindexBulletin&&!document.body.classList.contains('ui-booting')");prepare_server_state_fixture(page)
    page.evaluate('''theme=>{
     document.body.dataset.theme=theme;document.documentElement.dataset.theme=theme;const B=MindexBulletin;
     const service={id:'status-fixture',service_type_id:'children',service_date:'2026-11-01'},source=B.resolveSource({service,sections:[],elements:[]});
     const row={revision:1,...B.storedValue({...B.normalizeSnapshot({fields:{news:'기존 소식'},settings:{design:'children',theme:''}}),source})};
     window.docs=new Map();refs.detailPane.replaceChildren();const host=document.createElement('div');host.style.height='800px';document.body.append(host);
     window.editor=B.mount(host,{documents:docs,serviceId:service.id,scope:'status-fixture',services:[{id:service.id,label:'상태 검증'}],loadDraft:async()=>row,loadSource:async()=>source,saveDraft:async()=>{throw Error('fixture save rejected')}});
    }''',theme)
    page.wait_for_function("document.querySelector('[data-bulletin-field=news]')?.disabled===false")
    news=page.locator('[data-bulletin-field="news"]');news.fill('① '+('넘침 경고 확인용 문구 '*200))
    status=page.locator('.bulletin-status');page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('영역 넘침')")
    assert status.get_attribute('data-state')=='warning'
    color=status.evaluate(STATUS_PROBE,'--warn')
    assert color['actual']==color['expected'] and color['ratio']>=4.5,(engine,theme,'warning',color)
    before=news.input_value();page.locator('[data-bulletin-save]').click();page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('fixture save rejected')")
    assert status.get_attribute('data-state')=='error'
    contrast=status.evaluate(STATUS_PROBE,'--danger')
    assert contrast['actual']==contrast['expected'] and contrast['ratio']>=4.5,(engine,theme,contrast)
    assert news.input_value()==before and page.evaluate("docs.get('status-fixture').dirty")
    assert page.locator('iframe.bulletin-print-frame').count()==0
    print('PASS',engine,theme,'overflow warning vs failed-save danger, AA contrast',(round(color['ratio'],2),round(contrast['ratio'],2)),'draft/message preserved; production save/print 0',flush=True)
    context.close()
   browser.close()
finally:server.shutdown()
