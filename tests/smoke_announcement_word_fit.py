"""Word boundaries and fitting in real output and a 406px preview; no DB access."""
import os,json
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from urllib.parse import urlsplit
server,url=start_local_app_server();results=[]
cases={
'lyrics-ko':'주님의 사랑으로 우리 모두 하나 되어\n세상 끝까지 주의 복음을 전하리라',
'lyrics-en':'Everlasting faithfulness and lovingkindness\nWe will worship together forevermore',
'lyrics-dense':'하나님의 사랑을 온 세상에 전하며 기쁨으로 찬양합니다\n'*6,
'ad-normal':'1. 다음 주 온세대 예배 안내 (오전 11시, 본당)\n2. 예배 후 교회학교 교사 모임이 있습니다.',
'ad-dense':'\n'.join(f'{i}. 온세대 예배와 교회학교 행사 안내입니다. 예배 후 교육관에서 함께 모여 주시기 바랍니다 (오후 2시).' for i in range(1,10)),
'ad-zones':'오늘도 청년부 예배에 오신 여러분을 환영합니다.\n1. 교회학교 행사에 함께해 주세요 (오후 2시).\n◇ 함께 기도해 주세요.',
'ad-long-ko':'오늘도 청년부 예배에 오신 여러분을 환영합니다.\n1. '+'하나님의변함없는사랑과은혜를기억하며감사함으로함께찬양합시다'*3+'\n◇ 안내입니다.',
'ad-long-en':'오늘도 청년부 예배에 오신 여러분을 환영합니다.\n1. '+'ChildrenAndYouthWorshipCelebrationRegistrationInformation'*3+'\n◇ Registration information.',
}
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname=='127.0.0.1' and r.request.method=='GET' else r.abort())
   page.goto(url+'?output=presenter');page.wait_for_function("typeof renderPresenterOutput==='function'&&document.getElementById('presenterOutputRoot')")
   for w in (1920,1280):
    page.set_viewport_size({'width':w,'height':round(w*9/16)})
    for chroma in (True,False):
     for name,text in cases.items():
      result=page.evaluate('''async ({name,text,chroma})=>{
       const ad=name.startsWith('ad-');const service={id:'audit',type_id:chroma?'sunday-main':'young-adult'};
       const slide=ad?buildPresenterSlidesForServiceItem({id:name,label:'광고',raw_title:text,_worshipSectionKey:'announcements',memo:serializeServiceItemMemo({elementType:'body',inputMode:'text'})},service,0).find(s=>s.announcementItems?.length):{id:name,type:'lyrics',elementType:PRESENTER_ELEMENT_TYPES.PRAISE,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,title:'찬양',text};
       if(!slide)throw Error('No announcement slide');
       const original=JSON.stringify(slide);
       renderPresenterOutput({serviceId:'audit',serviceType:chroma?'sunday-main':'young-adult',chromakey:chroma,slides:[slide],index:0,safetyBlank:false},{});
       await document.fonts.ready;
       const root=document.getElementById('presenterOutputRoot');const deadline=performance.now()+10000;
       while((root.getAttribute('aria-busy')==='true'||!root.querySelector('.presenter-slide'))&&performance.now()<deadline)await new Promise(r=>setTimeout(r,30));
       await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
       const measure=(root)=>{
        const boxes=[...root.querySelectorAll('.presenter-announcement-copy>span,.presenter-slide--lyrics>.presenter-slide-text>span')];const split=[],overflow=[];
        for(const body of boxes){
         const region=body.closest('.presenter-announcement-region,.presenter-announcement-items')||body.parentElement;const box=region.getBoundingClientRect();
         const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);let n;
         while(n=walker.nextNode())for(const m of n.textContent.matchAll(/\\S+/g)){
          let tops=[];for(let i=m.index;i<m.index+m[0].length;i++){
           const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const rect=[...r.getClientRects()].filter(r=>r.width>.5).sort((a,b)=>b.width-a.width)[0];if(!rect)continue;
           if(!tops.some(t=>Math.abs(t-rect.top)<2))tops.push(rect.top);
           if(rect.left<box.left-2||rect.right>box.right+2||rect.top<box.top-2||rect.bottom>box.bottom+2)overflow.push(m[0]);
          }if(tops.length>1)split.push(m[0]);
         }
        }
        return {count:boxes.length,split:[...new Set(split)],overflow:[...new Set(overflow)]};
       };
       await new Promise(r=>setTimeout(r,400));const output=measure(root.querySelector('.presenter-output-layer.is-active')||root);
       const preview=document.createElement('div');preview.className=root.className;preview.style.cssText='position:fixed;inset:auto;left:0;top:0;width:406px;height:228.375px';preview.innerHTML=renderPresenterSlideFrame(slide);document.body.append(preview);fitPresenterSongTitleText(preview);const small=measure(preview);preview.remove();
       if(JSON.stringify(slide)!==original)throw Error('Source mutated');if(!output.count||!small.count)throw Error('No measured text '+name);return {output,preview:small};
      }''',{'name':name,'text':text,'chroma':chroma})
      assert all(result[k]['count'] and not result[k]['split'] and not result[k]['overflow'] for k in ('output','preview')),(engine,w,chroma,name,result)
      record={'engine':engine,'width':w,'chroma':chroma,'case':name,**result};results.append(record)
      if w==1920 and (any(result[k]['split'] or result[k]['overflow'] for k in ('output','preview')) or name in ('lyrics-ko','ad-dense','ad-long-ko','ad-long-en')):
       page.screenshot(path=f'/private/tmp/audit-{engine}-{chroma}-{name}.png')
      print(json.dumps(record,ensure_ascii=False),flush=True)
   browser.close()
finally:
 server.shutdown();open('/private/tmp/announcement-word-fit.json','w').write(json.dumps(results,ensure_ascii=False,indent=2))
