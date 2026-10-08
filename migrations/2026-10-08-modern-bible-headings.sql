-- Modern Korean Bible only. Verified against the supplied EasySlides XML.
-- 2,428 leading square-bracket headings; existing eight headings stay unchanged.
-- Stores complete before-images privately. A mismatch aborts the transaction.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.mindex_bible_translations in share mode;
lock table public.mindex_bible_verses in share row exclusive mode;
create schema if not exists mindex_maintenance;
revoke all on schema mindex_maintenance from public, anon, authenticated;
create table if not exists mindex_maintenance.modern_bible_headings_20261008 (
  verse_id uuid primary key,
  original_row jsonb not null,
  captured_at timestamptz not null default now()
);
revoke all on mindex_maintenance.modern_bible_headings_20261008
  from public, anon, authenticated;

do $repair$
declare
  tid uuid;
  row_count integer;
  source_hash text;
  expected_hash constant text := '133cb99aacef492ea1a2064299c39a6d';
begin
  select id into strict tid from public.mindex_bible_translations
    where translation_key='현대어' and name='현대어' and is_active;

  if not exists(select from mindex_maintenance.modern_bible_headings_20261008) then
    select count(*), md5(string_agg(
      book_code || ':' || chapter || ':' || verse || ':' || md5(text), E'\n'
      order by book_code collate "C", chapter, verse))
    into row_count, source_hash
    from public.mindex_bible_verses
    where translation_id=tid and is_active and left(text,1)='[' and section_title='';
    if row_count<>2428 or source_hash is distinct from expected_hash then
      raise exception 'MODERN_HEADING_SOURCE_MISMATCH';
    end if;
    insert into mindex_maintenance.modern_bible_headings_20261008(verse_id, original_row)
      select id,to_jsonb(v) from public.mindex_bible_verses v
      where translation_id=tid and is_active and left(text,1)='[' and section_title='';
  end if;

  -- Also validate saved evidence on retries; never replace the original backup.
  select count(*), md5(string_agg(
    (original_row->>'book_code') || ':' || (original_row->>'chapter') || ':' ||
    (original_row->>'verse') || ':' || md5(original_row->>'text'), E'\n'
    order by (original_row->>'book_code') collate "C",
      (original_row->>'chapter')::int, (original_row->>'verse')::int))
  into row_count, source_hash from mindex_maintenance.modern_bible_headings_20261008;
  if row_count<>2428 or source_hash is distinct from expected_hash
    or exists(select from mindex_maintenance.modern_bible_headings_20261008
      where original_row->>'translation_id' is distinct from tid::text
        or original_row->>'id' is distinct from verse_id::text
        or original_row->>'section_title' is distinct from ''
        or original_row->>'is_active' is distinct from 'true') then
    raise exception 'MODERN_HEADING_BACKUP_MISMATCH';
  end if;
end
$repair$;

create temporary table modern_heading_expected on commit drop as
select verse_id,original_row,
  regexp_replace(substring(original_row->>'text' from 2
    for strpos(original_row->>'text',']')-2), '^\s+|\s+$', '', 'g') as heading,
  regexp_replace(substring(original_row->>'text' from
    strpos(original_row->>'text',']')+1), '^\s+|\s+$', '', 'g') as body
from mindex_maintenance.modern_bible_headings_20261008;

do $check$
begin
  if exists(select from modern_heading_expected where heading='' or body='') then
    raise exception 'MODERN_HEADING_EMPTY_RESULT';
  end if;
  if exists(select from modern_heading_expected e
    left join public.mindex_bible_verses v on v.id=e.verse_id
    where v.id is null or (
      to_jsonb(v) is distinct from e.original_row and
      to_jsonb(v) is distinct from (e.original_row || jsonb_build_object(
        'text',e.body,'section_title',e.heading)))) then
    raise exception 'MODERN_HEADING_CURRENT_ROW_CHANGED';
  end if;
end
$check$;

update public.mindex_bible_verses v set text=e.body,section_title=e.heading
from modern_heading_expected e
where v.id=e.verse_id and to_jsonb(v)=e.original_row;

do $verify$
begin
  if exists(select from modern_heading_expected e
    left join public.mindex_bible_verses v on v.id=e.verse_id
    where to_jsonb(v) is distinct from (e.original_row || jsonb_build_object(
      'text',e.body,'section_title',e.heading))) then
    raise exception 'MODERN_HEADING_POSTCHECK_FAILED';
  end if;
end
$verify$;
commit;

select 'modern_bible_headings_installed' as status,
  (select count(*) from mindex_maintenance.modern_bible_headings_20261008) as backed_up,
  count(*) filter(where v.section_title<>'') as verses_with_headings
from public.mindex_bible_verses v join public.mindex_bible_translations t on t.id=v.translation_id
where t.translation_key='현대어' and v.is_active;
