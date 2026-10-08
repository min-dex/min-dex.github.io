const assert = require('node:assert/strict');
require('../mindex.setlist-links.js');
const {buildIndex,resolve}=globalThis.MindexSetlistLinks;
const index=buildIndex([
 {id:'ccm',title:'예수 우리 왕이여',subtitle:'Jesus, We Enthrone You'},
 {id:'hymn',title:'예수 우리 왕이여',hymn_no:'38'},
 {id:'a',title:'성령의 불로',subtitle:'예수님 목마릅니다'},
 {id:'b',title:'성령의 불로',subtitle:'주의 도를 버리고'},
]);
assert.equal(resolve('예수 우리 왕이여',index,'ccm').text,'예수 우리 왕이여');
assert.equal(resolve('38 예수 우리 왕이여',index).text,'38 예수 우리 왕이여');
assert.equal(resolve('예수 우리 왕이여',index).status,'ambiguous');
assert.equal(resolve('성령의 불로',index,'a').text,'성령의 불로 (예수님 목마릅니다)');
console.log('PASS hymn/CCM display distinction, explicit links and necessary same-category subtitles');

const homonyms = [{id:'old',title:'문들아 머리 들어라'}, {id:'kids',title:'문들아 머리 들어라',artist:'히즈쇼'}];
const homonymIndex=buildIndex(homonyms);
assert.equal(resolve(homonyms[0].title,homonymIndex).status,'ambiguous');
assert.equal(resolve(homonyms[0].title,homonymIndex,'old').detail,'');
assert.equal(resolve(homonyms[1].title,homonymIndex,'kids').detail,'히즈쇼');
assert.equal(resolve(homonyms[1].title,homonymIndex,'kids').text,'문들아 머리 들어라');
assert.equal(MindexSetlistLinks.artistHint({id:'only',title:'다른 곡',artist:'아티스트'},[]),'');
assert.equal(MindexSetlistLinks.artistHint({...homonyms[1],artist:null,metadata:{artist:'히즈쇼'}},homonyms),'히즈쇼');
assert.equal(MindexSetlistLinks.artistHint(homonyms[1],[homonyms[1],{id:'same',title:homonyms[1].title,artist:'히즈쇼'}]),'');
console.log('PASS existing artist distinguishes homonyms without renaming or guessing links');
