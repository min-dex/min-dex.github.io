import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const root=new URL('../../Biblia/.local/bsk-source-library-20261016/mindex-import/',import.meta.url);
try{await fs.access(new URL('plan.json',root));}catch{console.log('SKIP requires private dated publisher snapshot and production preflight plan');process.exit(0);}
const plan=JSON.parse(await fs.readFile(new URL('plan.json',root),'utf8'));
const files=(await fs.readdir(root)).filter(n=>n.endsWith('.sql') && !n.includes('all-in-one')).sort();
const sql=await Promise.all(files.map(n=>fs.readFile(new URL(n,root),'utf8')));
const schema=await fs.readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8');
const db=await openWorshipTestDb({requirePostgres:true});
try{
 await db.exec('create role anon;create role authenticated;');
 for(const name of ['mindex_scripture_books','mindex_bible_translations','mindex_bible_verses']){
  if(name==='mindex_scripture_books')await db.exec(`create table public.mindex_scripture_books(code text primary key,sort_order integer not null unique,testament text not null,division text not null,korean_name text not null,english_name text not null,canonical_english_title text not null default '',short_name text not null,aliases text[] not null default '{}',jewish_category text not null default '',author text not null default '',is_active boolean not null default true,corpus text not null default 'canonical',canon text not null default 'protestant',book_group text not null default '',osis_code text not null default '',usfm_code text not null default '',metadata jsonb not null default '{}');`);
  else {const start=schema.indexOf(`create table if not exists public.${name} (`);await db.exec(schema.slice(start,schema.indexOf('\n);',start)+4));}
 }
 await db.query('insert into public.mindex_bible_translations select * from jsonb_populate_record(null::public.mindex_bible_translations,$1)',[JSON.stringify(plan.beforeTranslation)]);
 const run=async()=>{for(const s of sql)await db.exec(s);};
 const combined=await fs.readFile(new URL('all-in-one.sql',root),'utf8');
 await db.exec('begin');await db.exec(combined.replace(/^begin;$/m,'').replace(/commit;\s*$/,''));
 assert.equal((await db.query('select count(*)::int n from public.mindex_bible_verses')).rows[0].n,4389);await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from public.mindex_bible_verses')).rows[0].n,0);
 const compact=await fs.readFile(new URL('compressed-all-in-one.sql',root),'utf8');
 await db.exec('begin');await db.exec(compact.replace(/^begin;$/m,'').replace(/^commit;$/m,''));
 assert.deepEqual((await db.query('select * from public.mindex_bible_verses order by id')).rows,plan.rows.toSorted((a,b)=>a.id.localeCompare(b.id)));await db.exec('rollback');
 await db.exec(sql[0]);
 await assert.rejects(db.exec(sql.at(-1)),/MISSING_OR_CHANGED_PART|INCOMPLETE_UPLOAD/);await db.exec('rollback');
 for(const s of sql.slice(1,-1))await db.exec(s);
 await db.query("update mindex_maintenance.bsk_supplement_20261016 set payload=jsonb_set(payload,'{0,text}',to_jsonb('tampered'::text)) where part=1");
 await assert.rejects(db.exec(sql.at(-1)),/MISSING_OR_CHANGED_PART/);await db.exec('rollback');
 await db.exec('delete from mindex_maintenance.bsk_supplement_20261016 where part=1');await db.exec(sql[1]);
 await db.query('update public.mindex_bible_translations set name=$1',['later edit']);
 await assert.rejects(db.exec(sql.at(-1)),/SOURCE_METADATA_CHANGED/);await db.exec('rollback');
 await db.query('update public.mindex_bible_translations set name=$1',[plan.beforeTranslation.name]);
 await db.exec("create function fail_import() returns trigger language plpgsql as $$begin raise exception 'INJECTED';end$$;create trigger fail_import before insert on public.mindex_bible_verses for each row execute function fail_import();");
 await assert.rejects(db.exec(sql.at(-1)),/INJECTED/);await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from public.mindex_scripture_books')).rows[0].n,0);
 await db.exec('drop trigger fail_import on public.mindex_bible_verses');await db.exec(sql.at(-1));
 const rows=(await db.query('select * from public.mindex_bible_verses order by id')).rows;
 assert.deepEqual(rows,plan.rows.toSorted((a,b)=>a.id.localeCompare(b.id)));
 assert.deepEqual((await db.query('select metadata from public.mindex_bible_translations')).rows[0].metadata,plan.afterMetadata);
 await run();assert.equal((await db.query('select count(*)::int n from public.mindex_bible_verses')).rows[0].n,4389);
 await db.exec('set session authorization anon');await assert.rejects(db.query('select * from mindex_maintenance.bsk_supplement_20261016'),/permission denied/);await db.exec('reset session authorization');
 await db.query('update public.mindex_bible_verses set text=$1 where id=$2',['future edit',plan.rows[0].id]);
 await assert.rejects(db.exec(sql.at(-1)),/CURRENT_ROWS_CHANGED/);await db.exec('rollback');
 console.log('PASS PostgreSQL: full 4389-row exact import, incomplete/tampered upload, drift, transaction rollback, replay, future edit protection and private backup ACL');
}finally{await db.close();}
