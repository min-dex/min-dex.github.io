import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDraftHandoff} from '../mindex.draft-handoff.mjs';
const db=new Map();let offline=false,lost=false;
async function rpc(name,a){
 const owner=createHash('sha256').update(a.p_token).digest('hex'),prefix=owner+':';
 if(offline)throw Error('offline');
 if(name==='mindex_state_read_v1')return {data:[...db].filter(([k])=>k.startsWith(prefix)).map(([,v])=>v)};
 const key=prefix+a.p_key,old=db.get(key);
 if(old?.requestId===a.p_request_id)return {data:old};
 if((old?.revision||'0')!==a.p_revision)throw Error('STATE_REVISION_CONFLICT');
 const row={key:a.p_key,value:a.p_value,revision:String(Number(a.p_revision)+1),requestId:a.p_request_id};db.set(key,row);
 if(lost){lost=false;throw Error('lost response')}return {data:row};
}
const options={rpc,token:'a'.repeat(64),project:'project'};
const a=createDraftHandoff({...options,author:'a'}),b=createDraftHandoff({...options,author:'b'}),stranger=createDraftHandoff({...options,token:'b'.repeat(64),author:'c'});
await Promise.all([a.refresh(),b.refresh(),stranger.refresh()]);
a.publish('scripture','one',{body:'A original'});b.publish('scripture','one',{body:'B simultaneous'});
await Promise.all([a.flush(),b.flush()]);await a.refresh();assert.equal(a.list().length,2);assert.equal(stranger.list().length,0);
const initialRows=db.size;a.publish('scripture','one',{body:'A original'});await a.flush();assert.equal(db.size,initialRows);
offline=true;a.publish('scripture','one',{body:'A offline'});await assert.rejects(a.flush());assert.ok(a.pending);assert.equal(a.list().find(r=>r.author==='a').draft.body,'A original');
a.publish('scripture','one',{body:'A newer'});offline=false;lost=true;await assert.rejects(a.flush());await a.flush();await b.refresh();
assert.equal(b.list().find(r=>r.author==='a').draft.body,'A newer');assert.equal(b.list().find(r=>r.author==='b').draft.body,'B simultaneous');assert.equal(a.pending,false);
const otherProject=createDraftHandoff({...options,project:'other',author:'x'});await otherProject.refresh();assert.equal(otherProject.list().length,0);
console.log('PASS paired capability isolation, independent author drafts, lost-response replay, offline edits, latest queue and no remote overwrite');

const {createServerState}=await import('../mindex.server-state.mjs');const malformed=createServerState({rpc,token:'c'.repeat(64),scope:'device'});await malformed.load();await assert.rejects(malformed.setItem(undefined,'value'),/INVALID_STATE_KEY/);assert.equal(malformed.pending,false);
