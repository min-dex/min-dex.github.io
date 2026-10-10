/* Deliberately limited inline Markdown: paired **bold**, within one line. */
(function () {
  "use strict";
  function runs(value) {
    const text=String(value??""),out=[];
    const pattern=/(?<!\*)\*\*([^*\r\n]+?)\*\*(?!\*)/g;
    let cursor=0;
    for(const match of text.matchAll(pattern)) {
      if(match.index>cursor)out.push({text:text.slice(cursor,match.index),bold:false});
      out.push({text:match[1],bold:true});cursor=match.index+match[0].length;
    }
    if(cursor<text.length)out.push({text:text.slice(cursor),bold:false});
    return out;
  }
  function toggle(input) {
    if(!input||input.disabled||input.readOnly)return;
    const {value,selectionStart:start,selectionEnd:end}=input;
    const selected=value.slice(start,end);
    let from=start,to=end,replacement,offset;
    if(selected.startsWith("**")&&selected.endsWith("**")&&selected.length>=4){replacement=selected.slice(2,-2);offset=0;}
    else if(value.slice(start-2,start)==="**"&&value.slice(end,end+2)==="**"){from-=2;to+=2;replacement=selected;offset=0;}
    else {replacement=selected.split('\n').map(line=>line.trim()?`**${line}**`:line).join('\n');if(!selected)replacement='****';offset=2;}
    input.focus({preventScroll:true});input.setRangeText(replacement,from,to,'select');
    input.setSelectionRange(from+offset,from+replacement.length-offset);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  window.MindexInlineText=Object.freeze({runs,plain:value=>runs(value).map(r=>r.text).join(''),toggle});
  if(typeof document==='undefined')return;
  document.addEventListener('keydown',event=>{
    if(event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=='b'||!event.target.matches('[data-inline-bold]'))return;
    event.preventDefault();event.stopPropagation();toggle(event.target);
  },true);
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-inline-bold-button]');if(!button)return;
    event.preventDefault();event.stopPropagation();toggle(button.closest('[data-inline-bold-editor]')?.querySelector('[data-inline-bold]'));
  },true);
})();
