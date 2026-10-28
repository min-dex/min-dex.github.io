'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../mindex.single-song.js');
const api=globalThis.MindexSingleSong;
const old='SONG-CHLD-0001-0001',id='SONG-CONT-0445-0001';
const row={id,revision:8,previousIds:[old],metadata:{title:'fixture'},content:{forms:[{lyrics:'첫 줄\n\n다음'}],audio_set:{audioUrl:'https://example.test/a',cues:[0,1.5]}},legacy:{songId:'legacy-song',versionId:'legacy-version'},relations:{same_song:[],related:[]}};
const c=api.createCatalog([row]);
assert.deepEqual(c.ids(),[id]);assert.equal(c.resolve(old),id);assert.equal(c.resolve(old,old),id);
assert.equal(c.appSong(old).id,id);assert.deepEqual(c.get(old),row);
assert.deepEqual(c.nativeElement({song_id:old}),{praise_record_id:id,song_id:null,song_version_id:null});
assert.deepEqual(c.sourceFields({songId:old}),{songId:id});
assert.deepEqual(c.singleItem({praise_record_id:old}),{song_id:id});
assert.throws(()=>api.createCatalog([{...row,previousIds:[id]}]),/INVALID_SONG_ID_ALIASES/);
assert.throws(()=>api.createCatalog([{...row,previousIds:[old,old]}]),/INVALID_SONG_ID_ALIASES/);
assert.throws(()=>api.createCatalog([{...row,previousIds:'bad'}]),/INVALID_SONG_ID_ALIASES/);
assert.throws(()=>api.createCatalog([row,{...row,id:'SONG-CONT-0446-0001'}]),/INVALID_SONG_ID_ALIASES/);
(async()=>{const r=api.createRepository({read:async()=>[row],commit:async()=>{throw Error('No write allowed');}});assert.deepEqual(await r.read([old]),[row]);console.log('PASS aliases, collision rejection, canonical projection, protected payload, repository read');})().catch(e=>{console.error(e);process.exitCode=1;});

(async()=>{
  let captured;
  const ctx={structuredClone,globalThis:{MindexSingleSong:api},praisePendingSaves:new WeakMap(),
    state:{singleSongCatalog:c,forms:[],singleSongRepository:{save:async r=>{captured=r;throw Error('STOP_AFTER_CAPTURE');}}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../mindex.praise-storage.js'),'utf8'),ctx);
  await assert.rejects(ctx.saveSongMeta(c.appSong(id)),/STOP_AFTER_CAPTURE/);
  assert.deepEqual(captured.previousIds,[old]);
  assert.deepEqual(captured.content.forms,row.content.forms);
  assert.deepEqual(captured.content.audio_set,row.content.audio_set);
  console.log('PASS actual editor save retains previousIds and protected content');
})().catch(e=>{console.error(e);process.exitCode=1;});
