import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const sql=await fs.readFile(new URL('../migrations/2026-10-16-bible-legacy-purge.sql',import.meta.url),'utf8');
const old=JSON.parse(sql.match(/expected jsonb:='(.*?)'::jsonb/s)[1].replaceAll("''","'"));
const active=[...sql.matchAll(/id not in\((.*?)\)/gs)][0][1].match(/[0-9a-f-]{36}/g);assert.equal(active.length,8);
const backups=[...sql.matchAll(/foreach backup_name in array array\[(.*?)\]/gs)][0][1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
const schema=await fs.readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8');const db=await openWorshipTestDb({requirePostgres:true});
try{
 await db.exec('create table public.mindex_scripture_books(code text primary key);insert into public.mindex_scripture_books values(\'GEN\');');
 for(const n of ['mindex_bible_translations','mindex_bible_verses']){let a=schema.indexOf(`create table if not exists public.${n} (`);await db.exec(schema.slice(a,schema.indexOf('\n);',a)+4));}
 await db.exec('create schema mindex_maintenance;');
 for(const name of [...backups,'advisor_backup_20261014'])await db.exec(`create table mindex_maintenance.${name}(body text);insert into mindex_maintenance.${name} values('synthetic backup fixture');`);
 for(const [i,id] of active.entries())await db.query('insert into public.mindex_bible_translations(id,translation_key,name,is_active) values($1,$2,$2,true)',[id,'official-'+i]);
 for(const t of old)await db.query('insert into public.mindex_bible_translations(id,translation_key,name,is_active) values($1,$2,$2,false)',[t.id,t.name]);
 const ids=[...active,...old.map(t=>t.id)];let serial=1;
 for(const id of ids)for(let v=1;v<=2;v++)await db.query('insert into public.mindex_bible_verses(id,translation_id,book_code,chapter,verse,text) values($1,$2,\'GEN\',1,$3,$4)',[`00000000-0000-4000-8000-${String(serial++).padStart(12,'0')}`,id,v,'synthetic body '+v]);
 const fixture=[];for(const t of old){const row=(await db.query("select count(*)::int rows,encode(sha256(convert_to(jsonb_agg(to_jsonb(v) order by id)::text,'UTF8')),'hex') sha256 from public.mindex_bible_verses v where translation_id=$1",[t.id])).rows[0];fixture.push({...t,...row});}
 const run=sql.replace(sql.match(/expected jsonb:='(.*?)'::jsonb/s)[0],`expected jsonb:='${JSON.stringify(fixture).replaceAll("'","''")}'::jsonb`).replaceAll('253140','16');
 const before=(await db.query('select * from public.mindex_bible_verses where translation_id=any($1::uuid[]) order by id',[active])).rows;
 await db.exec('begin');await db.exec(run.replace(/^begin;$/m,'').replace(/^commit;$/m,''));assert.equal((await db.query('select count(*)::int n from public.mindex_bible_translations')).rows[0].n,8);await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from public.mindex_bible_translations')).rows[0].n,16);
 await db.query('update public.mindex_bible_verses set text=$1 where translation_id=$2 and verse=1',['future edit',old[0].id]);await assert.rejects(db.exec(run),/LEGACY_BODY_CHANGED/);await db.exec('rollback');await db.query('update public.mindex_bible_verses set text=$1 where translation_id=$2 and verse=1',['synthetic body 1',old[0].id]);
 await db.exec('create table public.personal_notes(id int,verse_id uuid references public.mindex_bible_verses(id));');await assert.rejects(db.exec(run),/REFERENCED_USER_DATA_REQUIRES_REVIEW/);await db.exec('rollback');await db.exec('drop table public.personal_notes');
 await db.exec("create function public.test_delete_guard() returns trigger language plpgsql as $$begin return old;end$$;create trigger source_delete_review before delete on public.mindex_bible_verses for each row execute function public.test_delete_guard();");await assert.rejects(db.exec(run),/DELETE_TRIGGER_REQUIRES_REVIEW/);await db.exec('rollback');await db.exec('drop trigger source_delete_review on public.mindex_bible_verses');
 await db.exec(run);assert.deepEqual((await db.query('select * from public.mindex_bible_verses order by id')).rows,before);assert.equal((await db.query('select count(*)::int n from public.mindex_bible_translations')).rows[0].n,8);
 for(const name of backups)assert.equal((await db.query('select to_regclass($1) r',['mindex_maintenance.'+name])).rows[0].r,null);
 assert.equal((await db.query('select count(*)::int n from mindex_maintenance.advisor_backup_20261014')).rows[0].n,1);await db.exec(run);
 console.log('PASS real PostgreSQL: reviewed inactive scope only, all active metadata/bodies unchanged,15named backups purged without new backup, unrelated backup preserved; body drift/FK/delete-trigger guards,rollback,replay');
}finally{await db.close();}
