import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const root=new URL('../../Biblia/.local/bsk-source-library-20261016/authoritative-import/',import.meta.url);
try{await fs.access(new URL('plan.json',root));}catch{console.log('SKIP private source/preflight plan required');process.exit(0);}
const plan=JSON.parse(await fs.readFile(new URL('plan.json',root),'utf8'));
const schema=await fs.readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8');
const db=await openWorshipTestDb({requirePostgres:true});
try{
 await db.exec('create role anon;create role authenticated;');
 await db.exec('create table public.mindex_scripture_books(code text primary key);');
 for(const name of ['mindex_bible_translations','mindex_bible_verses']){const i=schema.indexOf(`create table if not exists public.${name} (`);await db.exec(schema.slice(i,schema.indexOf('\n);',i)+4));}
 // The production FK catalog already contains all75 identities.
 await db.query('insert into public.mindex_scripture_books select distinct value->>\'book_code\' from jsonb_array_elements($1::jsonb)',[JSON.stringify(plan.rows)]);
 await db.query('insert into public.mindex_bible_translations select * from jsonb_populate_recordset(null::public.mindex_bible_translations,$1)',[JSON.stringify(plan.beforeTranslations)]);
 const setup=await fs.readFile(new URL('00-setup.sql',root),'utf8'), apply=await fs.readFile(new URL('99-apply.sql',root),'utf8');await db.exec(setup);
 await assert.rejects(db.exec(apply),/MISSING_OR_CHANGED_PART/);await db.exec('rollback');
 for(const file of (await fs.readdir(root)).filter(f=>/data.sql$/.test(f)).sort())await db.exec(await fs.readFile(new URL(file,root),'utf8'));
 await db.exec('begin');await db.exec(apply.replace(/^begin;$/m,'').replace(/^commit;$/m,''));
 assert.equal((await db.query('select count(*)::int n from public.mindex_bible_verses')).rows[0].n,102031);await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from public.mindex_bible_verses')).rows[0].n,0);
 await db.query("update mindex_maintenance.authoritative_library_20261016 set payload=jsonb_set(payload,'{0,text}',to_jsonb('tampered'::text)) where part=1");await assert.rejects(db.exec(apply),/MISSING_OR_CHANGED_PART/);await db.exec('rollback');
 await db.exec('delete from mindex_maintenance.authoritative_library_20261016 where part=1');await db.exec(await fs.readFile(new URL('01-data.sql',root),'utf8'));
 await db.query("update public.mindex_bible_translations set name='later' where id=$1",[plan.beforeTranslations[0].id]);await assert.rejects(db.exec(apply),/OLD_TRANSLATION_DRIFT/);await db.exec('rollback');await db.query('update public.mindex_bible_translations set name=$1 where id=$2',[plan.beforeTranslations[0].name,plan.beforeTranslations[0].id]);
 await db.exec(apply);assert.deepEqual((await db.query('select * from public.mindex_bible_verses order by id')).rows,plan.rows.toSorted((a,b)=>a.id.localeCompare(b.id)));assert.equal((await db.query('select count(*)::int n from public.mindex_bible_translations where is_active')).rows[0].n,8);
 await db.exec(apply);
 await db.query("update public.mindex_bible_verses set text='future edit' where id=$1",[plan.rows[0].id]);await assert.rejects(db.exec(apply),/CURRENT_BODY_DRIFT/);await db.exec('rollback');
 await db.exec('set session authorization anon');await assert.rejects(db.query('select * from mindex_maintenance.authoritative_library_20261016'),/permission denied/);await db.exec('reset session authorization');
 console.log('PASS real PostgreSQL102031-row transport/import/exact content,8active editions, missing/tamper/old/new drift,atomic rollback,replay,privateACL');
}finally{await db.close();}
