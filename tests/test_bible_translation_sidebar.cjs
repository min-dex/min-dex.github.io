const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const code=source.slice(source.indexOf('function switchBibleTranslation('),source.indexOf('\nfunction updateBibleReaderField('));
for(const search of [false,true]){
 const events=[],state={module:'scripture',selectedBookCode:'GKE',selectedBibleChapter:13,selectedBibleVerse:2,selectedBibleVerses:[2],lastSelectedBibleVerse:2,scriptureFilter:'extra',bibleBookVerses:[{}],bibleTextSearchQuery:search?'사랑':''};
 const c={state,getBibleBooks:()=>state.selectedBibleTranslationId==='cog'?[{code:'GEN'},{code:'GKE'}]:[{code:'GEN'}],getBibleChapterOptions:()=>[1,2],getBibleBooksForScriptureFilter:()=>state.scriptureFilter==='extra'?[]:c.getBibleBooks(),persistUiState(){},syncBrowserHistory(){assert.equal(state.selectedBibleChapter,1);assert.equal(state.selectedBibleVerse,null);},isBibleTextSearchActive:()=>search,renderListFilter:()=>events.push(['filter',state.scriptureFilter]),renderSongList:()=>events.push(['list',state.selectedBibleTranslationId,c.getBibleBooks().length]),runBibleTextSearch:()=>events.push(['search']),loadBibleBookVerses:()=>events.push(['reader'])};
 vm.createContext(c);vm.runInContext(code,c);
 c.switchBibleTranslation('revised');
 assert.equal(state.selectedBookCode,'GEN');assert.equal(state.selectedBibleChapter,1);assert.equal(state.selectedBibleVerse,null);
 assert.deepEqual(events,[['filter','all'],['list','revised',1],[search?'search':'reader']]);
 events.length=0;state.selectedBookCode='GEN';state.selectedBibleChapter=13;state.selectedBibleVerse=4;state.selectedBibleVerses=[4];state.lastSelectedBibleVerse=4;state.scriptureFilter='extra';c.switchBibleTranslation('cog');
 assert.equal(state.lastSelectedBibleVerse,null);assert.equal(state.selectedBibleVerses.length,0);
 assert.deepEqual(events,[['filter','all'],['list','cog',2],[search?'search':'reader']]);
}
console.log('PASS edition changes refresh filters and counts before reader/search requests, including unavailable-book reset');
