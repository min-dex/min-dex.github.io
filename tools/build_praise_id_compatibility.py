"""Generate guarded compatibility SQL from explicit administrator function exports.
Offline only: no credentials, database connection or execution. Output is private.
"""
import argparse,json,os
from pathlib import Path

def literal(s): return "'"+s.replace("'","''")+"'"
def build(schema,supplement):
    functions={f['name']:f['definition'] for f in schema['functions']+supplement['functions']}
    edits={}
    def edit(name,old,new):
        source=functions[name]
        if source.count(old)!=1: raise ValueError('Function contract changed: '+name)
        edits[name]=(source,source.replace(old,new))
    edit('get_single_praise_records_v1(text[])',
         'where id=any(ids)',
         "where id=any(ids) or coalesce(payload->'previousIds','[]'::jsonb) ?| ids")
    edit('save_single_praise_record_v1(jsonb)',
         "if r->'relations' is distinct from old->'relations'",
         "if r->'previousIds' is distinct from old->'previousIds' or r->'relations' is distinct from old->'relations'")
    edit('mindex_atomic.restore_checkpoint(jsonb)',
         '  before_state := mindex_atomic.read_service(sid);',
         "  saved := mindex_single_song.rewrite_id_references(saved,mindex_single_song.id_alias_mapping());\n  before_state := mindex_atomic.read_service(sid);")
    edit('mindex_atomic.require_single_song_protocol(jsonb)',
         ' perform mindex_atomic.require_single_song_protocol_before_rollout(req);',
         " if exists(select from jsonb_object_keys(mindex_single_song.id_alias_mapping()) k where strpos(req::text,k)>0) then raise exception 'PRAISE_ID_CHANGED_RELOAD_REQUIRED'; end if;\n perform mindex_atomic.require_single_song_protocol_before_rollout(req);")
    edit('mindex_single_song.history_references(text[])',
         'begin',
         "begin\n ids:=ids||array(select a from mindex_single_song.records r cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a where r.id=any(ids));")
    edit('mindex_state_write_v1(text,text,text,text,text,uuid)',
         " if (select coalesce(sum(octet_length(value)),0)",
         " if exists(select from jsonb_object_keys(mindex_single_song.id_alias_mapping()) k where strpos(p_key,k)>0 or strpos(coalesce(p_value,''),k)>0) then raise exception 'PRAISE_ID_CHANGED_RELOAD_REQUIRED'; end if;\n if (select coalesce(sum(octet_length(value)),0)")
    edit('mutate_single_praise_v1(jsonb)',
         " if op='create' then\n  alloc_prefix:=",
         " if exists(select from jsonb_object_keys(mindex_single_song.id_alias_mapping()) k where strpos(req::text,k)>0) then raise exception 'PRAISE_ID_CHANGED_RELOAD_REQUIRED'; end if;\n if op='create' and req->>'prefix' in ('kid','SONG-CHLD') and mindex_single_song.id_alias_mapping()<>'{}'::jsonb then raise exception 'PRAISE_PREFIX_RETIRED'; end if;\n if op='create' then\n  alloc_prefix:=")
    edit('mindex_atomic.save_existing(jsonb)',
         "  perform mindex_atomic.validate_document(sid,req->'document');\n  update public.mindex_worship_services set\n    source_ref=source_ref || jsonb_build_object('mindexServiceDocument',req->'document'),",
         "  if req->'document' = '{\"idTransitionPreserveAbsentDocument\":true}'::jsonb then\n    if current_user not in ('postgres','supabase_admin') or exists(select from public.mindex_worship_services where id=sid and source_ref ? 'mindexServiceDocument') then raise exception 'REKEY_DOCUMENT_PRESERVE_FORBIDDEN'; end if;\n  else\n    perform mindex_atomic.validate_document(sid,req->'document');\n  end if;\n  update public.mindex_worship_services set\n    source_ref=case when req->'document' = '{\"idTransitionPreserveAbsentDocument\":true}'::jsonb then source_ref else source_ref || jsonb_build_object('mindexServiceDocument',req->'document') end,")
    sql=['begin;','set local lock_timeout=\'5s\';','select pg_advisory_xact_lock(1296649822,0);']
    for name,(old,new) in edits.items():
        sql.append("do $guard$ begin if pg_get_functiondef("+literal(name)+"::regprocedure) is distinct from "+literal(old)+" then raise exception 'REKEY_FUNCTION_DRIFT'; end if; end $guard$;")
    sql += ["""create or replace function mindex_single_song.id_alias_mapping() returns jsonb
language sql stable set search_path=pg_catalog as $alias$
 select coalesce(jsonb_object_agg(a,r.id),'{}'::jsonb)
 from mindex_single_song.records r cross join lateral jsonb_array_elements_text(coalesce(r.payload->'previousIds','[]'::jsonb)) a
$alias$;
revoke all on function mindex_single_song.id_alias_mapping() from public;
grant execute on function mindex_single_song.id_alias_mapping(),mindex_single_song.rewrite_id_references(jsonb,jsonb,text),mindex_single_song._rewrite_id_references(jsonb,jsonb,text) to mindex_atomic_writer,mindex_single_writer;"""]
    sql += [new.rstrip().rstrip(';')+';' for old,new in edits.values()]
    sql += ['commit;']
    return '\n'.join(sql)+'\n'

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--schema',type=Path,required=True);p.add_argument('--supplement',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();text=build(json.loads(a.schema.read_text()),json.loads(a.supplement.read_text()))
    fd=os.open(a.output,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'w') as f:f.write(text)
    print('Generated guarded compatibility candidate; not executed.')
if __name__=='__main__':main()
