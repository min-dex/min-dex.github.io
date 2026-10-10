-- Reviewed Psalm superscriptions only: easy 5, woori 115, bareun 112, common 4.
-- Entire DO block is atomic; no temporary tables or session affinity required.
-- Preserve existing headings and all original columns in a private before-image.
do $repair$
declare
  spec record; item record; tid uuid; n integer; digest text;
  heading text; body text; prefix text; current_row jsonb; expected_row jsonb;
begin
  perform set_config('lock_timeout','5s',true);
  lock table public.mindex_bible_translations in share mode;
  lock table public.mindex_bible_verses in share row exclusive mode;
  create schema if not exists mindex_maintenance;
  revoke all on schema mindex_maintenance from public, anon, authenticated;
  create table if not exists mindex_maintenance.bible_psalm_headings_20261010 (
    verse_id uuid primary key, translation_key text not null,
    original_row jsonb not null, captured_at timestamptz not null default now()
  );
  revoke all on mindex_maintenance.bible_psalm_headings_20261010 from public, anon, authenticated;

  for spec in select * from (values
    ('쉬운성경',5,'3212b4c02f4bce1413e5175347a71518'),
    ('우리말',115,'e96bc1d4eb9e449baf70b5f3c4e21560'),
    ('바른성경',112,'634ccd942109d83136ced8651eed019e'),
    ('공동번역',4,'c987408446767e92da8c51b7391fb899')
  ) as manifest(translation_key,expected_count,expected_hash)
  loop
    select id into strict tid from public.mindex_bible_translations
      where translation_key=spec.translation_key and name=spec.translation_key and is_active;
    if not exists(select from mindex_maintenance.bible_psalm_headings_20261010 b
      where b.translation_key=spec.translation_key) then
      select count(*),md5(string_agg(book_code||':'||chapter||':'||verse||':'||
        md5(text)||':'||md5(section_title),E'\n' order by book_code collate "C",chapter,verse))
      into n,digest from public.mindex_bible_verses
      where translation_id=tid and is_active and book_code='PSA' and verse=1 and left(text,1)='[';
      if n<>spec.expected_count or digest is distinct from spec.expected_hash then
        raise exception 'PSALM_HEADING_SOURCE_MISMATCH: %',spec.translation_key;
      end if;
      insert into mindex_maintenance.bible_psalm_headings_20261010(verse_id,translation_key,original_row)
        select id,spec.translation_key,to_jsonb(v) from public.mindex_bible_verses v
        where translation_id=tid and is_active and book_code='PSA' and verse=1 and left(text,1)='[';
    end if;

    select count(*),md5(string_agg((original_row->>'book_code')||':'||
      (original_row->>'chapter')||':'||(original_row->>'verse')||':'||
      md5(original_row->>'text')||':'||md5(original_row->>'section_title'),E'\n'
      order by (original_row->>'book_code') collate "C",(original_row->>'chapter')::int,
      (original_row->>'verse')::int)) into n,digest
    from mindex_maintenance.bible_psalm_headings_20261010 b where b.translation_key=spec.translation_key;
    if n<>spec.expected_count or digest is distinct from spec.expected_hash
      or exists(select from mindex_maintenance.bible_psalm_headings_20261010 b
        where b.translation_key=spec.translation_key and (
          original_row->>'translation_id' is distinct from tid::text
          or original_row->>'id' is distinct from verse_id::text
          or original_row->>'is_active' is distinct from 'true')) then
      raise exception 'PSALM_HEADING_BACKUP_MISMATCH: %',spec.translation_key;
    end if;

    for item in select * from mindex_maintenance.bible_psalm_headings_20261010 b
      where b.translation_key=spec.translation_key
    loop
      prefix := btrim(substring(item.original_row->>'text' from 2
        for strpos(item.original_row->>'text',']')-2));
      body := regexp_replace(substring(item.original_row->>'text'
        from strpos(item.original_row->>'text',']')+1),'^\s+|\s+$','','g');
      heading := concat_ws(' · ',nullif(item.original_row->>'section_title',''),prefix);
      -- Easy Bible's five book labels precede another angle-bracket heading.
      if spec.translation_key='쉬운성경' then
        if left(body,1)<>'<' or strpos(body,'>')<3 then
          raise exception 'PSALM_HEADING_MISSING_EASY_TITLE';
        end if;
        heading := heading || ' · ' || btrim(substring(body from 2 for strpos(body,'>')-2));
        body := regexp_replace(substring(body from strpos(body,'>')+1),'^\s+|\s+$','','g');
      end if;
      if prefix='' or body='' then raise exception 'PSALM_HEADING_EMPTY_RESULT'; end if;
      expected_row := item.original_row || jsonb_build_object('text',body,'section_title',heading);
      select to_jsonb(v) into current_row from public.mindex_bible_verses v where id=item.verse_id;
      if current_row is distinct from item.original_row and current_row is distinct from expected_row then
        raise exception 'PSALM_HEADING_CURRENT_ROW_CHANGED';
      end if;
      if current_row=item.original_row then
        update public.mindex_bible_verses set text=body,section_title=heading where id=item.verse_id;
      end if;
      select to_jsonb(v) into current_row from public.mindex_bible_verses v where id=item.verse_id;
      if current_row is distinct from expected_row then raise exception 'PSALM_HEADING_POSTCHECK_FAILED'; end if;
    end loop;
  end loop;
  if (select count(*) from mindex_maintenance.bible_psalm_headings_20261010)<>236 then
    raise exception 'PSALM_HEADING_BACKUP_COUNT_MISMATCH';
  end if;
end
$repair$;

select 'bible_psalm_headings_installed' as status,translation_key,count(*) as backed_up
from mindex_maintenance.bible_psalm_headings_20261010 group by translation_key order by translation_key;
