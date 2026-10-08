import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { openWorshipTestDb } from './helpers/worship-test-db.mjs';

// Optional locally parsed operator XML: never connects to production.
const rows = process.env.MODERN_BIBLE_SOURCE_JSON
  ? JSON.parse(await fs.readFile(process.env.MODERN_BIBLE_SOURCE_JSON, 'utf8'))
  : [
    ...Array.from({length:2428}, (_,i) => ({book_code:'GEN',chapter:Math.floor(i/50)+1,
      verse:i%50+1,text:`[제목 ${i}; ${'긴 설명 '.repeat(i===0 ? 40 : 0)}] 본문 ${i} [본문 주석]`,section_title:''})),
    {book_code:'PSA',chapter:1,verse:1,text:'일반 본문 [중간 주석]',section_title:''},
    {book_code:'2SA',chapter:22,verse:2,text:'기존 본문',section_title:'기존 제목'},
  ];
const targets = rows.filter(row => row.text.startsWith('['));
assert.equal(targets.length,2428);
const md5 = text => createHash('md5').update(text).digest('hex');
const digest = md5([...targets].sort((a,b) => (a.book_code < b.book_code ? -1 : a.book_code > b.book_code ? 1 : 0)
  || a.chapter-b.chapter || a.verse-b.verse).map(r=>`${r.book_code}:${r.chapter}:${r.verse}:${md5(r.text)}`).join('\n'));
let sql = await fs.readFile(new URL('../migrations/2026-10-08-modern-bible-headings.sql',import.meta.url),'utf8');
if (process.env.MODERN_BIBLE_SOURCE_JSON) assert.equal(digest,'133cb99aacef492ea1a2064299c39a6d');
else sql=sql.replace('133cb99aacef492ea1a2064299c39a6d',digest);
const db=await openWorshipTestDb({requirePostgres:true});
const tid=randomUUID(), other=randomUUID();
try {
  await db.exec(`create role anon; create role authenticated;
    create table public.mindex_bible_translations(id uuid primary key,translation_key text unique,name text,is_active boolean);
    create table public.mindex_bible_verses(id uuid primary key,translation_id uuid,book_code text,chapter int,verse int,
      text text,section_title text,is_active boolean,metadata jsonb default '{}');`);
  await db.query('insert into public.mindex_bible_translations values ($1,$2,$2,true),($3,$4,$4,true)',[tid,'현대어',other,'다른 역본']);
  const seeded=rows.map(r=>({...r,id:randomUUID(),translation_id:tid,is_active:true,metadata:{preserve:'yes'}}));
  seeded.push({id:randomUUID(),translation_id:other,book_code:'GEN',chapter:1,verse:1,text:'[다른 역본] 본문',section_title:'',is_active:true,metadata:{}});
  await db.query('insert into public.mindex_bible_verses select * from jsonb_populate_recordset(null::public.mindex_bible_verses,$1)',[JSON.stringify(seeded)]);
  const first=seeded.find(r=>r.text.startsWith('['));
  await db.query('update public.mindex_bible_verses set text=$1 where id=$2',['원본과 다른 본문',first.id]);
  await assert.rejects(db.exec(sql),/MODERN_HEADING_SOURCE_MISMATCH/);
  await db.exec('rollback');
  assert.equal((await db.query("select to_regclass('mindex_maintenance.modern_bible_headings_20261008') as backup")).rows[0].backup,null);
  await db.query('update public.mindex_bible_verses set text=$1 where id=$2',[first.text,first.id]);
  await db.exec(`create function public.reject_heading_update() returns trigger language plpgsql as $$ begin raise exception 'INJECTED_FAILURE'; end $$;
    create trigger reject_heading before update on public.mindex_bible_verses for each row execute function public.reject_heading_update();`);
  await assert.rejects(db.exec(sql),/INJECTED_FAILURE/);
  await db.exec('rollback; drop trigger reject_heading on public.mindex_bible_verses');
  assert.equal((await db.query("select to_regclass('mindex_maintenance.modern_bible_headings_20261008') as backup")).rows[0].backup,null);
  // SQL Editor/pooler may run the report in a separate autocommit session.
  const blockEnd=sql.indexOf('$repair$;')+'$repair$;'.length;
  await db.exec(sql.slice(0,blockEnd));
  const reportClient=await db.connect();
  const report=(await reportClient.query(sql.slice(blockEnd))).rows[0];
  assert.equal(report.status,'modern_bible_headings_installed');
  assert.equal(Number(report.backed_up),2428);
  const after=(await db.query('select * from public.mindex_bible_verses')).rows;
  const byId=new Map(after.map(r=>[r.id,r]));
  for (const row of seeded) {
    const expected={...row};
    if(row.translation_id===tid && row.text.startsWith('[')) {
      const end=row.text.indexOf(']');
      expected.section_title=row.text.slice(1,end).trim(); expected.text=row.text.slice(end+1).trim();
    }
    // Compare all columns, including unchanged metadata, IDs and other translations.
    assert.deepEqual(byId.get(row.id),expected);
  }
  const backups=(await db.query('select original_row from mindex_maintenance.modern_bible_headings_20261008 order by verse_id')).rows;
  assert.equal(backups.length,2428);
  const beforeById=new Map(seeded.map(r=>[r.id,r]));
  for(const backup of backups) assert.deepEqual(backup.original_row,beforeById.get(backup.original_row.id));
  await db.exec(sql);
  assert.deepEqual((await db.query('select original_row from mindex_maintenance.modern_bible_headings_20261008 order by verse_id')).rows,backups);
  await db.exec('set session authorization anon');
  await assert.rejects(db.query('select * from mindex_maintenance.modern_bible_headings_20261008'),/permission denied/);
  await db.exec('reset session authorization');
  await db.query('update public.mindex_bible_verses set metadata=$1 where id=$2',[{changed:true},first.id]);
  await assert.rejects(db.exec(sql),/MODERN_HEADING_CURRENT_ROW_CHANGED/);
  await db.exec('rollback');
  assert.deepEqual((await db.query('select metadata from public.mindex_bible_verses where id=$1',[first.id])).rows[0].metadata,{changed:true});
  console.log(`PASS ${rows.length} source verses: exact split, unchanged other rows, complete private backup, retry, drift rejection and failure rollback`);
} finally {await db.close();}
