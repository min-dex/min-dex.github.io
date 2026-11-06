const assert=require('node:assert/strict');
global.servicePraiseInputMode=item=>item.mode;
global.versionEffectivePraiseTypes=(song,version)=>version.types||[];
require('../mindex.song-timing.js');const T=global.MindexSongTiming;
(async()=>{
 const song={id:'song'},version={id:'version',types:['children'],_worshipVersionPersisted:true,lyric_signature:'source-hash',forms:[{id:'form',lyrics:'가사'}]};
 const slides=[{type:'lyrics',text:'가사',elementId:'item',syncTimeline:{legacy:true}}];
 const draft={audio:new Blob(['audio']),audioName:'track.wav',audioFingerprint:'sha',duration:10,starts:[2],enabled:true,forms:version.forms,sourceSignature:T.sourceSignature(version),lyricsFingerprint:T.fingerprint(slides)};
 let uploads=0,conflict=true,queries=[];
 global.PRESENTER_MEDIA_STORAGE_BUCKET='fixture';
 global.state={client:{storage:{from:()=>({upload:async()=>{uploads++;return{}},getPublicUrl:()=>({data:{publicUrl:'https://example.invalid/audio'}})})},from:table=>{
  assert.equal(table,'mindex_song_versions');const q={update(payload){assert.deepEqual(Object.keys(payload),['audio_set']);queries.push(['update',payload]);return q},eq(k,v){queries.push([k,v]);return q},is(k,v){queries.push([k,v]);return q},select:async()=>({data:conflict?[]:[{id:'version'}]})};return q;
 }}};
 version._audioSetSupported=false;await assert.rejects(T.saveToVersion(song,version,draft,slides),/DB 업데이트/);assert.equal(uploads,0);version._audioSetSupported=true;
 await assert.rejects(T.saveToVersion(song,version,draft,slides),/다른 곳/);assert.equal(version.audio_set,undefined);assert.equal(uploads,1);
 conflict=false;await T.saveToVersion(song,version,draft,slides);assert.equal(uploads,1);assert.equal(version.audio_set.audioUrl,'https://example.invalid/audio');assert.ok(queries.some(([k,v])=>k==='lyric_signature'&&v==='source-hash'));
 for(const mode of ['lyrics_db','score_db','manual_praise','audio_praise']){
  const item={id:'item',mode};const result=T.decorate(slides,item,song,version);
  assert.ok(result.every(s=>!s.syncTimeline),mode);assert.equal(T.audioFor(result,'item'),null,mode);
  assert.deepEqual(T.formsFor(item,song,version,['fallback']),['fallback']);
 }
 const item={id:'item',mode:'children_audio'},result=T.decorate(slides,item,song,version);
 assert.equal(result[0].syncTimeline.start,2);assert.equal(result[0].syncTimeline.lead,1);assert.equal(T.audioFor(result,'item').url,version.audio_set.audioUrl);
 assert.deepEqual(T.formsFor(item,song,version,[]),version.forms);
 const originalForms=version.audio_set.forms;
 version.audio_set.forms=[{id:'page',lyrics:'가\n사',audioSourceRange:[0,2]}];
 assert.equal(T.formsFor(item,song,version,[])[0].lyrics,'가\n사');
 version.audio_set.forms[0].lyrics='다른 가사';assert.deepEqual(T.formsFor(item,song,version,['fallback']),['fallback']);
 version.audio_set.forms[0]={_presenterBlank:true,lyrics:'hidden replacement'};assert.deepEqual(T.formsFor(item,song,version,['fallback']),['fallback']);
 version.audio_set.forms=originalForms;
 version.audio_set.enabled=false;assert.ok(!T.decorate(slides,item,song,version)[0].syncTimeline);
 version.audio_set.enabled=true;version.forms=[{id:'form',lyrics:'변경 가사'}];assert.ok(!T.decorate(slides,item,song,version)[0].syncTimeline);
 await assert.rejects(T.saveToVersion(song,version,draft,slides),/바뀌/);
 const profileFor=(id,text,start,url)=>{
  const forms=[{id,lyrics:text}],v={id,types:['children'],forms};
  const pages=[{type:'lyrics',text,elementId:'separate-item'}];
  v.audio_set={enabled:true,audioUrl:url,audioName:id,audioFingerprint:id,duration:20,starts:[start],forms,sourceSignature:T.sourceSignature(v),lyricsFingerprint:T.fingerprint(pages)};
  return {v,pages};
 };
 const a=profileFor('a','판본 A 가사',3,'https://example.invalid/a.wav');
 const b=profileFor('b','판본 B 가사',8,'https://example.invalid/b.wav');
 const variantsBefore=JSON.stringify([a,b]);
 for(const selected of [a,b,a]){
  const rendered=T.decorate(selected.pages,{id:'separate-item',mode:'children_audio',version_id:selected.v.id},song,selected.v);
  assert.equal(rendered[0].syncTimeline.audioSrc,selected.v.audio_set.audioUrl);
  assert.equal(rendered[0].syncTimeline.start,selected.v.audio_set.starts[0]);
  assert.equal(T.audioFor(rendered,'separate-item').url,selected.v.audio_set.audioUrl);
 }
 assert.equal(JSON.stringify([a,b]),variantsBefore,'Version switching must not mutate lyrics, profiles or cue starts');
 console.log('PASS version-owned CAS save/retry, audio-only mode gate, DB reload metadata, disabled/stale sets, unchanged fallback forms');
})().catch(e=>{console.error(e);process.exitCode=1});

// Explicit lyric saves may carry cues forward; stale playback itself stays strict.
{
 const forms=[{id:'v',part_type:'Verse',part_number:1,lyrics:'주님 은혜로\n살아 갑니다\n\n감사 드리며\n찬양합니다'},{id:'c',part_type:'Chorus',lyrics:'사랑해요 주님'}];
 const pages=fs=>fs.flatMap(f=>f._presenterBlank?[{type:'blank',text:''}]:f.lyrics.split(/\n\s*\n/).map(text=>({type:'lyrics',text})));
 const audioForms=[forms[0],forms[1],forms[1],{_presenterBlank:true,lyrics:''}];
 const version={forms,audio_set:{enabled:true,audioUrl:'https://example.invalid/test.wav',audioName:'test',audioFingerprint:'hash',duration:100,starts:[1,10,20,30,40],forms:audioForms,sourceSignature:T.sourceSignature({forms}),lyricsFingerprint:T.fingerprint(pages(audioForms)),photos:[{at:2,url:'https://example.invalid/photo'}]}};
 const before=JSON.stringify(version);
 const changed=structuredClone(forms);changed[0].lyrics='주님 은혜로 살아갑니다\n\n감사드리며\n찬양합니다';changed[1].lyrics='사랑해요 주님!';
 const rebased=T.rebaseAudioSet(version,changed);
 assert.notEqual(rebased,version.audio_set);assert.deepEqual(rebased.starts,version.audio_set.starts);assert.deepEqual(rebased.photos,version.audio_set.photos);
 assert.equal(rebased.forms[1].lyrics,changed[1].lyrics);assert.equal(rebased.forms[2].lyrics,changed[1].lyrics);
 assert.equal(T.audioStatus({...version,forms:changed,audio_set:rebased},pages(rebased.forms)),'');
 assert.equal(JSON.stringify(version),before,'pure preparation must not mutate the draft or stored timing');
 for(const next of [forms.slice().reverse(),[...forms,forms[1]],forms.slice(1),forms.map((f,i)=>i?f:{...f,lyrics:f.lyrics.replace('\n','\n\n')}),forms.map((f,i)=>i?f:{...f,lyrics:f.lyrics.split('\n\n').reverse().join('\n\n')}),forms.map((f,i)=>i?f:{...f,lyrics:'주님\n\n은혜로\n살아 갑니다\n감사 드리며\n찬양합니다'})]) {
  assert.equal(T.rebaseAudioSet(version,next),version.audio_set,'structure edit must keep stale signature');
 }
 const typo=structuredClone(forms);typo[0].lyrics=typo[0].lyrics.replace('은혜로','은해로');
 assert.notEqual(T.rebaseAudioSet(version,typo),version.audio_set,'one-character correction retains cues');
 const rangeForms=[{id:'p1',lyrics:'주님 은혜로\n살아 갑니다',audioSourceRange:[0,10]},{id:'p2',lyrics:'감사 드리며\n찬양합니다',audioSourceRange:[10,20]},{id:'p3',lyrics:'주님 은혜로\n살아 갑니다',audioSourceRange:[0,10]}];
 // Build ranges from the folded source, avoiding hard-coded Korean lengths.
 const folded=s=>s.replace(/[^\p{L}\p{N}]/gu,'');
 const n=folded(rangeForms[0].lyrics).length,m=folded(rangeForms[1].lyrics).length;
 rangeForms[0].audioSourceRange=rangeForms[2].audioSourceRange=[0,n];rangeForms[1].audioSourceRange=[n,n+m];
 const ranged={forms:[forms[0]],audio_set:{...version.audio_set,forms:rangeForms,starts:[1,10,20],sourceSignature:T.sourceSignature({forms:[forms[0]]}),lyricsFingerprint:T.fingerprint(pages(rangeForms))}};
 const corrected=[{...forms[0],lyrics:forms[0].lyrics.replace('살아 갑니다','살아갑니다').replace('은혜로','은혜로만')}];
 const r=T.rebaseAudioSet(ranged,corrected);
 assert.notEqual(r,ranged.audio_set);assert.deepEqual(r.starts,[1,10,20]);assert.deepEqual(r.forms[0].audioSourceRange,[0,n+1]);assert.deepEqual(r.forms[1].audioSourceRange,[n+1,n+m+1]);assert.equal(r.forms[0].lyrics,r.forms[2].lyrics);assert.ok(r.forms[0].lyrics.includes('살아갑니다'));
 assert.equal(T.audioStatus({...ranged,forms:corrected,audio_set:r},pages(r.forms)),'');
 const stale={...ranged,audio_set:{...ranged.audio_set,lyricsFingerprint:'stale'}};
 assert.equal(T.rebaseAudioSet(stale,corrected),stale.audio_set);
 console.log('PASS text-only CAS preparation; inline line breaks; typo/spacing; repeated/ranged audio pages; split/order/repeat guards; immutable timing');
}
{
 const forms=[{id:'v',lyrics:'첫 구절\n\n둘째 구절'},{id:'c',lyrics:'다음 구절'}];
 const audioForms=[{id:'p',lyrics:'첫 구절\n둘째 구절\n다음 구절',audioSourceRange:[0,11]}];
 const profile={enabled:true,audioUrl:'https://example.invalid/cross.wav',audioFingerprint:'hash',duration:20,starts:[2],forms:audioForms,sourceSignature:T.sourceSignature({forms}),lyricsFingerprint:T.fingerprint([{type:'lyrics',text:audioForms[0].lyrics}])};
 const next=structuredClone(forms);next[0].lyrics=next[0].lyrics.replace('첫 구절','첫구절');
 const rebased=T.rebaseAudioSet({forms,audio_set:profile},next);
 assert.notEqual(rebased,profile);assert.equal(rebased.forms.length,1);assert.ok(!rebased.forms[0].lyrics.includes('\n\n'));assert.deepEqual(rebased.starts,[2]);
 console.log('PASS range spanning DB paragraphs/forms preserves its single audio page');
}
