import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const supplemental=JSON.parse(fs.readFileSync(new URL('../docs/bible-supplement-books-20261016.json',import.meta.url),'utf8'));
const baseBooks=fs.readFileSync(new URL('../data/scripture-books.csv',import.meta.url),'utf8').trim().split('\n').slice(1).map((line,i)=>({code:line.split(',')[0],korean_name:line.split(',')[4],english_name:line.split(',')[5],testament:i<39?'Old Testament':'New Testament',sort_order:i+1,metadata:{}}));
const plan={baseBooks,newBooks:supplemental.supplementBooks.map((b,i)=>({code:b.id,korean_name:b.name,english_name:b.english,testament:'Deuterocanon / Apocrypha',sort_order:67+i,metadata:{chapters:b.chapters}})),afterMetadata:{supplement_books:supplemental.supplementBooks}};
function fn(name){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);const end=source.indexOf('\n}',start);return source.slice(start,end+2);}
const ctx=vm.createContext({Map,Set,Number,String,Boolean,Array,Math,state:{scriptureBooks:[...plan.baseBooks,...plan.newBooks].map(b=>({code:b.code,koreanName:b.korean_name,englishName:b.english_name,shortName:b.short_name,testament:b.testament,sortOrder:b.sort_order,metadata:b.metadata})),bibleTranslations:[{id:'cog',metadata:plan.afterMetadata},{id:'gae',metadata:{}}],selectedBibleTranslationId:'cog',selectedBookCode:'DA1',selectedBibleChapter:3,bibleBookVerses:[],selectedBibleVerses:[]},BIBLE_BOOKS:[],BIBLE_CHAPTER_COUNTS:{}});
vm.runInContext('var supplementalBookProjection;'+['getSelectedBibleTranslation','getBibleBooks','bibleChapterDisplayLabel','getBibleChapterOptions','getBibleChapterCount','bibleVerseNumberLabel','normalizeServerBibleVerse','getBibleBooksForScriptureFilter','bibleVerseRange','selectedBibleVerseRows'].map(fn).join('\n'),ctx);
assert.equal(vm.runInContext('getBibleBooks().length',ctx),75);assert.equal(vm.runInContext('getBibleBooks()===getBibleBooks()',ctx),true);
ctx.findBibleBookByCode=code=>vm.runInContext('getBibleBooks(false)',ctx).find(b=>b.code===code);
assert.deepEqual(Array.from(vm.runInContext('getBibleChapterOptions()',ctx)),[3,13,14]);
ctx.state.selectedBookCode='GKE';const gke=ctx.findBibleBookByCode('GKE');const special=gke.metadata.chapter_options.find(c=>c.label==='13`');assert.ok(special.key>=1000);assert.equal(ctx.bibleChapterDisplayLabel(gke,special.key),'13`');
ctx.state.scriptureFilter='extra';assert.equal(ctx.getBibleBooksForScriptureFilter().length,9);
ctx.state.selectedBibleTranslationId='gae';assert.equal(ctx.getBibleBooks().length,66);assert.equal(ctx.getBibleBooksForScriptureFilter().length,0);assert.equal(ctx.getBibleBooks(false).length,75);
ctx.state.selectedBibleTranslationId='cog';ctx.state.bibleBookVerses=[{chapter:3,verse:24,metadata:{source_order:0}},{chapter:3,verse:100000,metadata:{source_order:1,source_label:'24상'}},{chapter:3,verse:25,metadata:{source_order:2}}];assert.deepEqual(Array.from(ctx.bibleVerseRange(24,25)),[24,100000,25]);assert.equal(ctx.bibleVerseNumberLabel(ctx.state.bibleBookVerses[1]),'24상');
ctx.state.selectedBibleVerses=[100000];assert.equal(ctx.selectedBibleVerseRows()[0].metadata.source_label,'24상');
assert.ok(!source.includes('.select("book_code,chapter,verse,verse_end,text,section_title")'));
assert.ok(source.includes('number: bibleVerseNumberLabel(verse)'));
console.log('PASS edition availability, stable lookups, sparse chapters, literal special labels, source-order selection, copy/presenter metadata');

const presenterSource=fs.readFileSync(new URL('../mindex.presenter.js',import.meta.url),'utf8');
const presenterFn=name=>{const a=presenterSource.indexOf(`function ${name}(`);assert.ok(a>=0,name);return presenterSource.slice(a,presenterSource.indexOf('\n}',a)+2);};
Object.assign(ctx,{escapeHtml:String,escapeAttr:String,escapePresenterSlideLine:String,presenterScriptureReadingDisplayReference:String,presenterScriptureReadingBookName:String});
vm.runInContext(['presenterScriptureReadingHeaderReference','presenterScriptureVerseParts','presenterLineCharEstimate','renderPresenterScriptureReadingSlide'].map(presenterFn).join('\n'),ctx);
const slide={referenceBook:'에스델(제2경전/외경)',referenceRange:'13`:8',translationLabel:'공동번역',text:'8   확인할 본문 전체',title:'에스델 추가 본문 13`:8'};
assert.equal(ctx.presenterScriptureReadingHeaderReference(slide,'8'),'에스델(제2경전/외경) 13`:8');
assert.ok(ctx.renderPresenterScriptureReadingSlide(slide).includes('13`:8'));assert.ok(ctx.renderPresenterScriptureReadingSlide(slide).includes('확인할 본문 전체'));
console.log('PASS actual presenter renderer retains literal chapter label and complete body');

ctx.findBibleBookByReferenceName=name=>ctx.getBibleBooks(false).find(b=>b.koreanName===name||b.code===name);
vm.runInContext(fn('parseBibleReferenceFromNormalizedText'),ctx);
assert.equal(ctx.parseBibleReferenceFromNormalizedText('GKE 13`:0'),null);
assert.equal(ctx.parseBibleReferenceFromNormalizedText('GKE 13`:8').chapter,1004);

vm.runInContext(fn('renderScriptureBookMarker'),ctx);
assert.equal(ctx.renderScriptureBookMarker({koreanName:'다니엘 추가 본문',shortName:'다니엘 추가 본문'}),'');
