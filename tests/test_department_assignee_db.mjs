// Executes the production migration in a disposable PostgreSQL 17 cluster.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { openWorshipTestDb } from './helpers/worship-test-db.mjs';

const db = await openWorshipTestDb({ requirePostgres: true });
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
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
  await db.exec(await load('../migrations/2026-09-22-worship-atomic-cutover.sql'));
  await db.exec(`create table public.mindex_sunday_calendar(id uuid primary key,date date unique,
    children_prayer text,youth_prayer text,youth_offering_prayer text,young_adult_prayer text);
    alter table public.mindex_sunday_calendar enable row level security;
    grant select,update on public.mindex_sunday_calendar to anon,authenticated;
    create policy calendar_access on public.mindex_sunday_calendar to anon,authenticated using(true) with check(true);
    insert into public.mindex_worship_service_types values ('children'),('youth'),('young-adult');`);
  await db.exec(await load('../migrations/2026-10-18-department-assignee-links.sql'));

  const cal=randomUUID(),sid=randomUUID(),sec=randomUUID(),eid=randomUUID();
  await db.query("insert into public.mindex_sunday_calendar(id,date,children_prayer) values($1,'2026-10-25','어린이 A')",[cal]);
  await db.exec('set session authorization anon');
  const created=await scalar('select public.create_worship_service_v1($1)',[{
    protocolVersion:1,requestId:randomUUID(),serviceId:sid,serviceTypeId:'children',serviceDate:'2026-10-25',metadataPatch:{title:'fixture'},
    sections:[{id:sec,patch:{title:'봉헌기도'}}],elements:[{id:eid,sectionId:sec,patch:{element_type:'plain_text',person:'어린이 A',source_ref:{label:'봉헌기도'}}}],document:{sourceText:'original source'}}]);
  const save=(revision,value)=>({protocolVersion:1,requestId:randomUUID(),serviceId:sid,expectedRevision:revision,
    metadataPatch:{},sectionPatches:[],elementPatches:[{id:eid,patch:{person:value}}],document:{sourceText:value}});
  const req=save('1','어린이 B');
  const saved=await scalar('select public.save_worship_service_v1($1)',[req]);
  assert.equal(saved.calendar.children_prayer,'어린이 B');assert.equal(saved.aggregate.elements[0].person,'어린이 B');
  assert.equal((await scalar('select public.save_worship_service_v1($1)',[req])).replayed,true);
  const batch={requestId:randomUUID(),calendarId:cal,field:'children_prayer',expected:'어린이 B',value:'어린이 C',requests:[save(saved.committedRevision,'어린이 C')]};
  const receipt=await scalar('select public.save_calendar_assignee_v1($1)',[batch]);
  assert.equal(receipt.calendar.children_prayer,'어린이 C');assert.equal(receipt.services[0].elements[0].person,'어린이 C');
  assert.equal((await scalar('select public.save_calendar_assignee_v1($1)',[batch])).replayed,true);
  await assert.rejects(scalar('select public.save_calendar_assignee_v1($1)',[{...batch,value:'changed'}]),/REQUEST_ID_REUSED/);
  await assert.rejects(scalar('select public.save_calendar_assignee_v1($1)',[{...batch,requestId:randomUUID()}]),/CALENDAR_REVISION_CONFLICT/);
  await assert.rejects(scalar('select public.save_worship_service_v1($1)',[save('1','stale')]),/REVISION_CONFLICT/);
  await assert.rejects(db.query("update public.mindex_sunday_calendar set children_prayer='bypass' where id=$1",[cal]),/DEPARTMENT_LINK_CLIENT_REQUIRED/);
  const bad={...batch,requestId:randomUUID(),expected:'어린이 C',value:'bad',requests:[save('1','bad')]};
  await assert.rejects(scalar('select public.save_calendar_assignee_v1($1)',[bad]),/REVISION_CONFLICT/);
  assert.equal(await scalar('select children_prayer from public.mindex_sunday_calendar where id=$1',[cal]),'어린이 C');
  const cleared={...batch,requestId:randomUUID(),expected:'어린이 C',value:'',requests:[save(receipt.services[0].revision,'')]};
  const empty=await scalar('select public.save_calendar_assignee_v1($1)',[cleared]);
  assert.equal(empty.calendar.children_prayer,'');assert.equal(empty.services[0].elements[0].person,'');

  // A later request failing must roll back earlier service patches in the same calendar batch.
  await db.exec('reset session authorization');
  const sid2=randomUUID(),sec2=randomUUID(),eid2=randomUUID();
  await db.exec('set session authorization anon');
  const duplicate=await scalar('select public.create_worship_service_v1($1)',[{
    protocolVersion:1,requestId:randomUUID(),serviceId:sid2,serviceTypeId:'children',serviceDate:'2026-10-25',metadataPatch:{title:'second fixture'},
    sections:[{id:sec2,patch:{title:'봉헌기도'}}],elements:[{id:eid2,sectionId:sec2,patch:{element_type:'plain_text',person:'',source_ref:{label:'봉헌기도'}}}],document:{sourceText:''}}]);
  const first=save(empty.services[0].revision,'batch value');
  const second={...save('0','batch value'),serviceId:sid2,elementPatches:[{id:eid2,patch:{person:'batch value'}}]};
  await assert.rejects(scalar('select public.save_calendar_assignee_v1($1)',[{
    ...batch,requestId:randomUUID(),expected:'',value:'batch value',requests:[first,second]}]),/REVISION_CONFLICT/);
  assert.equal((await scalar('select public.get_worship_service_v1($1)',[sid])).elements[0].person,'');
  assert.equal(await scalar('select children_prayer from public.mindex_sunday_calendar where id=$1',[cal]),'');
  const multi=await scalar('select public.save_calendar_assignee_v1($1)',[{
    ...batch,requestId:randomUUID(),expected:'',value:'batch value',requests:[{...first,requestId:randomUUID()},{...second,requestId:randomUUID(),expectedRevision:duplicate.committedRevision}]}]);
  assert.equal(multi.services.length,2);assert.ok(multi.services.every(x=>x.elements[0].person==='batch value'));
  // Single-service worship edits may not strand a duplicate service on a stale name.
  await assert.rejects(scalar('select public.save_worship_service_v1($1)',[save(multi.services.find(x=>x.service.id===sid).revision,'diverge')]),/DUPLICATE_DEPARTMENT_SERVICE_USE_CALENDAR/);
  const context=await scalar('select public.get_department_assignee_context_v1($1,$2)',[cal,'children_prayer']);assert.equal(context.services.length,2);
  await assert.rejects(scalar('select public.get_department_assignee_context_v1($1,$2)',[cal,'preacher']),/INVALID_DEPARTMENT_FIELD/);
  await assert.rejects(db.query('select * from mindex_atomic.calendar_link_receipts'),/permission denied/);
  // Two real connections race on the same roster and revision: exactly one commits.
  const a=await db.connect(),b=await db.connect();
  await a.query('set session authorization anon');await b.query('set session authorization anon');
  const raceRequest=value=>({...batch,requestId:randomUUID(),expected:'batch value',value,
    requests:multi.services.map(x=>({protocolVersion:1,requestId:randomUUID(),serviceId:x.service.id,expectedRevision:x.revision,
      metadataPatch:{},sectionPatches:[],elementPatches:[{id:x.elements[0].id,patch:{person:value}}],document:{sourceText:value}}))});
  const raced=await Promise.allSettled([a.query('select public.save_calendar_assignee_v1($1)',[raceRequest('winner A')]),b.query('select public.save_calendar_assignee_v1($1)',[raceRequest('winner B')])]);
  assert.equal(raced.filter(x=>x.status==='fulfilled').length,1);
  assert.match(raced.find(x=>x.status==='rejected').reason.message,/CALENDAR_REVISION_CONFLICT/);
  const afterRace=await scalar('select public.get_department_assignee_context_v1($1,$2)',[cal,'children_prayer']);
  assert.ok(afterRace.services.every(x=>x.elements[0].person===afterRace.calendar.children_prayer));
  // Exercise the other three mappings through both real RPC directions too.
  for (const [offset,kind,label,field] of [[1,'youth','대표기도','youth_prayer'],[2,'youth','봉헌기도','youth_offering_prayer'],[3,'young-adult','대표기도','young_adult_prayer']]) {
    const cid=randomUUID(),serviceId=randomUUID(),sectionId=randomUUID(),elementId=randomUUID(),date=`2026-11-0${offset}`;
    await db.exec('reset session authorization');
    await db.query(`insert into public.mindex_sunday_calendar(id,date,${field}) values($1,$2,'A')`,[cid,date]);
    await db.exec('set session authorization anon');
    await scalar('select public.create_worship_service_v1($1)',[{
      protocolVersion:1,requestId:randomUUID(),serviceId,serviceTypeId:kind,serviceDate:date,metadataPatch:{title:'fixture'},
      sections:[{id:sectionId,patch:{title:label}}],elements:[{id:elementId,sectionId,patch:{element_type:'plain_text',person:'A',source_ref:{label}}}],document:{sourceText:'A'}}]);
    const patch=(revision,value)=>({protocolVersion:1,requestId:randomUUID(),serviceId,expectedRevision:revision,
      metadataPatch:{},sectionPatches:[],elementPatches:[{id:elementId,patch:{person:value}}],document:{sourceText:value}});
    const one=await scalar('select public.save_worship_service_v1($1)',[patch('1','B')]);assert.equal(one.calendar[field],'B');
    const two=await scalar('select public.save_calendar_assignee_v1($1)',[{requestId:randomUUID(),calendarId:cid,field,expected:'B',value:'C',requests:[patch(one.committedRevision,'C')]}]);
    assert.equal(two.calendar[field],'C');assert.equal(two.services[0].elements[0].person,'C');
  }
  // Native rollout requires the protocol even when every element is plain text.
  await db.exec('reset session authorization');
  await db.exec(await load('../migrations/2026-10-24-single-song-store-candidate.sql'));
  await db.exec(await load('../migrations/2026-10-24-single-song-worship-candidate.sql'));
  await db.exec(await load('../migrations/2026-10-24-single-song-lifecycle-candidate.sql'));
  await db.exec(await load('../migrations/2026-10-24-single-song-rollout-candidate.sql'));
  await db.exec("update mindex_single_song.rollout set phase='native'");
  await db.exec('set session authorization anon');
  const nativeBefore=await scalar('select public.get_department_assignee_context_v1($1,$2)',[cal,'children_prayer']);
  assert.ok(nativeBefore.services.every(s=>s.elements.every(e=>!e.praise_record_id)));
  const nativeRequest={requestId:randomUUID(),calendarId:cal,field:'children_prayer',expected:nativeBefore.calendar.children_prayer,value:'native assignee',
    requests:nativeBefore.services.map(s=>({protocolVersion:1,requestId:randomUUID(),serviceId:s.service.id,expectedRevision:s.revision,
      metadataPatch:{},sectionPatches:[],elementPatches:[{id:s.elements[0].id,patch:{person:'native assignee'}}],document:{sourceText:'native assignee'}}))};
  await assert.rejects(scalar('select public.save_calendar_assignee_v1($1)',[nativeRequest]),/SINGLE_SONG_CLIENT_REQUIRED/);
  assert.deepEqual(await scalar('select public.get_department_assignee_context_v1($1,$2)',[cal,'children_prayer']),nativeBefore);
  for(const request of nativeRequest.requests)request.singleSongProtocol=1;
  const nativeSaved=await scalar('select public.save_calendar_assignee_v1($1)',[nativeRequest]);
  assert.equal(nativeSaved.calendar.children_prayer,'native assignee');
  assert.ok(nativeSaved.services.every(s=>s.elements[0].person==='native assignee'));
  assert.equal((await scalar('select public.save_calendar_assignee_v1($1)',[nativeRequest])).replayed,true);
  for(const after of nativeSaved.services){
    const before=nativeBefore.services.find(s=>s.service.id===after.service.id);
    assert.deepEqual(after.sections,before.sections);
    for(const element of after.elements){const original=before.elements.find(e=>e.id===element.id);const strip=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['person','updated_at'].includes(k)));assert.deepEqual(strip(element),strip(original));}
  }
  console.log('PASS native calendar without praise links: missing flag rejected atomically, explicit protocol accepted, exact replay and element content preserved');
  console.log('PASS department bidirectional commit, exact retry, stale/changed replay rejection, rollback, legacy bypass guard and explicit clear');
} finally {await db.close();}
