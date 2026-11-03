-- Private derived alias index: retain legacy-ID rejection without reading lyric payloads per draft write.
begin;
set local lock_timeout='2s';
lock table mindex_single_song.records in share row exclusive mode;
create table if not exists mindex_single_song.state_id_alias_cache (
 alias text not null, record_id text not null, primary key(alias,record_id)
);
alter table mindex_single_song.state_id_alias_cache enable row level security;
revoke all on mindex_single_song.state_id_alias_cache from public,anon,authenticated;
-- The existing song RPC owner can already read source records and execute the
-- mapping. Give it only the equivalent derived read; never public table access.
do $writer$
begin
 if not has_table_privilege('mindex_single_writer','mindex_single_song.records','SELECT')
 or not has_function_privilege('mindex_single_writer','mindex_single_song.id_alias_mapping()','EXECUTE')
 then raise exception 'EXISTING_WRITER_AUTHORITY_REQUIRED'; end if;
 if not exists(select from pg_policy where polrelid='mindex_single_song.state_id_alias_cache'::regclass
   and polname='state_alias_writer_read') then
  execute 'create policy state_alias_writer_read on mindex_single_song.state_id_alias_cache for select to mindex_single_writer using(true)';
 end if;
end $writer$;
grant select on mindex_single_song.state_id_alias_cache to mindex_single_writer;
delete from mindex_single_song.state_id_alias_cache;
insert into mindex_single_song.state_id_alias_cache
 select distinct a,r.id from mindex_single_song.records r
 cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a;
create or replace function mindex_single_song.sync_state_id_alias_cache() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $sync$
begin
 if tg_op<>'INSERT' then
  delete from mindex_single_song.state_id_alias_cache where record_id=old.id;
 end if;
 if tg_op<>'DELETE' then
  insert into mindex_single_song.state_id_alias_cache
   select distinct a,new.id from jsonb_array_elements_text(coalesce(new.payload->'previousIds','[]'::jsonb)) a;
 end if;
 return null;
end $sync$;
revoke all on function mindex_single_song.sync_state_id_alias_cache() from public,anon,authenticated;
drop trigger if exists sync_state_id_alias_cache on mindex_single_song.records;
create trigger sync_state_id_alias_cache after insert or delete or update of id,payload
 on mindex_single_song.records for each row execute function mindex_single_song.sync_state_id_alias_cache();
do $patch$
declare definition text;
 original text:='select from jsonb_object_keys(mindex_single_song.id_alias_mapping()) k where strpos(p_key,k)>0 or strpos(coalesce(p_value,''''),k)>0';
 replacement text:='select from mindex_single_song.state_id_alias_cache c where strpos(p_key,c.alias)>0 or strpos(coalesce(p_value,''''),c.alias)>0';
begin
 select pg_get_functiondef('public.mindex_state_write_v1(text,text,text,text,text,uuid)'::regprocedure) into definition;
 if strpos(definition,original)>0 then execute replace(definition,original,replacement);
 elsif strpos(definition,replacement)=0 then raise exception 'STATE_ALIAS_GUARD_NOT_RECOGNIZED'; end if;
 if exists(
  (select jsonb_object_keys(mindex_single_song.id_alias_mapping()) except select alias from mindex_single_song.state_id_alias_cache)
  union all
  (select alias from mindex_single_song.state_id_alias_cache except select jsonb_object_keys(mindex_single_song.id_alias_mapping()))
 ) then raise exception 'ALIAS_CACHE_MISMATCH'; end if;
end $patch$;
-- Other existing persistence guards also use this mapping. Keep its API and
-- privileges unchanged while removing the same payload scan for those callers.
do $verify$
declare prior jsonb;
begin
 prior:=mindex_single_song.id_alias_mapping();
 execute 'create or replace function mindex_single_song.id_alias_mapping() returns jsonb language sql stable set search_path=pg_catalog as $body$ select coalesce(jsonb_object_agg(alias,record_id),''{}''::jsonb) from mindex_single_song.state_id_alias_cache $body$';
 if prior is distinct from mindex_single_song.id_alias_mapping() then
  raise exception 'ALIAS_MAPPING_PARITY_FAILED';
 end if;
end $verify$;
commit;
