-- Read-only verification for the already-installed integrity additions.
-- Returns catalog metadata only; never saves or restores a worship service.
begin read only;
set local statement_timeout = '15s';
select jsonb_build_object(
  'checked_at', current_timestamp,
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'signature', p.oid::regprocedure::text,
      'owner', pg_get_userbyid(p.proowner),
      'security_definer', p.prosecdef,
      'settings', p.proconfig,
      'acl', p.proacl,
      'definition_hash', md5(pg_get_functiondef(p.oid)),
      'definition', pg_get_functiondef(p.oid),
      'effective_execute', (
        select jsonb_object_agg(r.rolname, has_function_privilege(r.oid,p.oid,'EXECUTE'))
        from pg_roles r where r.rolname in ('anon','authenticated','mindex_atomic_writer')
      )
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='mindex_atomic' and p.proname in (
      'remember_revision','journal_checkpoint','journal_receipt','restore_revision',
      'assert_unique_slots','validate_document','validate_document_before_slot_guard',
      'restore_checkpoint'
    )
  ),
  'triggers', (
    select jsonb_agg(jsonb_build_object(
      'table', t.tgrelid::regclass::text, 'name', t.tgname,
      'enabled', t.tgenabled, 'definition', pg_get_triggerdef(t.oid)
    ) order by t.tgname)
    from pg_trigger t where not t.tgisinternal and t.tgrelid in (
      'mindex_atomic.checkpoints'::regclass, 'mindex_atomic.receipts'::regclass
    )
  ),
  'history', (
    select jsonb_build_object(
      'owner', pg_get_userbyid(c.relowner), 'acl', c.relacl,
      'size_bytes', pg_total_relation_size(c.oid),
      'role_privileges', (
        select jsonb_object_agg(r.rolname, jsonb_build_object(
          'select', has_table_privilege(r.oid,c.oid,'SELECT'),
          'insert', has_table_privilege(r.oid,c.oid,'INSERT'),
          'update', has_table_privilege(r.oid,c.oid,'UPDATE'),
          'delete', has_table_privilege(r.oid,c.oid,'DELETE'),
          'truncate', has_table_privilege(r.oid,c.oid,'TRUNCATE')
        )) from pg_roles r where r.rolname in ('anon','authenticated','mindex_atomic_writer')
      )
    ) from pg_class c where c.oid=to_regclass('mindex_atomic.revision_history')
  )
) as integrity_catalog;
rollback;
