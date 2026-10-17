"""Real shell/editor roles in both themes; no database access. --url audits a release."""
import os,argparse,sys
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
server,url=(None,args.url) if args.url else start_local_app_server()
fixture=Path(__file__).with_name('smoke_editor_pane_bounds.py').read_text().split("page.evaluate('''",1)[1].split("''')",1)[0]
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(90000)
   page.route('**/*',lambda r:r.continue_() if r.request.method in ['GET','HEAD','OPTIONS'] and '.supabase.co/' not in r.request.url else r.abort())
   page.goto(url,wait_until='domcontentloaded');page.wait_for_function("typeof renderManualsDetail==='function'&&!document.body.classList.contains('ui-booting')");page.evaluate(fixture)
   for theme in ['light','dark']:
    page.evaluate('(t)=>applyTheme(t)',theme)
    for kind in ['home','worship','manuals','references','song-metadata','scripture-metadata','prep','section','templates']:
     page.evaluate('''k=>{if(k==='home'){state.module='home';renderHomeDetail()}else if(k==='worship'){state.module='service';renderServiceListDetail()}else if(k==='manuals'){state.module='manuals';renderManualsDetail()}else auditOpen(k)}''',kind)
     result=page.evaluate('''()=>{
      const root=getComputedStyle(document.body),expected=root.getPropertyValue('--ui-surface-field').trim();const probe=document.createElement('div');probe.style.background=expected;document.body.append(probe);const field=getComputedStyle(probe).backgroundColor;probe.remove();
      let count=0;for(const e of refs.detailPane.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=hidden]),textarea,select')){
       if(!e.getClientRects().length||e.classList.contains('is-invalid'))continue;
       if(getComputedStyle(e).backgroundColor!==field)throw Error('field mismatch '+e.className+' '+getComputedStyle(e).backgroundColor);count++;
      }
      return count;
     }''')
     if engine=='chromium':page.screenshot(path=f'/tmp/surfaces-{theme}-{kind}.png')
     print(engine,theme,kind,'PASS',result,'fields',flush=True)
    page.evaluate('''()=>{
     const host=document.createElement('div');host.id='color-qa';host.innerHTML='<button class="btn primary">저장</button><input class="svc-presenter-input-control is-invalid"><span class="service-date-status is-upcoming">다가오는 예배</span><span class="service-date-status is-today">오늘 예배</span><span class="svc-board-subgroup-head"><span>찬양</span></span>';document.body.append(host);
     const css=getComputedStyle(document.body),resolve=v=>{const x=document.createElement('span');x.style.color=`var(${v})`;host.append(x);return getComputedStyle(x).color};
     if(getComputedStyle(host.querySelector('.is-invalid')).color!==resolve('--warn'))throw Error('invalid not warning');
     if(getComputedStyle(host.querySelector('.is-upcoming')).color!==resolve('--ink-3'))throw Error('upcoming not neutral');
     if(getComputedStyle(host.querySelector('.is-today')).color!==resolve('--accent'))throw Error('today not accent');
     const input=document.createElement('input');host.append(input);input.focus();if(getComputedStyle(input).outlineWidth!=='2px')throw Error('missing focus');host.remove();
    }''')
   b.close()
finally:
 if server:server.shutdown()
