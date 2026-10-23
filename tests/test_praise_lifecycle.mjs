import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID as uuid} from 'node:crypto';
import {openWorshipTestDb} from './helpers/worship-test-db.mjs';
const db=await openWorshipTestDb();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
try{
 await db.exec('create role anon; create role authenticated;');
 const schema=await fs.readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8');
 await db.exec(schema.slice(schema.indexOf('create table if not exists public.mindex_songs'),schema.indexOf('-- Promote song-level')));
 await db.exec('alter table mindex_canonical_songs alter column source_count drop default; alter table mindex_song_versions alter column source_count drop default; alter table mindex_song_versions add column audio_set jsonb; create table mindex_worship_elements(id uuid primary key,song_id uuid references mindex_songs on delete set null,song_version_id uuid references mindex_song_versions on delete set null)');
 for(const path of ['2026-10-23-praise-atomic-save.sql','2026-10-23-praise-lifecycle.sql'])await db.exec(await fs.readFile(new URL('../migrations/'+path,import.meta.url),'utf8'));
 const req=(title='새 찬양')=>({protocolVersion:1,requestId:uuid(),songId:uuid(),versionId:uuid(),title,praiseTypes:['ccm'],autoTitle:false,reuseExisting:false});
 const create=r=>scalar('select create_praise_v1($1)',[r]);
 const read=id=>scalar('select get_praise_snapshot_v1($1)',[id]);
 const del=r=>scalar('select delete_empty_praise_v1($1)',[r]);
 const deletion=async id=>({protocolVersion:1,requestId:uuid(),songId:id,expected:await read(id)});
 const a=req(),first=await create(a);assert.equal(first.snapshot.versions.length,1);assert.equal((await create(a)).replayed,true);
 await assert.rejects(create({...a,title:'changed'}),/PRAISE_REQUEST_REUSED/);
 // A version insert failure must leave no song or canonical row/receipt behind.
 const fail=req('rollback');fail.versionId=a.versionId;await assert.rejects(create(fail));
 assert.equal((await read(fail.songId)).song,null);assert.equal(await scalar('select count(*)::int from mindex_praise_operations where request_id=$1',[fail.requestId]),0);
 // Two clients create the same service title concurrently, one shared result.
 const x={...req('동시 등록'),reuseExisting:true},y={...req('동시 등록'),reuseExisting:true};
 if(db.connect){const c1=await db.connect(),c2=await db.connect();const out=await Promise.all([c1.query('select create_praise_v1($1) r',[x]),c2.query('select create_praise_v1($1) r',[y])]);assert.equal(out[0].rows[0].r.snapshot.song.id,out[1].rows[0].r.snapshot.song.id);}
 else {assert.equal((await create(x)).snapshot.song.id,(await create(y)).snapshot.song.id);}
 const deletionA=await deletion(a.songId);
 await db.query('update mindex_songs set title=$1 where id=$2',['remote changed',a.songId]);await assert.rejects(del(deletionA),/PRAISE_CONFLICT/);
 let d=await deletion(a.songId);
 await db.query('insert into mindex_worship_elements values($1,$2,$3)',[uuid(),a.songId,a.versionId]);
 await assert.rejects(del(d),/PRAISE_IN_USE/);assert.equal(await scalar('select count(*)::int from mindex_worship_elements where song_id=$1 and song_version_id=$2',[a.songId,a.versionId]),1);
 const audio=req('audio');await create(audio);await db.query('update mindex_song_versions set audio_set=$1 where id=$2',[{url:'keep',timing:[1,2]},audio.versionId]);await assert.rejects(del(await deletion(audio.songId)),/PRAISE_NOT_EMPTY/);
 const metadata=req('metadata');await create(metadata);await db.query('update mindex_songs set memo=$1 where id=$2',['{"unknown":"keep"}',metadata.songId]);await assert.rejects(del(await deletion(metadata.songId)),/PRAISE_NOT_EMPTY/);
 const lyrics=req('lyrics');await create(lyrics);await db.query("insert into mindex_version_units(id,version_id,canonical_song_id,unit_order,unit_label,unit_kind,trigger,text) values($1,$2,$3,1,'Verse','verse','','keep lyrics')",[uuid(),lyrics.versionId,lyrics.songId]);await assert.rejects(del(await deletion(lyrics.songId)),/PRAISE_NOT_EMPTY/);
 const empty=req('empty');await create(empty);d=await deletion(empty.songId);assert.equal((await del(d)).deleted,true);assert.equal((await del(d)).replayed,true);await assert.rejects(create(empty),/PRAISE_CREATED_THEN_REMOVED/);assert.equal((await read(empty.songId)).song,null);
 // Late receipt failure rolls back even the completed DELETE cascade.
 const rollback=req('delete rollback');await create(rollback);d=await deletion(rollback.songId);await db.exec("create function fail_delete_receipt() returns trigger language plpgsql as $$begin if new.operation='delete' then raise exception 'receipt failure'; end if; return new; end$$; create trigger fail_receipt before insert on mindex_praise_operations for each row execute function fail_delete_receipt()");await assert.rejects(del(d),/receipt failure/);assert.deepEqual(await read(rollback.songId),d.expected);
 await db.exec('drop trigger fail_receipt on mindex_praise_operations; drop function fail_delete_receipt(); grant usage on schema public to anon; grant select,insert,update,delete on mindex_songs,mindex_canonical_songs,mindex_song_versions,mindex_version_units,mindex_song_relations,mindex_worship_elements to anon; set role anon');
 const roleRequest=req('shared role');await create(roleRequest);assert.equal((await del(await deletion(roleRequest.songId))).deleted,true);
 await assert.rejects(db.exec('delete from mindex_praise_operations'),/permission denied/);await db.exec('reset role');
 console.log('PASS atomic creation rollback, concurrent title reuse, replay/no resurrection, stale/linked/media/lyrics/metadata deletion guards and delete rollback');
}finally{await db.close();}
