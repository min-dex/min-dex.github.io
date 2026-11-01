-- Existing grants stay unchanged. Publish only slide counters or the standby label.
begin;
create or replace function public.mindex_remote_outputs()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ok',true,'outputs',coalesce(jsonb_agg(jsonb_build_object(
  'id',o.id,'title',left(coalesce(nullif(o.info->>'title',''),'예배'),120),
  'position',case when o.info->>'position' ~ '^[0-9]{1,6} / [0-9]{1,6}$' or o.info->>'position' = '송출 대기' then o.info->>'position' else '' end,
  'device',left(coalesce(o.info->>'device',''),80)) order by o.seen_at desc,o.id),'[]'::jsonb))
 from (select id,info,seen_at from mindex_remote_private.outputs
       where seen_at>now()-interval '10 seconds' and info ? 'title'
       order by seen_at desc,id limit 200) o;
$$;
commit;
