-- Shared department assignees. Install only after offline transaction tests.
begin;
grant mindex_atomic_writer to postgres;
grant create on schema public to mindex_atomic_writer;
create function mindex_atomic.department_field(kind text, label text) returns text
language sql immutable set search_path=pg_catalog,pg_temp as $$
 select case
 when kind='children' and label='봉헌기도' then 'children_prayer'
 when kind='youth' and label in ('대표기도','기도') then 'youth_prayer'
 when kind='youth' and label='봉헌기도' then 'youth_offering_prayer'
 when kind in ('young-adult','young_adult') and label in ('대표기도','기도') then 'young_adult_prayer' end
$$;
create function mindex_atomic.department_people(sid uuid) returns jsonb
language plpgsql stable set search_path=pg_catalog,pg_temp as $$
declare result jsonb='{}'; item record; field text;
begin
 for item in select s.service_type_id,e.person,e.source_ref->>'label' as label
 from public.mindex_worship_services s join public.mindex_worship_sections sec on sec.service_id=s.id
 join public.mindex_worship_elements e on e.section_id=sec.id where s.id=sid loop
  field:=mindex_atomic.department_field(item.service_type_id,item.label);
  if field is not null then
   if result ? field then raise exception 'DUPLICATE_DEPARTMENT_SLOT'; end if;
   result:=result||jsonb_build_object(field,coalesce(item.person,''));
  end if;
 end loop;
 return result;
end $$;
create table mindex_atomic.calendar_link_receipts(request_id uuid primary key,digest bytea not null,calendar_id uuid not null);
alter table mindex_atomic.calendar_link_receipts enable row level security;
create policy calendar_receipt_read on mindex_atomic.calendar_link_receipts for select to mindex_atomic_writer using(true);
create policy calendar_receipt_insert on mindex_atomic.calendar_link_receipts for insert to mindex_atomic_writer with check(true);
grant select,insert on mindex_atomic.calendar_link_receipts to mindex_atomic_writer;
grant select on public.mindex_sunday_calendar to mindex_atomic_writer;
grant update(children_prayer,youth_prayer,youth_offering_prayer,young_adult_prayer) on public.mindex_sunday_calendar to mindex_atomic_writer;
create policy department_atomic_read on public.mindex_sunday_calendar for select to mindex_atomic_writer using(true);
create policy department_atomic_update on public.mindex_sunday_calendar for update to mindex_atomic_writer using(true) with check(true);

create function mindex_atomic.guard_calendar_assignees() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
 if (new.children_prayer,new.youth_prayer,new.youth_offering_prayer,new.young_adult_prayer)
  is distinct from (old.children_prayer,old.youth_prayer,old.youth_offering_prayer,old.young_adult_prayer)
  and coalesce(current_setting('mindex.department_link_write',true),'')<>'yes' then
  raise exception 'DEPARTMENT_LINK_CLIENT_REQUIRED';
 end if;
 return new;
end $$;
create trigger department_assignee_guard before update on public.mindex_sunday_calendar
 for each row execute function mindex_atomic.guard_calendar_assignees();

-- The existing atomic worship RPC remains the only service write implementation.
-- Lock the calendar first in both directions to avoid inversions with service locks.
create or replace function public.save_worship_service_v1(req jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare root public.mindex_worship_services%rowtype; cal public.mindex_sunday_calendar%rowtype;
 before_people jsonb; after_people jsonb; receipt jsonb; field text; value text; previous_flag text;
begin
 select * into root from public.mindex_worship_services where id=(req->>'serviceId')::uuid;
 if root.service_type_id not in ('children','youth','young-adult','young_adult') then
  return mindex_atomic.save_existing(req);
 end if;
 select * into cal from public.mindex_sunday_calendar where date=root.service_date for update;
 before_people:=mindex_atomic.department_people(root.id);
 receipt:=mindex_atomic.save_existing(req);
 if (receipt->>'replayed')::boolean then return receipt||jsonb_build_object('calendar',to_jsonb(cal)); end if;
 if (req->'metadataPatch' ? 'service_date' and req->'metadataPatch'->>'service_date'<>root.service_date::text)
 or (req->'metadataPatch' ? 'service_type_id' and req->'metadataPatch'->>'service_type_id'<>root.service_type_id) then
  raise exception 'LINKED_DEPARTMENT_DATE_TYPE_CHANGE_REQUIRES_REVIEW';
 end if;
 after_people:=mindex_atomic.department_people(root.id);
 for field,value in select * from jsonb_each_text(after_people) loop
  if value is distinct from coalesce(before_people->>field,'') then
   if cal.id is null then raise exception 'DEPARTMENT_CALENDAR_MISSING'; end if;
   -- A duplicate service cannot silently retain a different assignee.
   if exists(select from public.mindex_worship_services s where s.service_date=root.service_date
      and s.service_type_id=root.service_type_id and s.id<>root.id) then
    raise exception 'DUPLICATE_DEPARTMENT_SERVICE_USE_CALENDAR';
   end if;
   previous_flag:=current_setting('mindex.department_link_write',true);
   perform set_config('mindex.department_link_write','yes',true);
   execute format('update public.mindex_sunday_calendar set %I=$1 where id=$2',field) using value,cal.id;
   perform set_config('mindex.department_link_write',coalesce(previous_flag,''),true);
  end if;
 end loop;
 if exists(select from jsonb_object_keys(before_people) f where not after_people ? f) then
  raise exception 'LINKED_DEPARTMENT_SLOT_DELETE_REQUIRES_REVIEW';
 end if;
 select * into cal from public.mindex_sunday_calendar where id=cal.id;
 return receipt||jsonb_build_object('calendar',to_jsonb(cal));
end $$;

-- New services also lock/check the roster, so a stale open tab cannot create a divergent copy.
create or replace function public.create_worship_service_v1(req jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare cal public.mindex_sunday_calendar%rowtype; receipt jsonb; people jsonb; field text; kind text:=req->>'serviceTypeId';
begin
 if kind not in ('children','youth','young-adult','young_adult') then return mindex_atomic.create_service(req); end if;
 select * into cal from public.mindex_sunday_calendar where date=(req->>'serviceDate')::date for update;
 receipt:=mindex_atomic.create_service(req);
 if (receipt->>'replayed')::boolean then return receipt; end if;
 people:=mindex_atomic.department_people((req->>'serviceId')::uuid);
 foreach field in array case when kind='children' then array['children_prayer'] when kind='youth' then array['youth_prayer','youth_offering_prayer'] else array['young_adult_prayer'] end loop
  if coalesce(people->>field,'')<>coalesce(to_jsonb(cal)->>field,'') then raise exception 'CALENDAR_REVISION_CONFLICT'; end if;
 end loop;
 return receipt;
end $$;

create function public.get_department_assignee_context_v1(calendar_id uuid,field_name text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare cal public.mindex_sunday_calendar%rowtype; kind text; aggregates jsonb;
begin
 kind:=case field_name when 'children_prayer' then 'children' when 'youth_prayer' then 'youth'
 when 'youth_offering_prayer' then 'youth' when 'young_adult_prayer' then 'young-adult' end;
 if kind is null then raise exception 'INVALID_DEPARTMENT_FIELD'; end if;
 select * into cal from public.mindex_sunday_calendar where id=calendar_id;
 if cal.id is null then raise exception 'DEPARTMENT_CALENDAR_MISSING'; end if;
 select coalesce(jsonb_agg(mindex_atomic.read_service(s.id) order by s.id),'[]') into aggregates
 from public.mindex_worship_services s where s.service_date=cal.date
 and replace(s.service_type_id,'_','-')=kind;
 return jsonb_build_object('calendar',to_jsonb(cal),'services',aggregates);
end $$;

create function public.save_calendar_assignee_v1(req jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare cal public.mindex_sunday_calendar%rowtype; field text:=req->>'field'; kind text;
 v_request_id uuid:=(req->>'requestId')::uuid; dig bytea:=sha256(convert_to(req::text,'UTF8'));
 prior mindex_atomic.calendar_link_receipts%rowtype; item jsonb; patch jsonb; result jsonb='[]';
 expected_ids uuid[]; request_ids uuid[]; previous_flag text; receipt jsonb;
begin
 if jsonb_typeof(req) is distinct from 'object' or octet_length(req::text)>8000000 or v_request_id is null
 or jsonb_typeof(req->'expected') is distinct from 'string' or jsonb_typeof(req->'value') is distinct from 'string'
 or jsonb_typeof(req->'requests') is distinct from 'array' or length(req->>'value')>200
 or req->>'value' ~ E'[\\n\\r]' then raise exception 'INVALID_CALENDAR_LINK_REQUEST'; end if;
 if exists(select from jsonb_object_keys(req) k where k not in ('requestId','calendarId','field','expected','value','requests')) then raise exception 'UNKNOWN_REQUEST_FIELD'; end if;
 kind:=case field when 'children_prayer' then 'children' when 'youth_prayer' then 'youth'
 when 'youth_offering_prayer' then 'youth' when 'young_adult_prayer' then 'young-adult' end;
 if kind is null then raise exception 'INVALID_DEPARTMENT_FIELD'; end if;
 select * into cal from public.mindex_sunday_calendar where id=(req->>'calendarId')::uuid for update;
 if cal.id is null then raise exception 'DEPARTMENT_CALENDAR_MISSING'; end if;
 select * into prior from mindex_atomic.calendar_link_receipts r where r.request_id=v_request_id;
 if found then
  if prior.digest<>dig then raise exception 'REQUEST_ID_REUSED'; end if;
  return jsonb_build_object('replayed',true,'calendar',to_jsonb(cal));
 end if;
 if coalesce(to_jsonb(cal)->>field,'')<>req->>'expected' then raise exception 'CALENDAR_REVISION_CONFLICT'; end if;
 select coalesce(array_agg(s.id order by s.id),'{}') into expected_ids from public.mindex_worship_services s
 where s.service_date=cal.date and replace(s.service_type_id,'_','-')=kind;
 select coalesce(array_agg((v->>'serviceId')::uuid order by (v->>'serviceId')::uuid),'{}') into request_ids
 from jsonb_array_elements(req->'requests') v;
 if request_ids<>expected_ids then raise exception 'DEPARTMENT_SERVICE_SET_CHANGED'; end if;
 for item in select value from jsonb_array_elements(req->'requests') order by value->>'serviceId' loop
  -- Calendar edits may only patch assignees or materialize their missing template slot.
  if coalesce(item->'metadataPatch','{}')<>'{}' or coalesce(item->'deleteElementIds','[]')<>'[]'
   or coalesce(item->'deleteSectionIds','[]')<>'[]' or coalesce(item->'elementMoves','[]')<>'[]'
   or coalesce(item->'sectionPatches','[]')<>'[]' then raise exception 'INVALID_ASSIGNEE_PATCH'; end if;
  for patch in select value from jsonb_array_elements(coalesce(item->'elementPatches','[]')) loop
   if (patch->'patch')-'person'<>'{}' or coalesce(patch->'removeKeys','{}')<>'{}'
    or patch->'patch'->>'person' is distinct from req->>'value'
    or not exists(select from public.mindex_worship_elements e join public.mindex_worship_sections sec on sec.id=e.section_id
     where e.id=(patch->>'id')::uuid and sec.service_id=(item->>'serviceId')::uuid
     and mindex_atomic.department_field(kind,e.source_ref->>'label')=field) then raise exception 'INVALID_ASSIGNEE_PATCH'; end if;
  end loop;
  for patch in select value from jsonb_array_elements(coalesce(item->'newElements','[]')) loop
   if mindex_atomic.department_field(kind,patch->'patch'->'source_ref'->>'label') is distinct from field
    or patch->'patch'->>'person' is distinct from req->>'value' then raise exception 'INVALID_ASSIGNEE_PATCH'; end if;
  end loop;
  receipt:=mindex_atomic.save_existing(item);
  if mindex_atomic.department_people((item->>'serviceId')::uuid)->>field is distinct from req->>'value' then raise exception 'ASSIGNEE_POSTCONDITION_FAILED'; end if;
  result:=result||jsonb_build_array(receipt->'aggregate');
 end loop;
 previous_flag:=current_setting('mindex.department_link_write',true);
 perform set_config('mindex.department_link_write','yes',true);
 execute format('update public.mindex_sunday_calendar set %I=$1 where id=$2',field) using req->>'value',cal.id;
 perform set_config('mindex.department_link_write',coalesce(previous_flag,''),true);
 insert into mindex_atomic.calendar_link_receipts values(v_request_id,dig,cal.id);
 select * into cal from public.mindex_sunday_calendar where id=cal.id;
 return jsonb_build_object('replayed',false,'calendar',to_jsonb(cal),'services',result);
end $$;
alter function public.get_department_assignee_context_v1(uuid,text) owner to mindex_atomic_writer;
alter function public.save_calendar_assignee_v1(jsonb) owner to mindex_atomic_writer;
revoke all on function public.get_department_assignee_context_v1(uuid,text),public.save_calendar_assignee_v1(jsonb) from public;
grant execute on function public.get_department_assignee_context_v1(uuid,text),public.save_calendar_assignee_v1(jsonb) to anon,authenticated;
revoke create on schema public from mindex_atomic_writer;
revoke mindex_atomic_writer from postgres;
revoke all on function mindex_atomic.department_field(text,text),mindex_atomic.department_people(uuid),mindex_atomic.guard_calendar_assignees() from public;
grant execute on function mindex_atomic.department_field(text,text),mindex_atomic.department_people(uuid) to mindex_atomic_writer;
notify pgrst,'reload schema';
commit;
