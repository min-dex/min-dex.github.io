-- Apply only after compatible app publication and full CAS normalization/readback.
-- No record, lyric, audio, identity, relation or worship data is rewritten here.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(1296649822,0);
alter table mindex_single_song.records add constraint praise_classification_single_owner check (
  not ((payload->'metadata') ? 'praise_types')
  and jsonb_typeof(payload->'content'->'praise_types') = 'array'
  and jsonb_array_length(payload->'content'->'praise_types') > 0
  and (payload->'content'->'praise_types') <@ '["hymn","ccm"]'::jsonb
  and (payload->'content') ? 'praise_types'
);
commit;
