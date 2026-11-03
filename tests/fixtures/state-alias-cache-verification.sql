-- Explicit opt-in admin verification. No worship/lyric row mutations; always rollback.
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
 if has_table_privilege('anon','mindex_single_song.state_id_alias_cache','SELECT')
 or has_table_privilege('authenticated','mindex_single_song.state_id_alias_cache','SELECT')
 then raise exception 'ALIAS_CACHE_EXPOSED'; end if;
end $check$;
rollback;
