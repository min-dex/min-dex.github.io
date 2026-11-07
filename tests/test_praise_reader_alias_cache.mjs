import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb({requirePostgres:true});
const patch=await fs.readFile(new URL('../migrations/2026-11-08-praise-reader-alias-cache.sql',import.meta.url),'utf8');
try {
 await db.exec(`create role mindex_single_writer; create role anon; create schema mindex_single_song;
 create table mindex_single_song.records(id text primary key,revision bigint,payload jsonb);
 create table mindex_single_song.state_id_alias_cache(alias text,record_id text,primary key(alias,record_id));
 alter table mindex_single_song.records enable row level security;
 alter table mindex_single_song.state_id_alias_cache enable row level security;
 grant usage on schema mindex_single_song to mindex_single_writer;
 grant select on all tables in schema mindex_single_song to mindex_single_writer;
 create policy reader on mindex_single_song.records for select to mindex_single_writer using(true);
 create policy reader on mindex_single_song.state_id_alias_cache for select to mindex_single_writer using(true);
 create function mindex_single_song.sync_state_id_alias_cache() returns trigger language plpgsql as $$begin
 if tg_op<>'INSERT' then delete from mindex_single_song.state_id_alias_cache where record_id=old.id; end if;
 if tg_op<>'DELETE' then insert into mindex_single_song.state_id_alias_cache select distinct a,new.id from jsonb_array_elements_text(coalesce(new.payload->'previousIds','[]'::jsonb)) a; end if; return null; end$$;
 create trigger sync_state_id_alias_cache after insert or update or delete on mindex_single_song.records for each row execute function mindex_single_song.sync_state_id_alias_cache();
 create function public.get_single_praise_records_v1(ids text[]) returns jsonb language sql security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(payload || jsonb_build_object('revision',revision) order by id),'[]'::jsonb)
 from mindex_single_song.records where id=any(ids) or coalesce(payload->'previousIds','[]'::jsonb) ?| ids;
 $$;
 alter function public.get_single_praise_records_v1(text[]) owner to mindex_single_writer;
 revoke all on function public.get_single_praise_records_v1(text[]) from public;
 grant execute on function public.get_single_praise_records_v1(text[]) to anon;
 insert into mindex_single_song.records values
 ('a',2,'{"id":"a","previousIds":["old-a","shared","b"],"content":{"lyrics":"first\\nsecond","timing":[0,5,10]}}'),
 ('b',3,'{"id":"b","previousIds":["old-b","shared"],"content":{"lyrics":"repeat"}}'),
 ('c',4,'{"id":"c","content":{"lyrics":"untouched"}}');`);
 const cases=[null,[],['missing'],['a'],['b'],['old-a'],['shared'],['a','old-a','shared','b'],['c','a'],[null],['',null,'old-b'],['old-b','old-b']];
 const call=async ids=>(await db.query('select public.get_single_praise_records_v1($1::text[]) v',[ids])).rows[0].v;
 const baseline=[];for(const ids of cases)baseline.push(await call(ids));
 const snapshot=async()=>(await db.query('select * from mindex_single_song.records order by id')).rows;
 const before=await snapshot();
 const privileges=async()=>(await db.query("select proowner,proacl,proconfig,prosecdef from pg_proc where oid='public.get_single_praise_records_v1(text[])'::regprocedure")).rows;
 const acl=await privileges();
 await db.exec(patch); await db.exec(patch);
 for(let i=0;i<cases.length;i++)assert.deepEqual(await call(cases[i]),baseline[i]);
 assert.deepEqual(await snapshot(),before);assert.deepEqual(await privileges(),acl);
 await db.exec('set role anon');assert.deepEqual(await call(['shared']),baseline[6]);
 await assert.rejects(db.query('select * from mindex_single_song.state_id_alias_cache'),/permission denied/);await db.exec('reset role');
 await db.exec("begin; delete from mindex_single_song.records where id='b'");assert.equal((await call(['old-b'])).length,0);await db.exec('rollback');assert.deepEqual(await call(['old-b']),baseline[11]);
 await db.exec("delete from mindex_single_song.state_id_alias_cache where alias='old-a'");
 await assert.rejects(db.exec(patch),/PRAISE_READER_ALIAS_CACHE_DRIFT/);await db.exec('rollback');
 console.log('PASS reader parity: current/legacy/mixed/duplicate/null/empty IDs, order, RLS, grants, payload, deletion rollback, replay and cache drift');
} finally {await db.close();}
