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
    let from=start,to=end;
    // Include markers around the retained selection before toggling line by line.
    if(start>=2&&value.slice(start-2,start)==="**"&&value.slice(end,end+2)==="**") {from-=2;to+=2;}
    const selected=value.slice(from,to),lines=selected.split('\n');
    const isBold=line=>/^\*\*[^*\r\n]+\*\*$/.test(line);
    const nonempty=lines.filter(line=>line.trim());
    const remove=nonempty.length>0&&nonempty.every(isBold);
    const replacement=selected==='****'?'':lines.map(line=>
      !line.trim()?line:remove?line.slice(2,-2):isBold(line)?line:`**${runs(line).map(r=>r.text).join('')}**`).join('\n')||(!selected?'****':'');
    const offset=!remove&&lines.length===1&&replacement.startsWith('**')?2:0;
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
  document.addEventListener('pointerdown',event=>{
    if(event.button===0&&event.target.closest('[data-inline-bold-button]'))event.preventDefault();
  },true);
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-inline-bold-button]');if(!button)return;
    event.preventDefault();event.stopPropagation();toggle(button.closest('[data-inline-bold-editor]')?.querySelector('[data-inline-bold]'));
  },true);
})();
