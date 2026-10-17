-- Applied with user authorization on 2026-10-17; not part of Cloud setup.
-- Version-owned audio URL + SHA-256 + lyric/form fingerprint + page cues.
-- No existing song, lyric, form, worship, ACL or Storage policy is rewritten.
begin;
alter table public.mindex_song_versions add column if not exists audio_set jsonb;
comment on column public.mindex_song_versions.audio_set is
  'Optional children-version audio/timing attachment; only children_audio mode applies it. Audio bytes live in existing media Storage.';
commit;
notify pgrst, 'reload schema';
