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
    const before=typeof document!=='undefined'&&numberedInput(input)?snapshot(input):null;
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
    if(before){applyNumbered(input,true);remember(input,before);}
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  const numberPattern=/^[ \t　]*(?:(\d+)[.)]|([①-⑳]))[ \t]*/u;
  const numberLabel=n=>n<=20?String.fromCodePoint(0x2460+n-1):`${n}.`;
  const continuation="　 ";
  function listLine(line,preserveSpacing=false) {
    const styled=runs(line),plain=styled.map(r=>r.text).join(''),match=plain.match(numberPattern);
    if(!match)return null;
    let skip=match[0].length;
    if(preserveSpacing)skip-=Math.max(0,(match[0].match(/[ \t]+$/)?.[0].length||0)-1);
    const body=styled.map(run=>{
      const text=run.text.slice(skip);skip=Math.max(0,skip-run.text.length);
      return text&&run.bold?`**${text}**`:text;
    }).join('');
    return {number:match[1]?Number(match[1]):match[2].codePointAt(0)-0x2460+1,body};
  }
  function mapColumn(before,after,column,markersOnly) {
    let prefix=0,suffix=0;
    while(prefix<Math.min(before.length,after.length)&&before[prefix]===after[prefix])prefix++;
    while(suffix<Math.min(before.length,after.length)-prefix&&before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;
    if(column<prefix)return column;
    if(column>=before.length-suffix)return after.length-(before.length-column);
    return markersOnly?Math.min(column,after.length-suffix):after.length-suffix;
  }
  function numbered(value,caret=String(value).length,markersOnly=false) {
    value=String(value);let count=0;
    const originals=value.split('\n');
    const lines=originals.map(line=>{
      const marker=listLine(line);
      if(marker)return `${numberLabel(++count)} ${marker.body}`;
      if(markersOnly||!line.trim())return line;
      return (count===0?`${numberLabel(++count)} `:continuation)+line.trimStart();
    });
    const before=value.slice(0,caret).split('\n'),row=before.length-1;
    const mapped=mapColumn(originals[row]||'',lines[row]||'',before.at(-1).length,markersOnly);
    const result=lines.join('\n');
    return {value:result,caret:Math.min(result.length,lines.slice(0,row).reduce((n,line)=>n+line.length+1,0)+mapped)};
  }
  function applyNumbered(input,markersOnly=false) {
    const result=numbered(input.value,input.selectionStart,markersOnly);
    if(result.value===input.value)return;
    const end=numbered(input.value,input.selectionEnd,markersOnly).caret,direction=input.selectionDirection;
    input.value=result.value;input.setSelectionRange(result.caret,end,direction);
  }
  window.MindexInlineText=Object.freeze({runs,plain:value=>runs(value).map(r=>r.text).join(''),toggle,numbered,listLine});
  if(typeof document==='undefined')return;
  const numberedInput=input=>input.matches?.('[data-announcement-numbered]')&&!input.disabled&&!input.readOnly;
  const histories=new WeakMap(),pending=new WeakMap(),composing=new WeakSet();
  const snapshot=input=>({value:input.value,start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection});
  function remember(input,before) {
    if(!before||before.value===input.value)return;
    const h=histories.get(input)||{undo:[],redo:[]};
    h.undo.push(before);if(h.undo.length>100)h.undo.shift();h.redo=[];histories.set(input,h);
  }
  function restore(input,redo=false) {
    const h=histories.get(input),from=redo?h?.redo:h?.undo,to=redo?h?.undo:h?.redo;
    if(!from?.length)return;
    to.push(snapshot(input));const saved=from.pop();
    input.value=saved.value;input.setSelectionRange(saved.start,saved.end,saved.direction);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function enter(input,shift=false) {
    const before=snapshot(input),start=input.selectionStart,end=input.selectionEnd;
    const lineStart=start===0?0:input.value.lastIndexOf('\n',start-1)+1;
    const lineEnd=input.value.indexOf('\n',start),tailEnd=lineEnd<0?input.value.length:lineEnd;
    const line=input.value.slice(lineStart,tailEnd),marker=listLine(line);
    const prefix=line.match(numberPattern)?.[0]||'';
    if(!shift&&marker&&!marker.body.trim()){
      input.setRangeText('',lineStart,Math.max(lineStart+prefix.length,end),'end');
    }else if(!shift&&marker&&start===end&&start<=lineStart+prefix.length){
      input.setRangeText('1. \n',lineStart,lineStart,'start');input.setSelectionRange(lineStart+3,lineStart+3);
    }else{
      input.setRangeText('\n'+(shift?continuation:'1. '),start,end,'end');
    }
    applyNumbered(input,true);remember(input,before);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  document.addEventListener('keydown',event=>{
    const input=event.target;
    if(!numberedInput(input)||event.isComposing||composing.has(input)||event.altKey)return;
    if((event.metaKey||event.ctrlKey)&&['z','y'].includes(event.key.toLowerCase())){
      event.preventDefault();event.stopPropagation();restore(input,event.shiftKey||event.key.toLowerCase()==='y');return;
    }
    if(event.key!=='Enter'||event.metaKey||event.ctrlKey)return;
    event.preventDefault();event.stopPropagation();enter(input,event.shiftKey);
  },true);
  document.addEventListener('beforeinput',event=>{
    const input=event.target;
    if(!numberedInput(input))return;
    if(!event.isComposing&&!composing.has(input)&&event.cancelable){
      if(['historyUndo','historyRedo'].includes(event.inputType)){event.preventDefault();restore(input,event.inputType==='historyRedo');return;}
      if(['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();enter(input);return;}
    }
    if(!composing.has(input))pending.set(input,snapshot(input));
  },true);
  document.addEventListener('compositionstart',event=>{
    const input=event.target;
    if(!numberedInput(input))return;
    pending.set(input,snapshot(input));composing.add(input);
  },true);
  function finishInput(input,type) {
    const before=pending.get(input);pending.delete(input);
    if(type==='insertFromPaste')applyNumbered(input);
    else if(type?.startsWith('delete'))applyNumbered(input,true);
    else if(type?.startsWith('insert')&&before&&!before.value.trim()&&input.value.trim())applyNumbered(input);
    remember(input,before);
  }
  document.addEventListener('compositionend',event=>{
    const input=event.target;
    if(!numberedInput(input))return;
    queueMicrotask(()=>{
      composing.delete(input);
      if(!input.isConnected)return;
      finishInput(input,'insertCompositionText');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  },true);
  document.addEventListener('input',event=>{
    const input=event.target;
    if(!numberedInput(input)||event.isComposing||composing.has(input)||!event.inputType)return;
    finishInput(input,event.inputType);
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
