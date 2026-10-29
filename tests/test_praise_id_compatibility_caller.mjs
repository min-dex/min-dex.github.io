import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openWorshipTestDb } from './helpers/worship-test-db.mjs';

// Disposable database only; never grant these privileges in production.
const db = await openWorshipTestDb({ requirePostgres: true });
try {
  const source = await fs.readFile(new URL('../tools/build_praise_id_compatibility.py', import.meta.url), 'utf8');
  const guard = source.match(/do \$caller_guard\$[\s\S]*?end \$caller_guard\$;/)[0];
  assert.ok(source.indexOf(guard) < source.indexOf('create or replace function mindex_single_song.id_alias_mapping'));
  await db.exec('create role mindex_atomic_writer; create schema mindex_single_song; create table mindex_single_song.records(id text);');
  await assert.rejects(db.exec(guard), /REKEY_ATOMIC_CALLER_COMPATIBILITY_NOT_READY/);
  await db.exec('grant usage on schema mindex_single_song to mindex_atomic_writer');
  await assert.rejects(db.exec(guard), /REKEY_ATOMIC_CALLER_COMPATIBILITY_NOT_READY/);
  await db.exec('grant select on mindex_single_song.records to mindex_atomic_writer');
  await db.exec(guard);
  console.log('Compatibility caller guard: denied missing schema/table access; no implicit grants.');
} finally {
  await db.close();
}
