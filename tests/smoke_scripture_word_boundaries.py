"""Korean eojeol and English words stay whole in actual scripture output."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

texts={
 'ko':'하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라',
 'en':'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
 'ko-long':'다윗과 이스라엘 장로들과 천부장들이 가서 여호와의 언약궤를 즐거이 메고 오벧에돔의 집에서 올라왔는데',
 'en-long':'Moreover the word of the LORD came unto Jeremiah the second time, while he was yet shut up in the court of the prison, saying, Thus saith the LORD the maker thereof, the LORD that formed it, to establish it; the LORD is his name;',
}
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname=='127.0.0.1' and r.request.method=='GET' else r.abort())
   page.goto(url+'?output=presenter');page.wait_for_function("typeof renderPresenterOutput==='function'&&document.getElementById('presenterOutputRoot')")
   page.evaluate('document.fonts.ready')
   for width in (1920,1280):
    page.set_viewport_size({'width':width,'height':round(width*9/16)})
    for context in ('reading','sermon','citation','citation-chromakey','sermon-chromakey'):
     for language,text in texts.items():
      result=page.evaluate('''async ({context,text})=>{
       const lower=context.endsWith('chromakey');
       const slide={id:'boundary-fixture',elementType:PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT,layout:PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,type:'scripture',scriptureContext:context,referenceBook:'요한복음',referenceRange:'3:16',scriptureVerse:16,title:'요한복음 3:16',text,citationBodyText:text};
       renderPresenterOutput({serviceId:'boundary-fixture',serviceType:'sunday-main',chromakey:lower,slides:[slide],index:0,safetyBlank:false},{});
       await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
       const root=document.getElementById('presenterOutputRoot');
       const selector='.presenter-scripture-reading-text,.presenter-slide--scripture .presenter-slide-text span';
       const deadline=performance.now()+10000;
       while((!root.querySelector(selector)||root.getAttribute('aria-busy')==='true')&&performance.now()<deadline)await new Promise(r=>setTimeout(r,30));
       await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
       const body=root.querySelector(selector);
       if(!body)throw Error('Scripture output not ready: '+context);
       const style=getComputedStyle(body),bounds=body.getBoundingClientRect();
       const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);let node;const split=[],lines=[],glyphs=[];
       while(node=walker.nextNode())for(const match of node.textContent.matchAll(/\\S+/g)){
        const tops=new Set();for(let i=match.index;i<match.index+match[0].length;i++){
         // WebKit includes zero-width line-boundary rects; measure the visible glyph.
         const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const r=[...range.getClientRects()].filter(r=>r.width>0.5).sort((a,b)=>b.width-a.width)[0];if(!r)continue;tops.add(Math.round(r.top));glyphs.push(r);
         let line=lines.find(l=>Math.abs(l.top-r.top)<2);if(!line){line={top:r.top,right:r.right};lines.push(line);}line.right=Math.max(line.right,r.right);
        }if(tops.size>1)split.push(match[0]);
       }
       const reading=body.closest('.presenter-scripture-reading');const frame=reading||body.parentElement;const box=frame.getBoundingClientRect();
       const range=document.createRange();range.selectNodeContents(body);const rects=glyphs;
       return {split,align:style.textAlign,last:style.textAlignLast,space:style.whiteSpace,
        box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},rects:rects.map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),inside:rects.every(r=>r.left>=box.left-2&&r.right<=box.right+2&&r.top>=box.top-2&&r.bottom<=box.bottom+2),
        justified:lines.length<2||Math.abs(lines[0].right-bounds.right)<Math.max(3,parseFloat(style.fontSize)*.08),lines:lines.length,size:style.fontSize};
      }''',{'context':context,'text':text})
      if not result['inside'] or result['split'] or not result['justified']:page.screenshot(path='/private/tmp/scripture-boundary-failure.png')
      assert not result['split'] and result['inside'] and result['justified'],(engine,width,context,language,result)
      assert result['align']=='justify' and result['last']=='left' and result['space']=='pre-wrap',result
      if width==1920 and context in ('reading','sermon-chromakey'):
       page.screenshot(path=f'/private/tmp/scripture-words-{engine}-{context}-{language}.png')
     print('PASS',engine,width,context,'Korean/English word boundaries, justification and fit',flush=True)
   browser.close()
finally:server.shutdown()
