import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb({requirePostgres:true});
try {
 await db.exec('create role anon; create role authenticated;');
 const sql=fs.readFileSync(new URL('../migrations/2026-10-22-remote-pin.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 const a=await db.connect(),b=await db.connect();await a.query('set role anon');await b.query('set role authenticated');
 const call=async(c,name,arg)=> (await c.query(`select public.mindex_remote_${name}(${arg===undefined?'':'$1'}) as result`,arg===undefined?[]:[arg])).rows[0].result;
 const reset=()=>db.exec("update mindex_remote_private.buckets set started_at=clock_timestamp()-interval '2 minutes'; delete from mindex_remote_private.codes;");
 await assert.rejects(a.query('select * from mindex_remote_private.codes'),/permission denied/);
 await assert.rejects(a.query("select mindex_remote_private.take_budget('claim',100)"),/permission denied/);
 let host=await call(a,'create_code');assert.match(host.code,/^\d{6}$/);assert.match(host.secret,/^[a-f0-9]{64}$/);
 const claims=await Promise.all([call(a,'claim_code',host.code),call(b,'claim_code',host.code)]);
 assert.equal(claims.filter(x=>x.ok).length,1);assert.equal(claims.find(x=>x.ok).secret,host.secret);
 await reset();host=await call(a,'create_code');
 for(let i=0;i<5;i++)assert.equal((await call(a,'claim_code',null)).error,'invalid_code');
 assert.equal((await call(b,'claim_code',host.code)).error,'rate_limited');
 await db.exec("update mindex_remote_private.buckets set started_at=clock_timestamp()-interval '2 minutes'");
 assert.equal((await call(b,'claim_code',host.code)).secret,host.secret);
 await reset();host=await call(a,'create_code');await call(a,'revoke_code','00'.repeat(32));assert.equal((await call(b,'claim_code',host.code)).ok,true);
 await reset();host=await call(a,'create_code');await call(a,'revoke_code',host.owner_token);assert.equal((await call(b,'claim_code',host.code)).error,'invalid_code');
 await reset();host=await call(a,'create_code');await db.exec("update mindex_remote_private.codes set expires_at=clock_timestamp()-interval '1 second'");assert.equal((await call(b,'claim_code',host.code)).ok,false);
 await reset();for(let i=0;i<3;i++)assert.equal((await call(a,'create_code')).ok,true);
 assert.equal((await call(a,'create_code')).error,'busy');await call(a,'create_code');assert.equal((await call(a,'create_code')).error,'rate_limited');
 console.log('PASS real PostgreSQL: migration rerun, roles, atomic single-use claim, committed shared attempt limit, expiry, revocation, pending cap');
} finally {await db.close();}
