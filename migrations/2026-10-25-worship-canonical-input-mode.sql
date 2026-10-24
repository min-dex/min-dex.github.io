-- Apply before publishing the canonical input-mode writer.
-- Constraint-only: no UPDATE/DELETE of worship content, drafts or revisions.
-- Legacy praise_db remains readable until existing records are explicitly saved.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.mindex_worship_elements
  drop constraint if exists mindex_worship_elements_input_mode_check;
alter table public.mindex_worship_elements
  add constraint mindex_worship_elements_input_mode_check
  check (input_mode in ('', 'praise_db', 'lyrics_db', 'score_db', 'children_audio',
    'manual_praise', 'audio_praise', 'text', 'scripture', 'asset', 'config', 'none'));
commit;
