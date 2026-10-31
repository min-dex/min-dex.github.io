"""Upcoming shortcut naming/layout; synthetic data, no operational side effects."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'))
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function('typeof serviceNavigationDetails === "function" && typeof state !== "undefined" && !document.body.classList.contains("ui-booting")')
   page.evaluate('''()=>{
    state.serviceTypes=[{id:'young-adult',name:'청년부 예배'},{id:'wednesday',name:'수요예배'},{id:'sunday-main',name:'주일예배 [3부]'}];
    window.rows=[{id:'a',date:'2026-11-01',type_id:'young-adult',alias:'청년부 야외예배',_worshipSourceRef:{no_gathering:true}},{id:'b',date:'2026-11-01',type_id:'sunday-main',alias:'온세대 찬양예배'},{id:'c',date:'2026-11-04',type_id:'wednesday',alias:'다니엘기도회'},{id:'d',date:'2026-11-04',type_id:'wednesday',alias:'수요예배'}];
    const afternoon={date:'2026-11-04',type_id:'sunday-afternoon',alias:'',_worshipSourceRef:{no_gathering:true,no_gathering_reason:'다니엘기도회로 대체'}};
    rows.push({...afternoon,id:'e'}, {...afternoon,id:'f',alias:'특별 모임'}, {...afternoon,id:'g',_worshipSourceRef:{no_gathering:true,no_gathering_reason:'집회 없음'}});
    state.serviceTypes.push({id:'holy-week-dawn',name:'특별새벽기도회'});
    rows.push({id:'dawn',date:'2026-11-04',type_id:'holy_week_dawn',alias:'감사 특별새벽기도회 <야외> & 긴 별명 (모임)'});
    window.before=JSON.stringify(rows);state.services=rows;state.selectedServiceId='b';
    window.expected=['청년부 예배 (야외예배)','주일예배 [3부] (온세대 찬양예배)','수요예배 (다니엘기도회)','수요예배','주일오후예배 (다니엘기도회)','주일오후예배 (특별 모임)','주일오후예배','새벽기도회 (감사 특별새벽기도회 <야외> & 긴 별명 (모임))'];
    if(serviceNavigationName(rows[1])!=='온세대 찬양예배')throw Error('other screen naming changed');
    const old=document.createElement('div');old.innerHTML=renderServiceSidebarDateGroups(rows);if(old.querySelector('.is-upcoming')||old.querySelectorAll('.service-sidebar-title')[1].textContent!=='온세대 찬양예배')throw Error('search result layout/name changed');
    document.body.innerHTML='<aside id="fixture" style="width:260px;max-width:100%;padding:15px;box-sizing:border-box">'+renderServiceSidebarDateGroups(rows,{upcoming:true})+'</aside>';
   }''')
   for theme in ('dark','light'):
    page.evaluate('(theme)=>document.body.dataset.theme=theme',theme)
    for width in (390,1440):
     page.set_viewport_size({'width':width,'height':900})
     result=page.evaluate('''()=>{
      const check=(ok,msg)=>{if(!ok)throw Error(msg)},root=document.querySelector('#fixture'),groups=[...root.querySelectorAll('.service-sidebar-date-group')];
      check(groups.length===2,'date duplicated');check(root.scrollWidth<=root.clientWidth,'overflow');
      check(JSON.stringify([...root.querySelectorAll('.service-sidebar-title')].map(n=>n.textContent))===JSON.stringify(expected),'visible labels '+JSON.stringify([...root.querySelectorAll('.service-sidebar-title')].map(n=>n.textContent)));
      for(const group of groups){const [date,stack]=group.children;check(date.getBoundingClientRect().right<=stack.getBoundingClientRect().left,'column collision');for(const node of stack.querySelectorAll('.service-sidebar-title'))check(getComputedStyle(node).textAlign==='right'&&node.scrollWidth<=node.clientWidth+1,'name truncated');}
      const buttons=[...root.querySelectorAll('button')];check(buttons[0].disabled,'absent state lost');buttons[1].focus();check(document.activeElement===buttons[1]&&buttons[1].dataset.serviceId==='b','target/focus');
      const alias=buttons.at(-1).querySelector('small');check(alias && getComputedStyle(alias).display==='block' && parseFloat(getComputedStyle(alias).fontSize)<parseFloat(getComputedStyle(alias.parentElement).fontSize),'secondary line size');
      check(!buttons[3].querySelector('small')&&!alias.children.length,'plain title or escaping');
      check(buttons.at(-1).getAttribute('aria-label').includes(expected.at(-1)), 'accessible label');
      let clicked;root.addEventListener('click',event=>{clicked=event.target.closest('button')?.dataset.serviceId},{once:true});alias.click();check(clicked==='dawn','alias click target');
      check(before===JSON.stringify(rows),'data changed');return {width:innerWidth,groups:groups.length};
     }''')
     print(engine,theme,'PASS',result,flush=True)
     page.screenshot(path=f'/tmp/mindex-upcoming-{engine}-{theme}-{width}.png')
   b.close()
finally:server.shutdown()
