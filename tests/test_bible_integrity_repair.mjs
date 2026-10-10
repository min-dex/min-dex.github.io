import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const items=JSON.parse(await fs.readFile(new URL('../docs/bible-repair-20261010-manifest.json',import.meta.url),'utf8'));
const sql=await fs.readFile(new URL('../migrations/2026-10-10-bible-integrity-repair.sql',import.meta.url),'utf8');
const db=await openWorshipTestDb({requirePostgres:true});
try {
 await db.exec(`create role anon;create role authenticated;
 create table public.mindex_bible_translations(id uuid primary key,name text,translation_key text,is_active boolean);
 create table public.mindex_bible_verses(id uuid primary key,translation_id uuid,book_code text,chapter int,verse int,
 verse_end int,text text,paragraph_index int,section_title text,metadata jsonb,is_active boolean);`);
 for (const i of items) {
  await db.query('insert into public.mindex_bible_translations values($1,$2,$2,true) on conflict do nothing',[i.before.translation_id,i.translation]);
  await db.query('insert into public.mindex_bible_verses select * from jsonb_populate_record(null::public.mindex_bible_verses,$1)',[JSON.stringify(i.before)]);
 }
 const snapshot=async()=> (await db.query('select * from public.mindex_bible_verses order by id')).rows;
 const before=await snapshot();const last=items.at(-1).before;
 await db.query('update public.mindex_bible_verses set text=$1 where id=$2',['changed',last.id]);
 await assert.rejects(db.exec(sql),/SOURCE_CHANGED/);
 assert.equal((await db.query("select to_regclass('mindex_maintenance.bible_integrity_20261010') as name")).rows[0].name,null);
 await db.query('update public.mindex_bible_verses set text=$1 where id=$2',[last.text,last.id]);
 assert.deepEqual(await snapshot(),before);
 await db.exec(`create function fail_repair() returns trigger language plpgsql as $$begin raise exception 'INJECTED';end$$;
 create trigger fail_repair before update on public.mindex_bible_verses for each row execute function fail_repair();`);
 await assert.rejects(db.exec(sql),/INJECTED/);assert.deepEqual(await snapshot(),before);
 await db.exec('drop trigger fail_repair on public.mindex_bible_verses');
 await db.exec(sql);
 const expected=items.map(i=>({...i.before,...i.patch})).sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(await snapshot(),expected);
 assert.deepEqual((await db.query('select original_row from mindex_maintenance.bible_integrity_20261010 order by verse_id')).rows.map(r=>r.original_row),before);
 assert.equal(expected.filter(r=>r.is_active && !r.text).length,0);
 assert.equal(expected.filter(r=>r.verse_end).length,4);
 await db.exec(sql);assert.deepEqual(await snapshot(),expected);
 const other=await db.connect();assert.equal((await other.query(sql.slice(sql.indexOf('$repair$;')+9))).rows[0].backed_up,'9');
 await db.exec('set session authorization anon');
 await assert.rejects(db.query('select * from mindex_maintenance.bible_integrity_20261010'),/permission denied/);
 await db.exec('reset session authorization');
 await db.query('update public.mindex_bible_verses set metadata=$1 where id=$2',[{later:true},last.id]);
 await assert.rejects(db.exec(sql),/CURRENT_CHANGED/);
 console.log('PASS 9-row repair: full backups, exact guards, atomic rollback, replay, future edits and backup ACL');
} finally { await db.close(); }
