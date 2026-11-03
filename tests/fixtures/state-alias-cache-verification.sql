-- Explicit opt-in admin verification. No existing worship/lyric row mutations; always rollback.
begin;
create temp table alias_sync_fixture(id text,payload jsonb) on commit drop;
create trigger fixture_alias_sync after insert or update or delete on alias_sync_fixture
 for each row execute function mindex_single_song.sync_state_id_alias_cache();
insert into alias_sync_fixture values('QA-FIXTURE','{"previousIds":["QA-OLD"]}');
do $check$ begin
 if not exists(select from mindex_single_song.state_id_alias_cache where record_id='QA-FIXTURE' and alias='QA-OLD')
 then raise exception 'INSERT_SYNC_FAILED'; end if;
end $check$;
update alias_sync_fixture set payload='{"previousIds":["QA-NEW"]}';
do $check$ begin
 if exists(select from mindex_single_song.state_id_alias_cache where alias='QA-OLD')
 or not exists(select from mindex_single_song.state_id_alias_cache where record_id='QA-FIXTURE' and alias='QA-NEW')
 then raise exception 'UPDATE_SYNC_FAILED'; end if;
end $check$;
delete from alias_sync_fixture;
do $check$ begin
 if exists(select from mindex_single_song.state_id_alias_cache where record_id='QA-FIXTURE')
 then raise exception 'DELETE_SYNC_FAILED'; end if;
 if (select coalesce(jsonb_object_agg(a,r.id),'{}'::jsonb) from mindex_single_song.records r
 cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a)
 is distinct from mindex_single_song.id_alias_mapping()
 then raise exception 'ALIAS_MAPPING_PARITY_FAILED'; end if;
 if not has_table_privilege('mindex_single_writer','mindex_single_song.state_id_alias_cache','SELECT')
 then raise exception 'WRITER_ALIAS_READ_MISSING'; end if;
 if has_table_privilege('anon','mindex_single_song.state_id_alias_cache','SELECT')
 or has_table_privilege('authenticated','mindex_single_song.state_id_alias_cache','SELECT')
 then raise exception 'ALIAS_CACHE_EXPOSED'; end if;
end $check$;
-- Exercise the same SECURITY DEFINER RPC owner as the real client. The fixture
-- and allocation/receipt changes remain inside this transaction and roll back.
do $rpc$
declare created jsonb; record_value jsonb; saved jsonb; loaded jsonb; test_id text;
begin
 created:=public.mutate_single_praise_v1(jsonb_build_object(
  'protocolVersion',1,'requestId',gen_random_uuid(),'operation','create','prefix','SONG-CONT',
  'metadata',jsonb_build_object('title','[TEST] alias cache rollback'),
  'content',jsonb_build_object('forms','[]'::jsonb,'praise_types',jsonb_build_array('ccm'))));
 record_value:=created->'records'->0;test_id:=record_value->>'id';
 if test_id is null then raise exception 'CREATE_RECEIPT_MISSING'; end if;
 record_value:=jsonb_set(record_value,'{metadata,title}',to_jsonb('[TEST] alias cache rollback updated'::text));
 saved:=public.save_single_praise_record_v1(jsonb_build_object(
  'protocolVersion',1,'requestId',gen_random_uuid(),
  'expectedRevision',(record_value->>'revision')::bigint,'record',record_value));
 loaded:=public.get_single_praise_records_v1(array[test_id]);
 if loaded->0->>'id' is distinct from test_id
 or loaded->0->'metadata'->>'title' is distinct from '[TEST] alias cache rollback updated'
 or loaded->0->>'revision' is distinct from '2'
 then raise exception 'SAVE_READBACK_MISMATCH'; end if;
end $rpc$;
rollback;
