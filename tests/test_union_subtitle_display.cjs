const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const presenter = fs.readFileSync(path.join(__dirname, '../mindex.presenter.js'), 'utf8');
function extract(code, name) {
 const start=code.indexOf(`function ${name}(`), end=code.indexOf('\nfunction ',start+1);
 assert(start>=0 && end>start); return code.slice(start,end);
}
const ctx=vm.createContext({normalizeSongMetadata:x=>x||{},normalizeTitle:x=>String(x||'').replace(/\s/g,''),joinMetaItems:x=>x.join(' · '),versionDisplayName:()=>'',presenterPraiseTitle:s=>s.title});
for(const name of ['visibleSongSubtitle','normalizeRawTitleMeta','addTitleMeta','addSongMetaFromRaw','songTitleMetaLine'])vm.runInContext(extract(app,name),ctx);
vm.runInContext(extract(presenter,'presenterPraiseElementTitle'),ctx);
const song={title:'거룩하신 하나님',hymn_no:'통 10',subtitle:'통일 10',versions:[]};
const before=JSON.stringify(song);
assert.equal(ctx.songTitleMetaLine(song),'');
assert.equal(ctx.presenterPraiseElementTitle(song,{subtitle:'통일 10'}),song.title);
assert.equal(JSON.stringify(song),before);
for(const [no,sub,expected] of [['통 10','통일 11','통일 11'],['10','통일 10','통일 10'],['','통일 10','통일 10'],['통 10','통일 10 다른 제목','통일 10 다른 제목'],['통 10','의미 있는 부제','의미 있는 부제']]) assert.equal(ctx.visibleSongSubtitle({hymn_no:no,subtitle:sub}),expected);
assert.equal(ctx.songTitleMetaLine({...song,original_title:'Original Title'}),'Original Title');
assert.equal(ctx.presenterPraiseElementTitle({...song,subtitle:'의미 있는 부제'}),song.title+' (의미 있는 부제)');
assert.equal(ctx.visibleSongSubtitle({title:'임재',subtitle:'하늘의 문을 여소서'}),'하늘의 문을 여소서');
console.log('PASS exact union-number repetition only; alternate titles, original title, mismatched metadata and stored identity preserved');
