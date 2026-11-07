create function mindex_atomic.require_current_praise_ids(req jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $fn$
begin
 if jsonb_typeof(req) is distinct from 'object' or octet_length(req::text)>4194304 then
  raise exception 'INVALID_REQUEST';
 end if;
 -- Only returns acceptance/rejection; never exposes catalogue payloads or maps.
 if exists(select from mindex_single_song.records r
   cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a
   where strpos(req::text,a)>0) then
  raise exception 'PRAISE_ID_CHANGED_RELOAD_REQUIRED';
 end if;
end $fn$;
alter function mindex_atomic.require_current_praise_ids(jsonb) owner to postgres;
revoke all on function mindex_atomic.require_current_praise_ids(jsonb) from public,anon,authenticated;
grant execute on function mindex_atomic.require_current_praise_ids(jsonb) to mindex_atomic_writer;
