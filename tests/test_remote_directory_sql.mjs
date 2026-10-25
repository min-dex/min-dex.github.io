import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb({requirePostgres:true});
try{
 await db.exec('create role anon;create role authenticated;');
 for(const file of ['2026-10-22-remote-pin.sql','2026-10-24-remote-admin.sql','2026-10-24-output-codes.sql','2026-10-24-multi-admin.sql','2026-10-24-remote-entry.sql','2026-10-25-remote-public-outputs.sql','2026-10-25-remote-public-outputs.sql'])await db.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const c=await db.connect();await c.query('set role anon');
 const rpc=async(sql,args=[])=>(await c.query(sql,args)).rows[0].r;
 const host=(action,h={},info={})=>rpc('select public.mindex_remote_output($1,$2,$3,$4) r',[action,h.id||null,h.token||null,info]);
 const guest=(t,code,id)=>rpc("select public.mindex_remote_guest('connect',$1,$2,$3) r",[t,code,id]);
 const list=()=>rpc('select public.mindex_remote_outputs() r');
 const token=()=>randomBytes(32).toString('hex');
 const a=await host('register'),b=await host('register'),empty=await host('register');
 await host('tick',a,{title:'어린이부 예배',device:'1층 PC',position:'1 / 20'});await host('tick',b,{title:'주일예배 [3부]',device:'본당 PC'});
 await db.query("update mindex_remote_private.outputs set info=info||$2::jsonb where id=$1",[a.id,JSON.stringify({code:a.code,secret:'private-fixture',token:a.token})]);
 const directory=await list();assert.equal(directory.outputs.length,2);
 for(const o of directory.outputs)assert.deepEqual(Object.keys(o).sort(),['device','id','title']);
 assert(!JSON.stringify(directory).includes(a.code));assert(!JSON.stringify(directory).includes(a.token));assert(!JSON.stringify(directory).includes('private-fixture'));
 assert(!directory.outputs.some(o=>o.id===empty.id));
 const t=token();assert.equal((await guest(t,b.code,a.id)).error,'invalid_code');
 assert.equal((await db.query('select count(*) from mindex_remote_private.guest_links')).rows[0].count,'0');
 const good=await guest(t,a.code,a.id);assert(good.ok);assert.equal(good.output,a.id);
 const report=await host('tick',a,{title:'어린이부 예배',guestReady:good.id});
 // Host marks its own request ready; selection mismatch cannot reuse an existing token.
 const request=report.guest.id;await host('tick',a,{title:'어린이부 예배',guestReady:request});
 assert((await guest(t,a.code,a.id)).ready);
 assert.equal((await guest(t,b.code,b.id)).error,'invalid_code');
 assert.equal((await guest(token(),a.code,a.id)).error,'busy');
 const legacy=await guest(token(),b.code,null);assert(legacy.ok&&legacy.output===b.id);
 await db.query("update mindex_remote_private.outputs set seen_at=clock_timestamp()-interval '11 seconds' where id=$1",[b.id]);
 assert(!(await list()).outputs.some(o=>o.id===b.id));
 await host('remove',a);assert.equal((await list()).outputs.length,0);
 await assert.rejects(c.query('select code,owner_hash from mindex_remote_private.outputs'),/permission denied/);
 await c.query('set role authenticated');assert.equal((await list()).outputs.length,0);
 console.log('PASS public allowlist, secret/code exclusion, stale/unticked outputs hidden, selected-code binding before mutation, retry binding, one guest, legacy clients, private ACL and idempotent migration');
}finally{await db.close();}
