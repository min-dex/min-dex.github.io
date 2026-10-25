import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const call=req=>scalar('select public.mutate_single_praise_v1($1)',[req]);
const request=(operation,rest={})=>({protocolVersion:1,requestId:randomUUID(),operation,...rest});
const create=(title='fixture',rest={})=>request('create',{prefix:'ccm',metadata:{title,praise_types:['ccm']},content:{name:'기본',forms:[]},...rest});
const read=ids=>scalar('select public.get_single_praise_records_v1($1)',[ids]);
const expected=rows=>Object.fromEntries(rows.map(r=>[r.id,r.revision]));
const load = path => fs.readFile(new URL(path, import.meta.url), 'utf8');
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

 await db.exec(await fs.readFile(new URL('../migrations/2026-10-24-single-song-store-candidate.sql',import.meta.url),'utf8'));
 await db.exec(await load('../migrations/2026-10-24-single-song-worship-candidate.sql'));
 await db.exec(await fs.readFile(new URL('../migrations/2026-10-24-single-song-lifecycle-candidate.sql',import.meta.url),'utf8'));
 await db.exec(`create role fixture_client;grant execute on function public.mutate_single_praise_v1(jsonb),public.get_single_praise_records_v1(text[]),public.save_single_praise_record_v1(jsonb) to fixture_client;set role fixture_client;`);
 await assert.rejects(db.query('select * from mindex_single_song.records'),/permission denied/);
 await assert.rejects(db.query('select mindex_single_song.save_single_praise_record_v1($1)',[{}]),/permission denied/);
 const aReq=create('a');const a=await call(aReq);assert.equal(a.id,'ccm-001');assert.deepEqual(await call(aReq),a);
 await assert.rejects(call({...aReq,metadata:{title:'changed'}}),/REQUEST_REUSED/);
 await assert.rejects(call(create('bad',{prefix:'knh'})),/INVALID/);
 await assert.rejects(call(request(null)),/INVALID/);
 const b=await call(create('b'));const c=await call(create('c'));
 let rows=await read([a.id,b.id,c.id]);
 const contentBefore=rows.map(r=>r.content);
 await assert.rejects(call(request('same_song',{id:a.id,members:[a.id,b.id],expectedRevisions:{[a.id]:1}})),/GRAPH_CONFLICT/);
 await call(request('same_song',{id:a.id,members:[a.id,b.id,c.id],expectedRevisions:expected(rows)}));
 rows=await read([a.id,b.id,c.id]);assert.deepEqual(rows.map(r=>r.content),contentBefore);
 const stale=expected(rows);
 await call(request('same_song',{id:a.id,members:[a.id,c.id],expectedRevisions:stale}));
 rows=await read([a.id,b.id,c.id]);assert.deepEqual(rows[1].relations.same_song,[]);assert.deepEqual(rows[0].relations.same_song,[c.id]);
 await assert.rejects(call(request('same_song',{id:a.id,members:[a.id,b.id,c.id],expectedRevisions:stale})),/CONFLICT/);
 const arrangement=await call(create('arrangement',{baseId:a.id,expectedRevisions:expected(rows.filter(r=>r.id!==b.id))}));
 assert.equal(arrangement.id,'ccm-001-001');assert.equal(arrangement.records.length,3);
 rows=await read([a.id,b.id,c.id,arrangement.id]);
 const source=rows.find(r=>r.id===b.id);source.content={forms:[{id:'unit',part_type:'Verse',lyrics:'한 줄\n둘째 줄',sort_order:1}],audio_set:{starts:[0,4],audioUrl:'fixture'}};
 const saved=await scalar('select public.save_single_praise_record_v1($1)',[{requestId:randomUUID(),expectedRevision:source.revision,record:source}]);
 const rel=await call(request('related',{id:b.id,members:[a.id],expectedRevisions:{[b.id]:saved.revision}}));assert.deepEqual(rel.records[0].content,source.content);
 await assert.rejects(call(request('delete',{id:b.id,expectedRevisions:{[b.id]:rel.records[0].revision}})),/NOT_EMPTY/);
 await assert.rejects(call(request('delete',{id:a.id,expectedRevisions:{}})),/NOT_EMPTY/);
 const empty=await call(create('empty'));
 await db.exec('reset role');await db.query(`insert into mindex_worship_services(id,service_type_id,service_date,title,source_ref) values($1,'fixture','2026-10-24','fixture',$2)`,[randomUUID(),{songId:empty.id}]);await db.exec('set role fixture_client');
 await assert.rejects(call(request('delete',{id:empty.id,expectedRevisions:{[empty.id]:1}})),/IN_USE/);
 await db.exec('reset role');await db.query(`delete from mindex_worship_services where source_ref->>'songId'=$1`,[empty.id]);await db.exec('set role fixture_client');
 const delReq=request('delete',{id:empty.id,expectedRevisions:{[empty.id]:1}});await call(delReq);assert.deepEqual(await call(delReq),{records:[],deleted:[empty.id]});
 await assert.rejects(scalar('select public.save_single_praise_record_v1($1)',[{requestId:randomUUID(),expectedRevision:0,record:empty.records[0]}]),/MISSING/);
 await assert.rejects(call({...aReq,requestId:delReq.requestId}),/REQUEST_REUSED/);
 const ephemeralReq=create('ephemeral'),ephemeral=await call(ephemeralReq);
 await call(request('delete',{id:ephemeral.id,expectedRevisions:{[ephemeral.id]:1}}));
 await assert.rejects(call(ephemeralReq),/CREATED_THEN_REMOVED/);
 const current=await read([a.id,c.id,arrangement.id]);
 const deletion=await call(request('delete',{id:c.id,expectedRevisions:expected(current)}));
 assert.equal(deletion.records.length,2);assert(deletion.records.every(r=>!r.relations.same_song.includes(c.id)));
 const beforeGraph=await read([a.id]);
 await assert.rejects(scalar('select public.save_single_praise_record_v1($1)',[{requestId:randomUUID(),expectedRevision:beforeGraph[0].revision,record:{...beforeGraph[0],relations:{same_song:[],related:[]}}}]),/IDENTITY_OR_RELATIONS/);
 assert.deepEqual(await read([a.id]),beforeGraph);
 const after=await call(create('after'));assert.notEqual(after.id,empty.id);
 if(db.connect){
  const x=await db.connect(),y=await db.connect();
  const raced=await Promise.all([x.query('select public.mutate_single_praise_v1($1)',[create('race1')]),y.query('select public.mutate_single_praise_v1($1)',[create('race2')])]);
  assert.notEqual(raced[0].rows[0].mutate_single_praise_v1.id,raced[1].rows[0].mutate_single_praise_v1.id);
 }
 // Imported empty versions carry technical defaults, not user content.
 await db.exec('reset role');
 const attrs=async()=> (await db.query("select proowner,proacl,proconfig,prosecdef,pg_get_functiondef(oid) as definition from pg_proc where oid='public.mutate_single_praise_v1(jsonb)'::regprocedure")).rows[0];
 const original=await attrs();
 const migration=await load('../migrations/2026-10-25-imported-empty-defaults.sql');
 const fixture={metadata:{title:'새 찬양 3',normalized_title:'새찬양3',created_at:'2026-01-01T00:00:00Z',source_count:1,metadata:{},scripture:[]},content:{name:'기본',forms:[],audio_set:null,version_label:'기본',curated_version_name:'기본',version_order:1,lyric_signature:'mindex-0',_audioSetSupported:true},legacy:{songId:'11111111-1111-4111-8111-111111111111'},provenance:{source:{id:'11111111-1111-4111-8111-111111111111',title:'새 찬양 3',created_at:'2026-01-01T00:00:00Z',source_count:1}}};
 const imported=await call(create('imported'));
 const importedRecord={...imported.records[0],...fixture};
 const put=async rec=>db.query('update mindex_single_song.records set payload=$2 where id=$1',[imported.id,rec]);
 const erase=()=>call(request('delete',{id:imported.id,expectedRevisions:{[imported.id]:1}}));
 await put(importedRecord);await assert.rejects(erase(),/NOT_EMPTY/);
 await db.exec(migration);await db.exec(migration);
 const patched=await attrs();assert.deepEqual({...patched,definition:original.definition},original);
 for(const [area,key,value] of [
  ['content','forms',[{lyrics:'real'}]],['content','audio_set',{starts:[0,4]}],['content','deck_key','score'],['content','timing',[0]],
  ['content','version_label','편곡'],['content','version_order',2],['content','lyric_signature','mindex-1'],['content','unknown','keep'],
  ['metadata','subtitle','real'],['metadata','metadata',{composer:'real'}],['metadata','scripture',['Jn 3:16']],
  ['metadata','source_count',2],['metadata','created_at','different'],['metadata','normalized_title','different'],['metadata','unknown','keep']]){
   const rec=structuredClone(importedRecord);rec[area][key]=value;await put(rec);await assert.rejects(erase(),/NOT_EMPTY/,area+'.'+key);
 }
 const noProvenance=structuredClone(importedRecord);delete noProvenance.provenance;await put(noProvenance);await assert.rejects(erase(),/NOT_EMPTY/);
 await put(importedRecord);
 await assert.rejects(call(request('delete',{id:imported.id,expectedRevisions:{[imported.id]:0}})),/CONFLICT/);
 const incoming=await call(create('incoming'));
 await db.query("update mindex_single_song.records set payload=jsonb_set(payload,'{relations,related}',$2) where id=$1",[incoming.id,JSON.stringify([imported.id])]);
 await assert.rejects(erase(),/NOT_EMPTY/);
 await db.query("update mindex_single_song.records set payload=jsonb_set(payload,'{relations,related}','[]') where id=$1",[incoming.id]);
 const worshipId=randomUUID();await db.query("insert into mindex_worship_services(id,service_type_id,service_date,title,source_ref) values($1,'fixture','2026-01-01','fixture',$2)",[worshipId,{songId:imported.id}]);
 await assert.rejects(erase(),/IN_USE/);await db.query('delete from mindex_worship_services where id=$1',[worshipId]);
 // Restoring the exact original definition restores the old refusal, without data edits.
 await db.exec(original.definition);await assert.rejects(erase(),/NOT_EMPTY/);await db.exec(migration);
 if(process.env.MINDEX_EMPTY_IMPORT_FIXTURE){
  const snapshot=JSON.parse(await fs.readFile(process.env.MINDEX_EMPTY_IMPORT_FIXTURE,'utf8'));
  await put({...snapshot.candidates[0],id:imported.id,revision:1});
 }
 await db.exec('begin');const deleted=await erase();assert.deepEqual(deleted.deleted,[imported.id]);await db.exec('rollback');assert.equal((await read([imported.id])).length,1);
 await db.exec('set role fixture_client');assert.deepEqual((await erase()).deleted,[imported.id]);await db.exec('reset role');
 console.log('PASS imported defaults: exact values/provenance, meaningful fields denied, incoming refs/CAS, function attributes and rollback preserved');
 console.log('PASS lifecycle: allocator/replay/no reuse, arrangement, group merge/split/CAS, related preservation, referenced/content deletion guards, closed direct access');
} finally {await db.close();}
