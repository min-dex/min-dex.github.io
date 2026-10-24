// Explicit private local artifacts only. Disposable PostgreSQL; no production URL accepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {openWorshipTestDb} from '../tests/helpers/worship-test-db.mjs';
const [catalogPath,planPath]=process.argv.slice(2);
if(!catalogPath||!planPath)throw Error('Provide explicit private catalog and plan paths');
const records=JSON.parse(await fs.readFile(catalogPath,'utf8')),plan=JSON.parse(await fs.readFile(planPath,'utf8'));
const db=await openWorshipTestDb({requirePostgres:true});
const load=path=>fs.readFile(new URL(path,import.meta.url),'utf8');
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create table public.mindex_worship_service_types(id text primary key);
    create table public.mindex_worship_templates(id uuid primary key);
    create table public.mindex_songs(id uuid primary key);
    create table public.mindex_canonical_songs(id uuid primary key);
    create table public.mindex_song_versions(
      id uuid primary key,
      source_song_id uuid references public.mindex_songs(id),
      canonical_song_id uuid references public.mindex_canonical_songs(id)
    );
    create table public.mindex_version_units(id uuid primary key, version_id uuid references public.mindex_song_versions(id));
    create table public.mindex_scriptures(id uuid primary key);
    create function public.mindex_touch_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at=now(); return new; end $$;
  `);

  const schema = await load('../scripts/worship-schema.sql');
  await db.exec(schema.slice(
    schema.indexOf('create table if not exists public.mindex_worship_services ('),
    schema.indexOf('-- ── Import review pipeline'),
  ));
  await db.exec(`
    do $legacy$
    declare relation_name text;
    begin
      foreach relation_name in array array[
        'mindex_worship_services',
        'mindex_worship_sections',
        'mindex_worship_elements',
        'mindex_worship_slides'
      ] loop
        execute format('alter table public.%I enable row level security', relation_name);
        execute format('grant select, insert, update, delete on public.%I to anon, authenticated', relation_name);
        execute format('create policy legacy_shared_all on public.%I to anon, authenticated using (true) with check (true)', relation_name);
      end loop;
    end
    $legacy$;
  `);
  await db.exec("insert into public.mindex_worship_service_types values ('fixture')");

  await db.exec(await load('../migrations/2026-09-22-worship-atomic-additive.sql'));


 await db.exec(await load('../migrations/2026-10-24-single-song-store-candidate.sql'));
 await db.query("insert into mindex_single_song.records select r->>'id',(r->>'revision')::bigint,r from jsonb_array_elements($1::jsonb) r",[JSON.stringify(records)]);
 await db.exec(await load('../migrations/2026-10-24-single-song-worship-candidate.sql'));
 await db.exec(await load('../migrations/2026-10-24-single-song-lifecycle-candidate.sql'));
 const retired=plan.summary.retiredCandidateIds||[];
 await db.query("insert into mindex_single_song.issued_ids(id,deleted) select value,true from jsonb_array_elements_text($1::jsonb)",[JSON.stringify(retired)]);
 await db.exec("update mindex_single_song.counters c set last_number=(select coalesce(max(substring(i.id from '[0-9]+$')::bigint),0) from mindex_single_song.issued_ids i where i.id ~ ('^'||c.prefix||'-[0-9]+$'))");
 const read=()=>scalar('select public.get_single_praise_records_v1($1)',[records.map(r=>r.id)]);
 assert.deepEqual((await read()).sort((a,b)=>a.id.localeCompare(b.id)),[...records].sort((a,b)=>a.id.localeCompare(b.id)));
 const counters=(await db.query('select * from mindex_single_song.counters order by prefix')).rows;
 await db.exec('begin');
 const made=await scalar('select public.mutate_single_praise_v1($1)',[{protocolVersion:1,requestId:randomUUID(),operation:'create',prefix:'ccm',metadata:{title:'local rehearsal'},content:{forms:[]}}]);
 assert(!new Set([...records.map(r=>r.id),...retired]).has(made.id));
 await db.exec('rollback');
 assert.deepEqual((await read()).sort((a,b)=>a.id.localeCompare(b.id)),[...records].sort((a,b)=>a.id.localeCompare(b.id)));
 assert.equal(await scalar('select count(*)::int from mindex_single_song.records'),records.length);
 console.log(JSON.stringify({status:'PASS',engine:'disposable PostgreSQL',records:records.length,retiredReserved:retired.length,counters,nextCcm:made.id,exactPayloadRoundtrip:true,rollback:true,productionWrites:0}));
} finally {await db.close();}
