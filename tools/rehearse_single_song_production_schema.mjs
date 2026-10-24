// User-provided catalog metadata only; isolated DB, never a production connection.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openWorshipTestDb} from '../tests/helpers/worship-test-db.mjs';
const [schemaPath,catalogPath,supplementPath]=process.argv.slice(2);
const supplement=supplementPath?JSON.parse(await fs.readFile(supplementPath,"utf8")):null;
if(!schemaPath||!catalogPath)throw Error('Explicit private schema and catalog required');
const schema=JSON.parse(await fs.readFile(schemaPath,'utf8')), records=JSON.parse(await fs.readFile(catalogPath,'utf8'));
const db=await openWorshipTestDb({requirePostgres:true});
const q=s=>'"'+s.replaceAll('"','""')+'"',fq=(s,n)=>q(s)+'.'+q(n);
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const load=p=>fs.readFile(new URL(p,import.meta.url),'utf8');
function grants(acl,target){
 const statements=[];
 for(const item of (acl||'{}').slice(1,-1).split(',').filter(Boolean)){
  const [left]=item.split('/');const [role,rights]=left.split('=');
  const map=target.startsWith('function')?{X:'execute'}:{r:'select',a:'insert',w:'update',d:'delete',D:'truncate',x:'references',t:'trigger',m:'maintain'};
  const permissions=[...rights].filter(c=>map[c]).map(c=>map[c]);
  if(permissions.length)statements.push(`grant ${permissions.join(',')} on ${target} to ${role?q(role):'public'}`);
 }return statements;
}
try{
 await db.exec('set check_function_bodies=off');
 for(const r of schema.roles)await db.exec(`create role ${q(r.name)} nologin ${r.inherit?'inherit':'noinherit'} ${r.bypass_rls?'bypassrls':'nobypassrls'}`);
 for(const s of schema.schemas)if(s.name!=='public')await db.exec(`create schema ${q(s.name)}`);
 for(const t of schema.tables){
  const cols=schema.columns.filter(c=>c.schema===t.schema&&c.table===t.name).sort((a,b)=>a.position-b.position);
  await db.exec(`create table ${fq(t.schema,t.name)} (${cols.map(c=>q(c.name)+' '+c.type+(c.not_null?' not null':'')).join(',')})`);
 }
 await db.exec('create table public.mindex_sunday_calendar(id uuid primary key,date date,children_prayer text,youth_prayer text,youth_offering_prayer text,young_adult_prayer text)');
 // External unchanged dependencies need only UUID fixtures for this migration scope.
 for(const name of ['mindex_song_units','mindex_scriptures'])await db.exec(`create table public.${name}(id uuid primary key)`);

 for(const c of schema.constraints.filter(c=>!c.definition.startsWith('FOREIGN KEY')))
  await db.exec(`alter table ${fq(c.schema,c.table)} add constraint ${q(c.name)} ${c.definition}`);
 for(const c of schema.constraints.filter(c=>c.definition.startsWith('FOREIGN KEY')))
  await db.exec(`alter table ${fq(c.schema,c.table)} add constraint ${q(c.name)} ${c.definition}`);
 for(const f of schema.functions)await db.exec(f.definition);
 if(supplement){
  for(const f of supplement.public_functions)await db.exec(f.definition);
  for(const t of supplement.triggers)await db.exec(t.function_definition);
  for(const t of supplement.triggers){assert.equal(t.enabled,'O');await db.exec(t.definition);}
  assert(supplement.held_history_refs.every(r=>r.history===0&&r.checkpoints===0));
 }

 for(const c of schema.columns.filter(c=>c.default))await db.exec(`alter table ${fq(c.schema,c.table)} alter column ${q(c.name)} set default ${c.default}`);
 for(const t of schema.tables){
  await db.exec(`alter table ${fq(t.schema,t.name)} ${t.rls?'enable':'disable'} row level security`);
  if(t.force_rls)await db.exec(`alter table ${fq(t.schema,t.name)} force row level security`);
  await db.exec(`revoke all on ${fq(t.schema,t.name)} from public`);
  for(const sql of grants(t.acl,'table '+fq(t.schema,t.name)))await db.exec(sql);
 }
 for(const p of schema.policies)await db.exec(`create policy ${q(p.policyname)} on ${fq(p.schemaname,p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'public':q(r)).join(',')} ${p.qual?'using ('+p.qual+')':''} ${p.with_check?'with check ('+p.with_check+')':''}`);
 for(const s of schema.schemas){
  await db.exec(`revoke all on schema ${q(s.name)} from public`);
  for(const item of (s.acl||'{}').slice(1,-1).split(',').filter(Boolean)){
   const [role,rights]=item.split('/')[0].split('=');const ps=[...(rights||'')].map(x=>({U:'usage',C:'create'}[x])).filter(Boolean);
   if(ps.length)await db.exec(`grant ${ps.join(',')} on schema ${q(s.name)} to ${role?q(role):'public'}`);
  }
 }
 for(const f of schema.functions){
  const target='function '+fq(f.schema,f.name)+'('+f.arguments+')';
  await db.exec(`alter ${target} owner to ${q(f.owner)}`);await db.exec(`revoke all on ${target} from public`);
  for(const sql of grants(f.acl,target))await db.exec(sql);
 }
 await db.exec(await load('../migrations/2026-10-24-single-song-store-candidate.sql'));
 await db.query("insert into mindex_single_song.records select r->>'id',(r->>'revision')::bigint,r from jsonb_array_elements($1::jsonb) r",[JSON.stringify(records)]);
 await db.exec(await load('../migrations/2026-10-24-single-song-worship-candidate.sql'));
 await db.exec(await load('../migrations/2026-10-24-single-song-lifecycle-candidate.sql'));
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+q(role));
  await assert.rejects(db.query('select public.get_single_praise_records_v1($1)',[[records[0].id]]),/permission denied/);
  await assert.rejects(db.query('select * from mindex_single_song.records'),/permission denied/);
  await db.exec('reset role');
 }
 // Proposed RPC grants tested locally only, not installed in production.
 await db.exec('grant execute on function public.get_single_praise_records_v1(text[]),public.save_single_praise_record_v1(jsonb),public.mutate_single_praise_v1(jsonb) to anon,authenticated');
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+q(role));
  const row=(await scalar('select public.get_single_praise_records_v1($1)',[[records[0].id]]))[0];assert.deepEqual(row,records[0]);
  const r=await scalar('select public.mutate_single_praise_v1($1)',[{protocolVersion:1,requestId:randomUUID(),operation:'create',prefix:'ccm',metadata:{title:'local-only'},content:{forms:[]}}]);
  assert(r.id);
  await db.exec('reset role');
  const cols=schema.columns.filter(c=>c.schema==='mindex_atomic'&&c.table==='revision_history');
  if(cols.length){
   await db.query('insert into mindex_atomic.revision_history(service_id,revision,aggregate) values($1,1,$2)',[randomUUID(),{elements:[{praise_record_id:r.id}]}]);
   await db.exec('set role '+q(role));
   await assert.rejects(db.query('select public.mutate_single_praise_v1($1)',[{protocolVersion:1,requestId:randomUUID(),operation:'delete',id:r.id,expectedRevisions:{[r.id]:1}}]),/IN_USE/);
  } else await db.exec('set role '+q(role));
  await assert.rejects(db.query('select * from mindex_single_song.records'),/permission denied/);
  await db.exec('reset role');
 }
 // Exercise real production journal/slot/source-preservation triggers through atomic RPC.
 await db.query("insert into public.mindex_worship_service_types(id,display_name,sort_order) values('fixture','fixture',999)");
 const sid=randomUUID(),section=randomUUID(),element=randomUUID();
 const create={protocolVersion:1,singleSongProtocol:1,serviceId:sid,requestId:randomUUID(),serviceTypeId:'fixture',serviceDate:'2026-10-24',metadataPatch:{title:'native fixture'},
   sections:[{id:section,patch:{title:'찬양'}}],elements:[{id:element,sectionId:section,patch:{element_type:'praise',praise_record_id:'knh-361',body:'saved body',config:{audioTiming:{starts:[0,4]},formHint:'V1-Coda'}}}],
   document:{sourceText:'[찬양]\n- 곡 ID: knh-361',sourceRecords:[{elementId:element,linkedSource:{songId:'knh-361'}}]}};
 const oldCreate={...create};delete oldCreate.singleSongProtocol;
 await db.exec('set role anon');
 await assert.rejects(scalar('select create_worship_service_v1($1)',[oldCreate]),/SINGLE_SONG_CLIENT_REQUIRED/);
 await scalar('select create_worship_service_v1($1)',[create]);
 const read=()=>scalar('select get_worship_service_v1($1)',[sid]);
 const before=await read();assert.equal(before.elements[0].praise_record_id,'knh-361');
 const req={protocolVersion:1,singleSongProtocol:1,serviceId:sid,requestId:randomUUID(),expectedRevision:before.revision,metadataPatch:{title:'saved'},elementPatches:[{id:element,patch:{sort_order:2}}],document:create.document};
 const old={...req};delete old.singleSongProtocol;
 await assert.rejects(scalar('select save_worship_service_v1($1)',[old]),/SINGLE_SONG_CLIENT_REQUIRED/);
 await scalar('select save_worship_service_v1($1)',[req]);const after=await read();
 assert.deepEqual(after.elements[0].config,before.elements[0].config);assert.equal(after.elements[0].body,'saved body');
 await db.exec('reset role');
 assert(await scalar('select count(*)::int from mindex_atomic.revision_history where service_id=$1',[sid])>=2);
 const restore={protocolVersion:1,serviceId:sid,requestId:randomUUID(),expectedRevision:after.revision,checkpointRevision:before.revision,confirmRestore:true};
 await assert.rejects(scalar('select mindex_atomic.restore_revision($1)',[restore]),/SINGLE_SONG_CLIENT_REQUIRED/);
 await scalar('select mindex_atomic.restore_revision($1)',[{...restore,singleSongProtocol:1}]);
 assert.deepEqual((await read()).elements[0].config,before.elements[0].config);
 console.log(JSON.stringify({status:'PASS',productionVersion:schema.server_version,reproducedFunctions:schema.functions.length,policies:schema.policies.length,tables:schema.tables.length,records:records.length,productionWrites:0,triggers:supplement?.triggers.length||0,heldHistoryReferences:0,atomicRoundtrip:true,limitations:['external scripture/song-unit/calendar dependencies use scoped fixtures; department calendar branch not exercised','local PostgreSQL18 versus production17']}));
}finally{await db.close()}
