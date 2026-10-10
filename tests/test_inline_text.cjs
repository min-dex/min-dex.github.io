const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('mindex.inline-text.js','utf8'),c);
const B=c.window.MindexInlineText;
assert.equal(B.plain('① **온세대 월삭예배**\n② <b>HTML</b>'),'① 온세대 월삭예배\n② <b>HTML</b>');
for(const text of ['미완성 **강조','***중첩***','**여러\n줄**','***','****'])assert.equal(B.plain(text),text);
assert.equal(B.runs('앞 **강조** 뒤').filter(r=>r.bold)[0].text,'강조');
assert.equal(B.runs('**하나** **둘**').filter(r=>r.bold).length,2);
console.log('PASS limited paired bold, plain text, incomplete/triple markers and line boundaries');
function toggle(value,start=0,end=value.length){
 const input={value,selectionStart:start,selectionEnd:end,focus(){},setRangeText(text,a,b){this.value=this.value.slice(0,a)+text+this.value.slice(b);},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},dispatchEvent(){}};
 B.toggle(input);return input;
}
c.Event=class Event {};
assert.equal(toggle('첫 **강조**와 일반 문장').value,'**첫 강조와 일반 문장**','Whole mixed selection must not nest bold markers');
assert.equal(toggle('**첫 강조와 일반 문장**').value,'첫 강조와 일반 문장');
assert.equal(B.plain(toggle('첫 **강조**와 일반 문장').value),'첫 강조와 일반 문장');
console.log('PASS mixed bold selection remains readable and toggles off');
