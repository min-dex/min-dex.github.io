const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const api=require('../mindex.single-song.js');
const song={id:'old-song',title:'시험곡',memo:'{"versionOutputTitles":{"old-v":"출력 제목"}}',scripture:['시편 1:1'],metadata:{composer:'작곡'},versions:[]};
const version={id:'old-v',source_song_id:song.id,canonical_song_id:'old-c',name:'통일',output_title:'출력 제목',forms:[{id:'unit-1',part_type:'Verse',label:'Verse 1',lyrics:'첫 줄\n둘째 줄\n\n셋째 줄',sort_order:1},{id:'unit-a',part_type:'Coda',label:'Coda',lyrics:'아멘',sort_order:2}],audio_set:{audioUrl:'https://example.test/a',starts:[0,5,10],forms:[{id:'unit-1'}]}};
const before=JSON.stringify({song,version});
const r=api.fromLegacySong(song,version,'kth-480');
const other=api.fromLegacySong(song,{...version,id:'old-v2'},'knh-361');
const catalog=api.createCatalog([r,other]);
assert.equal(JSON.stringify({song,version}),before);
assert.equal(catalog.resolve('old-song','old-v'),'kth-480');
assert.throws(()=>catalog.resolve('old-song'),/AMBIGUOUS/);
assert.throws(()=>catalog.resolve('wrong','old-v'),/MISMATCH/);
assert.throws(()=>catalog.resolve('knh-361','old-v'),/MISMATCH/);
assert.throws(()=>api.createCatalog([r,r]),/INVALID/);
const aliasOnly={linkedSource:{songVersionId:'old-v'},text:'version_id: keep lyric text'};
const aliasBefore=JSON.stringify(aliasOnly),aliasResult=api.rewriteStructured(aliasOnly,catalog);
assert.equal(aliasResult.pending.length,0);assert.equal(aliasResult.value.linkedSource.songId,'kth-480');
assert.ok(!('songVersionId' in aliasResult.value.linkedSource));assert.equal(JSON.stringify(aliasOnly),aliasBefore);
for(const conflicting of [{versionId:'old-v',songVersionId:'old-v2'},{song_version_id:'old-v',version_id:'old-v2'}]){
 const result=api.rewriteStructured(conflicting,catalog);assert.equal(result.pending.length,1);
 assert.match(result.pending[0].reason,/MISMATCH/);assert.deepEqual(result.value,conflicting);
}

const item={id:'slot',song_id:'old-song',version_id:'old-v',memo:'{"formHint":"V1-Coda","connectedPraise":"next","audioTiming":{"starts":[0,5,10]}}',sort_order:7};
const single=catalog.singleItem(item);assert.equal(single.song_id,'kth-480');assert.ok(!('version_id'in single));
const round=catalog.legacyElement(single);assert.equal(round.song_id,item.song_id);assert.equal(round.song_version_id,item.version_id);assert.equal(round.memo,item.memo);assert.equal(round.sort_order,7);
const native=catalog.nativeElement(single);assert.equal(native.praise_record_id,'kth-480');assert.equal(native.song_id,null);assert.equal(native.song_version_id,null);assert.deepEqual(catalog.singleItem(native),single);
const source='[[찬양]]\n[찬양 1]\n- 곡 ID: old-song\n- 버전 ID: old-v\n- 송폼: V1-Coda\n- 가사: |\n  - 곡 ID: old-song\n[찬양 2]\n- 곡 ID: old-song';
const rewrite=api.rewriteSource(source,catalog);assert.equal(rewrite.pending.length,1);assert.ok(rewrite.text.includes('- 곡 ID: kth-480'));assert.ok(!rewrite.text.includes('- 버전 ID: old-v'));assert.ok(rewrite.text.includes('  - 곡 ID: old-song'));assert.equal(api.rewriteSource(rewrite.text,catalog).text,rewrite.text);
const nested=api.rewriteStructured({lyrics:'old-song',row:{songId:'old-song',versionId:'old-v'},audio:{starts:[0,1]}},catalog);assert.equal(nested.value.row.songId,'kth-480');assert.equal(nested.value.lyrics,'old-song');assert.deepEqual(nested.value.audio.starts,[0,1]);
const view=catalog.appSong('kth-480');assert.equal(view.versions[0]._legacyVersionId,version.id);assert.deepEqual(view.versions[0].forms,version.forms);assert.deepEqual(view.versions[0].audio_set,version.audio_set);assert.equal(view.versions[0].output_title,'출력 제목');view.versions[0].forms[0].lyrics='edit';assert.equal(catalog.appSong('kth-480').versions[0].forms[0].lyrics,version.forms[0].lyrics);
const c={console,structuredClone,document:{addEventListener(){}},localStorage:{getItem(){return null}},setTimeout,clearTimeout,URL,URLSearchParams,crypto:require('node:crypto').webcrypto};c.window=c;c.__mindexRuntimeStarted=true;c.location={search:'',hash:'',pathname:'/'};vm.createContext(c);
for(const f of ['mindex.single-song.js','mindex.praise-storage.js','mindex.constants.js','mindex.worship-model.js','mindex.worship-persistence.js',...(fs.existsSync('mindex.presenter-praise.js')?['mindex.presenter-praise.js']:[]),'mindex.presenter.js','mindex.worship-input.js','mindex.worship-source.js','mindex.setlist-links.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.fixture=JSON.parse(JSON.stringify(r));c.assert=assert;
vm.runInContext(`
const singleView=normalizeServerSong(fixture);
state.songs=[singleView];
const selected={song_id:fixture.id,memo:serializeServiceItemMemo({inputMode:'praise',formHint:'V1-Coda'})};
assert.equal(serviceItemNeedsVersionChoice(selected),false);
assert.equal(getServiceItemVersion(singleView,selected,{}).id,fixture.id);
assert.equal(getServiceItemVersion(singleView,selected,{}).output_title,'출력 제목');
assert.throws(()=>getServiceItemVersion(singleView,{...selected,version_id:'other'},{}),/MISMATCH/);
const fields={label:'찬양',value:'시험곡',songId:fixture.id,asset:{},audio:{},sermonReference:null};
const text='[[찬양]]\\n'+serializePortableServiceSourceItem(fields).join('\\n');
assert.ok(!text.includes('버전 ID'));
assert.equal(parseServiceSourceText(text)[0].songId,fixture.id);
`,c);
console.log('PASS single identity: metadata/forms/timing, ambiguous/wrong references, source/JSON preservation, real parser/presenter selection');
(async()=>{
 let stored={...structuredClone(r),revision:0},attempts=[],fail=true;
 const repo=api.createRepository({read:async()=>[stored],commit:async request=>{
   attempts.push(request);if(fail)throw Error('network timeout');
   assert.equal(request.expectedRevision,stored.revision);
   stored={...request.record,revision:request.expectedRevision+1};return stored;
 }});
 const candidate=await repo.read(['kth-480']);assert.equal(candidate[0].revision,0);
 await assert.rejects(repo.save(candidate[0]),/timeout/);
 await assert.rejects(repo.save({...candidate[0],metadata:{...candidate[0].metadata,title:'late edit'}}),/OUTCOME_UNKNOWN/);
 fail=false;const saved=await repo.save(candidate[0]);assert.equal(saved.revision,1);
 assert.equal(attempts[0].requestId,attempts[1].requestId,'retry same atomic identity');
 const fresh=await repo.read(['kth-480']);assert.deepEqual(fresh[0].content.audio_set,version.audio_set);
 const shape=api.rewriteStructured({linkedSource:{songId:'old-song',songVersionId:'old-v'}},catalog);
 assert.equal(shape.pending.length,0);assert.deepEqual(shape.value.linkedSource,{songId:'kth-480'});
 console.log('PASS CAS repository: unknown outcome blocks changed request, exact replay, save/reopen timing and linkedSource');
})().catch(e=>{console.error(e);process.exitCode=1});

require('../mindex.song-timing.js');
const timing=globalThis.MindexSongTiming;
const frames=[{type:'lyrics',text:'가사'}];
const originalKey=timing.decorate(frames,{},song,version)[0].songTimingKey;
assert.equal(timing.decorate(frames,{},catalog.appSong('kth-480'),catalog.appSong('kth-480').versions[0])[0].songTimingKey,originalKey);
console.log('PASS existing audio timing lookup key retained');
