-- Reusable bulletin layouts are independent of dated worship/bulletin records.
-- No existing service, bulletin, lyrics or scripture rows are modified.
begin;
create table if not exists public.mindex_bulletin_templates (
  template_key text primary key check (template_key ~ '^[a-z0-9-]{1,80}$'),
  title text not null check (length(title) between 1 and 120),
  department text not null check (department in ('young-adult','children')),
  effective_from date not null,
  layout jsonb not null check (jsonb_typeof(layout)='object'),
  common jsonb not null default '{}' check (jsonb_typeof(common)='object'),
  revision integer not null default 1 check (revision>0),
  updated_at timestamptz not null default now()
);
create or replace function public.mindex_bulletin_template_revision() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if TG_OP='INSERT' then new.revision:=1;
  else
    if new.template_key<>old.template_key or new.department<>old.department then
      raise exception 'BULLETIN_TEMPLATE_IDENTITY_IMMUTABLE';
    end if;
    new.revision:=old.revision+1;
  end if;
  new.updated_at:=now();return new;
end;
$$;
drop trigger if exists mindex_bulletin_template_revision on public.mindex_bulletin_templates;
create trigger mindex_bulletin_template_revision before insert or update on public.mindex_bulletin_templates
for each row execute function public.mindex_bulletin_template_revision();
alter table public.mindex_bulletin_templates enable row level security;
revoke all on public.mindex_bulletin_templates from anon, authenticated;
-- Follow the current bulletin role grants, including installations hardened to authenticated writes.
do $$
declare r text; op text;
begin
  foreach r in array array['anon','authenticated'] loop
    foreach op in array array['select','insert','update'] loop
      if has_table_privilege(r,'public.mindex_bulletins',op) then
        execute format('grant %s on public.mindex_bulletin_templates to %I',op,r);
        execute format('drop policy if exists %I on public.mindex_bulletin_templates','template_'||r||'_'||op);
        if op='select' then
          execute format('create policy %I on public.mindex_bulletin_templates for select to %I using (true)','template_'||r||'_'||op,r);
        elsif op='insert' then
          execute format('create policy %I on public.mindex_bulletin_templates for insert to %I with check (true)','template_'||r||'_'||op,r);
        else
          execute format('create policy %I on public.mindex_bulletin_templates for update to %I using (true) with check (true)','template_'||r||'_'||op,r);
        end if;
      end if;
    end loop;
  end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
