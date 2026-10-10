import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { openWorshipTestDb } from './helpers/worship-test-db.mjs';
const specs=[['쉬운성경',5,'3212b4c02f4bce1413e5175347a71518'],['우리말',115,'e96bc1d4eb9e449baf70b5f3c4e21560'],
  ['바른성경',112,'634ccd942109d83136ced8651eed019e'],['공동번역',4,'c987408446767e92da8c51b7391fb899']];
const fixture=process.env.PSALM_HEADING_BEFORE_JSON
  ? JSON.parse(await fs.readFile(process.env.PSALM_HEADING_BEFORE_JSON,'utf8'))
  : specs.map(([name,count])=>{
    const tid=randomUUID();
    return {translation:{id:tid,name,translation_key:name},rows:Array.from({length:count},(_,i)=>({
      id:randomUUID(),translation_id:tid,book_code:'PSA',chapter:i+1,verse:1,verse_end:null,
      text:name==='쉬운성경' ? '[제1권] <소제목> 본문 [본문표현]' : `[표제 ${i} ${'설명 '.repeat(i===0?50:0)}] 본문 [본문표현]`,
      paragraph_index:null,section_title:name==='우리말'&&i===0?'기존 권 제목':'',metadata:{keep:true},is_active:true,
    }))};
  });
let sql=await fs.readFile(new URL('../migrations/2026-10-10-bible-psalm-headings.sql',import.meta.url),'utf8');
const md5=x=>createHash('md5').update(x).digest('hex');
for(const f of fixture){
  const spec=specs.find(([name])=>name===f.translation.name);
  assert.equal(f.rows.length,spec[1]);
  const hash=md5([...f.rows].sort((a,b)=>a.chapter-b.chapter).map(r=>`${r.book_code}:${r.chapter}:${r.verse}:${md5(r.text)}:${md5(r.section_title)}`).join('\n'));
  if(process.env.PSALM_HEADING_BEFORE_JSON)assert.equal(hash,spec[2]);
  else sql=sql.replace(spec[2],hash);
}
const db=await openWorshipTestDb({requirePostgres:true});
try{
  await db.exec(`create role anon;create role authenticated;
    create table public.mindex_bible_translations(id uuid primary key,translation_key text,name text,is_active boolean);
    create table public.mindex_bible_verses(id uuid primary key,translation_id uuid,book_code text,chapter int,verse int,
      verse_end int,text text,paragraph_index int,section_title text,metadata jsonb,is_active boolean);`);
  for(const f of fixture){
    await db.query('insert into public.mindex_bible_translations values($1,$2,$2,true)',[f.translation.id,f.translation.name]);
    // A bracketed NT verse in the same translation MUST remain body text.
    f.rows.push({...f.rows[0],id:randomUUID(),book_code:'JHN',chapter:7,verse:53,text:'[그들은 집으로 돌아갔다.]',section_title:'기존 제목'});
    await db.query('insert into public.mindex_bible_verses select * from jsonb_populate_recordset(null::public.mindex_bible_verses,$1)',[JSON.stringify(f.rows)]);
  }
  const snapshot=async()=> (await db.query('select * from public.mindex_bible_verses order by id')).rows;
  const before=await snapshot();
  const last=fixture.at(-1).rows[0];
  await db.query('update public.mindex_bible_verses set section_title=$1 where id=$2',['이미 바뀜',last.id]);
  await assert.rejects(db.exec(sql),/PSALM_HEADING_SOURCE_MISMATCH/);
  // A single failing DO rolls back earlier translations and its schema/backup too.
  assert.equal((await db.query("select to_regclass('mindex_maintenance.bible_psalm_headings_20261010') as table_name")).rows[0].table_name,null);
  await db.query('update public.mindex_bible_verses set section_title=$1 where id=$2',[last.section_title,last.id]);
  assert.deepEqual(await snapshot(),before);
  await db.exec(`create function fail_heading() returns trigger language plpgsql as $$begin raise exception 'INJECTED_FAILURE';end$$;
    create trigger fail_heading before update on public.mindex_bible_verses for each row execute function fail_heading();`);
  await assert.rejects(db.exec(sql),/INJECTED_FAILURE/);
  assert.deepEqual(await snapshot(),before);
  await db.exec('drop trigger fail_heading on public.mindex_bible_verses');
  const end=sql.indexOf('$repair$;')+'$repair$;'.length;
  await db.exec(sql.slice(0,end));
  const other=await db.connect();
  assert.equal((await other.query(sql.slice(end))).rows.length,4);
  const expected=before.map(row=>{
    if(row.book_code!=='PSA')return row;
    const close=row.text.indexOf(']');let body=row.text.slice(close+1).trim();
    const parts=[row.section_title,row.text.slice(1,close).trim()].filter(Boolean);
    if(fixture.find(f=>f.translation.id===row.translation_id).translation.name==='쉬운성경'){
      const close=body.indexOf('>');parts.push(body.slice(1,close).trim());body=body.slice(close+1).trim();
    }
    return {...row,text:body,section_title:parts.join(' · ')};
  });
  assert.deepEqual(await snapshot(),expected);
  const backups=(await db.query('select original_row from mindex_maintenance.bible_psalm_headings_20261010 order by verse_id')).rows.map(r=>r.original_row);
  assert.deepEqual(backups,before.filter(r=>r.book_code==='PSA'));
  await db.exec(sql);assert.deepEqual(await snapshot(),expected);
  await db.exec('set session authorization anon');
  await assert.rejects(db.query('select * from mindex_maintenance.bible_psalm_headings_20261010'),/permission denied/);
  await db.exec('reset session authorization');
  await db.query('update public.mindex_bible_verses set metadata=$1 where id=$2',[{new:true},last.id]);
  await assert.rejects(db.exec(sql),/PSALM_HEADING_CURRENT_ROW_CHANGED/);
  console.log('PASS 236 Psalm headings: complete backup, existing headings and body preserved, NT exclusions, atomic failure, retry and separate-session report');
}finally{await db.close();}
