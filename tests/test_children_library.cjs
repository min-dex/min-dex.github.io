const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
global.Audio = class { duration=20; set src(value){queueMicrotask(()=>this.onloadedmetadata())} removeAttribute(){} load(){} };
require('../mindex.song-timing.js');
const T=global.MindexSongTiming, sha=bytes=>createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const file=new File(['fixture audio'],'곡.wav',{type:'audio/wav'}),text='첫 가사\n\n[간주]\n\n마지막';
 const timing={title:'곡',pageStarts:[2,6,10],crossStart:16,origins:['manual','manual','manual'],lyricsFingerprint:sha(text).slice(0,16),audioFingerprint:String(file.size)};
 const doc={kind:'mindex-song-timing',version:1,songs:{곡:timing},lyrics:{곡:{title:'곡',text}}};
 const manifest=[{title:'곡',bytes:file.size,sha256:sha('fixture audio')}];
 const before=JSON.stringify(doc);
 const [row]=await T.readElemLibrary(doc,[file],manifest);
 assert.deepEqual(row.pages,['첫 가사','[간주]','마지막','[후주]']);assert.deepEqual(row.starts,[2,6,10,16]);assert.equal(row.enabled,true);assert.equal(JSON.stringify(doc),before);
 assert.equal((await T.readElemLibrary(doc,[file]))[0].enabled,false);
 for(const origin of ['aligned','guessed','unexpected']) {
  const changed=structuredClone(doc);changed.songs.곡.origins[1]=origin;
  assert.equal((await T.readElemLibrary(changed,[file],manifest))[0].enabled,false);
 }
 await assert.rejects(T.readElemLibrary({...doc,kind:'other'},[file],manifest));
 await assert.rejects(T.readElemLibrary(doc,[],manifest));
 await assert.rejects(T.readElemLibrary(doc,[file,file],manifest));
 await assert.rejects(T.readElemLibrary(doc,[new File(['changed audio'],'곡.wav')],manifest));
 for(const patch of [{lyricsFingerprint:'bad'},{audioFingerprint:'1'},{origins:[]},{pageStarts:[2,6,5]},{crossStart:20},{crossStart:10.1},{pageStarts:[2,null,10]}]) {
  const changed=structuredClone(doc);Object.assign(changed.songs.곡,patch);await assert.rejects(T.readElemLibrary(changed,[file],manifest));
 }
 assert.equal(row.audioFingerprint,manifest[0].sha256);
 assert.equal(row.id,(await T.readElemLibrary(doc,[file],manifest))[0].id);
 console.log('PASS Elem bytes/lyrics validation, immutable import, interlude/outro mapping, unknown/draft timing disabled, invalid and ambiguous source rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
