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
  const numberPattern=/^\s*(?:(\d+)[.)]|([①-⑳]))[ \t]*/u;
  const numberLabel=n=>n<=20?String.fromCodePoint(0x2460+n-1):`${n}.`;
  const continuation="　 ";
  function numbered(value,caret=String(value).length,markersOnly=false) {
    let count=0;
    const lines=String(value).split("\n").map(line=>{
      const marker=line.match(numberPattern),indent=line.match(/^\s*/u)[0];
      const prefix=marker?marker[0]:indent;
      let replacement=prefix;
      if(markersOnly){if(marker)replacement=`${numberLabel(++count)} `;}
      else if(line.trim())replacement=marker||count===0?`${numberLabel(++count)} `:continuation;
      const result=replacement+line.slice(prefix.length);
      return result;
    });
    // Map the caret by formatting only the preceding complete lines as well.
    const before=String(value).slice(0,caret).split("\n"),row=before.length-1;
    const original=String(value).split("\n")[row]||"",changed=lines[row]||"";
    const oldPrefix=(original.match(numberPattern)||original.match(/^\s*/u))[0].length;
    const newPrefix=(changed.match(numberPattern)||changed.match(/^\s*/u))[0].length;
    const column=before.at(-1).length;
    const mappedColumn=markersOnly&&column<=oldPrefix?Math.min(column,newPrefix):Math.max(newPrefix,column+newPrefix-oldPrefix);
    const nextCaret=lines.slice(0,row).reduce((n,line)=>n+line.length+1,0)+mappedColumn;
    return {value:lines.join("\n"),caret:Math.min(lines.join("\n").length,nextCaret)};
  }
  function applyNumbered(input,markersOnly=false) {
    const result=numbered(input.value,input.selectionStart,markersOnly);
    if(result.value===input.value)return;
    const end=numbered(input.value,input.selectionEnd,markersOnly).caret,direction=input.selectionDirection;
    input.value=result.value;input.setSelectionRange(result.caret,end,direction);
  }
  window.MindexInlineText=Object.freeze({runs,plain:value=>runs(value).map(r=>r.text).join(''),toggle,numbered});
  if(typeof document==='undefined')return;
  document.addEventListener('keydown',event=>{
    const input=event.target;
    if(!input.matches?.('[data-announcement-numbered]')||input.disabled||input.readOnly||event.isComposing||event.key!=='Enter'||event.metaKey||event.ctrlKey||event.altKey)return;
    event.preventDefault();event.stopPropagation();
    const start=input.selectionStart,end=input.selectionEnd,lineStart=input.value.lastIndexOf('\n',start-1)+1;
    const line=input.value.slice(lineStart,start),marker=line.match(numberPattern);
    if(!event.shiftKey&&marker&&!line.slice(marker[0].length).trim()){
      input.setRangeText('',lineStart,end,'end');
      applyNumbered(input,true);
    }else{
      const prefix=event.shiftKey?continuation:'1. ';
      input.setRangeText('\n'+prefix,start,end,'end');
      applyNumbered(input);
    }
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },true);
  const firstNumberPending=new WeakSet();
  const numberedInput=input=>input.matches?.('[data-announcement-numbered]')&&!input.disabled&&!input.readOnly;
  document.addEventListener('beforeinput',event=>{
    const input=event.target;
    if(numberedInput(input)&&!input.value.trim()&&event.inputType?.startsWith('insert'))firstNumberPending.add(input);
  },true);
  document.addEventListener('compositionstart',event=>{
    if(numberedInput(event.target)&&!event.target.value.trim())firstNumberPending.add(event.target);
  },true);
  function finishFirstNumber(input) {
    if(!firstNumberPending.has(input)||!input.value.trim())return false;
    firstNumberPending.delete(input);
    const before=input.value;
    applyNumbered(input);
    return before!==input.value;
  }
  document.addEventListener('compositionend',event=>{
    const input=event.target;
    if(!numberedInput(input))return;
    // Wait for the IME's final input before moving the caret or changing text.
    queueMicrotask(()=>{
      if(input.isConnected&&finishFirstNumber(input))input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  },true);
  document.addEventListener('input',event=>{
    const input=event.target;
    if(!numberedInput(input)||event.isComposing)return;
    if(event.inputType==='insertFromPaste'){
      applyNumbered(input);firstNumberPending.delete(input);
    }else if(event.inputType?.startsWith('delete')){
      applyNumbered(input,true);
    }else if(event.inputType?.startsWith('insert'))finishFirstNumber(input);
  },true);
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
