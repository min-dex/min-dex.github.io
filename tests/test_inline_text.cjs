const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('mindex.inline-text.js','utf8'),c);
const B=c.window.MindexInlineText;
assert.equal(B.plain('① **온세대 월삭예배**\n② <b>HTML</b>'),'① 온세대 월삭예배\n② <b>HTML</b>');
for(const text of ['미완성 **강조','***중첩***','**여러\n줄**','***','****'])assert.equal(B.plain(text),text);
assert.equal(B.runs('앞 **강조** 뒤').filter(r=>r.bold)[0].text,'강조');
assert.equal(B.runs('**하나** **둘**').filter(r=>r.bold).length,2);
console.log('PASS limited paired bold, plain text, incomplete/triple markers and line boundaries');
