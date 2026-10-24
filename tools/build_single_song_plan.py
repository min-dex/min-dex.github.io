"""Offline plan only: no network, DB writes or migration SQL."""
import argparse,collections,hashlib,html,json,re
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--snapshot',type=Path,required=True)
parser.add_argument('--prior-plan',type=Path,required=True)
parser.add_argument('--hymn-ledger',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
snapshot=args.snapshot.resolve();OUT=args.output.resolve()
if OUT.exists() and any(OUT.iterdir()):raise SystemExit('Output must be new or empty; preserve prior evidence')
OUT.mkdir(parents=True,exist_ok=True)
d=json.loads(snapshot.read_text());prior=json.loads(args.prior_plan.read_text())
prior_records={r['legacyVersionId']:r for r in prior['records']}
reserved={r['idCandidate'] for r in prior['records'] if r['idCandidate']}
assert len(reserved)==sum(bool(r['idCandidate']) for r in prior['records']), 'Duplicate prior IDs'
retired=set(prior.get('summary',{}).get('retiredCandidateIds',[]))
assert not (reserved & retired), 'Retired ID reused in prior plan'
reserved.update(retired)
C={r['id']:r for r in d['mindex_canonical_songs']};S={r['id']:r for r in d['mindex_songs']};V={r['id']:r for r in d['mindex_song_versions']}
E={r['versionId']:r for r in json.loads(args.hymn_ledger.read_text())['versions']}
by=collections.defaultdict(list);units=collections.defaultdict(list);source=collections.defaultdict(list)
for v in V.values():by[v['canonical_song_id']].append(v['id']);source[v['source_song_id']].append(v['id'])
for u in d['mindex_version_units']:units[u['version_id']].append(u)
def digest(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
records=[];counts=collections.Counter();lookup={}
for code in reserved:
 prefix,number=code.split('-',1)
 if prefix in ['ccm','kid'] and number.isdigit():counts[prefix]=max(counts[prefix],int(number))
for vid,v in sorted(V.items(),key=lambda x:(C[x[1]['canonical_song_id']]['title'],x[1].get('version_order') or 0,x[0])):
 c=C[v['canonical_song_id']];s=S.get(v.get('source_song_id'),{});e=E.get(vid);hold=None
 prior_record=prior_records.get(vid)
 if e:
  code=('knh' if e['edition']=='new' else 'kth')+f"-{e['number']:03d}"
  if prior_record and prior_record['idCandidate']:assert code==prior_record['idCandidate'], 'Hymn identity drift'
 elif prior_record and prior_record['idCandidate']:
  code=prior_record['idCandidate']
 else:
  tags=v.get('praise_types') or []
  prefix='kid' if tags==['children'] else 'ccm' if tags==['ccm'] else None
  if prefix is None:code=None;hold='분류 확인 필요: 기존 후보나 명시적 단일 분류 없음'
  else:counts[prefix]+=1;code=f'{prefix}-{counts[prefix]:03d}';assert code not in reserved;reserved.add(code)
 # Preserve all layers as provenance: no invented winner for differing values.
 fields={}
 for key in sorted((set(c)|set(s)|set(v))-{'id','canonical_song_id','source_song_id','audio_set'}):
  values={layer:r[key] for layer,r in [('canonical',c),('source',s),('version',v)] if key in r}
  fields[key]=values
 us=sorted(units[vid],key=lambda u:u['id'])
 r={'idCandidate':code,'legacyVersionId':vid,'legacyCanonicalId':c['id'],'legacySourceId':v.get('source_song_id'),'title':c['title'],'versionName':v.get('curated_version_name') or v.get('version_label'),'hold':hold,'unitIds':[u['id'] for u in us],'unitsSha256':digest(us),'audioSetSha256':digest(v.get('audio_set')),'hasAudio':bool(v.get('audio_set')),'metadataByOrigin':fields}
 records.append(r);lookup[vid]=r
same=[]
for cid,ids in by.items():
 if len(ids)>1:same.append({'legacyCanonicalId':cid,'members':[{'legacyVersionId':i,'idCandidate':lookup[i]['idCandidate']} for i in ids], 'status':'기존 소속 보존 후보: 의미별 관계는 검토', 'relation':'same_song'})
refs=[]
for el in d['mindex_worship_elements']:
 if not(el.get('song_id') or el.get('song_version_id')):continue
 vid=el.get('song_version_id');r=lookup.get(vid)
 owner=V.get(vid,{}).get('source_song_id') or V.get(vid,{}).get('canonical_song_id')
 refs.append({'elementId':el['id'],'legacySongId':el['song_id'],'legacyVersionId':vid,'idCandidate':r['idCandidate'] if r else None,'ownerMatches':owner==el['song_id'],'status':'resolved' if r and r['idCandidate'] and owner==el['song_id'] else 'hold','originalRowSha256':digest(el)})
# Retain ambiguity explicitly: old song IDs are not aliases to an arbitrary first version.
legacy={}
for namespace,rows in [('source',S),('canonical',C)]:
 for oldid in rows:
  ids=source.get(oldid,[]) if namespace=='source' else by.get(oldid,[])
  legacy[namespace+':'+oldid]={'versionCandidates':ids,'status':'unique' if len(ids)==1 else 'select_required' if ids else 'empty'}
related=[]
for row in d['mindex_song_relations']:
 def candidates(i):return sorted(set(source.get(i,[]) or by.get(i,[])))
 related.append({'legacyRelationId':row['id'],'relationType':row['relation_type'],'sourceCandidates':candidates(row['source_song_id']),'targetCandidates':candidates(row['related_song_id']),'status':'scope_review_required','note':'기존 related를 same_song으로 자동 승격하지 않음'})
# Inspect structured nested references, without emitting operational content.
nested=[]
keys={'song_id','songId','version_id','versionId','song_version_id','songVersionId','canonical_song_id','suggested_song_id'}
def walk(obj,path,table,rid):
 if isinstance(obj,dict):
  for k,value in obj.items():
   q=path+'/'+str(k)
   if k in keys and isinstance(value,str) and value:
    namespaces=[name for name,tab in [('version',V),('source',S),('canonical',C)] if value in tab]
    nested.append({'table':table,'rowId':rid,'path':q,'legacyId':value,'namespaces':namespaces})
   walk(value,q,table,rid)
 elif isinstance(obj,list):
  for i,value in enumerate(obj):walk(value,path+'/'+str(i),table,rid)
for table,rows in d.items():
 if not table.startswith('mindex_worship_'):continue
 for row in rows:
  for key,value in row.items():
   if isinstance(value,(dict,list)):walk(value,'/'+key,table,row['id'])
summary={'snapshotSha256':hashlib.sha256(snapshot.read_bytes()).hexdigest(),'existingVersions':len(V),'proposedRecords':sum(bool(r['idCandidate']) for r in records),'heldVersions':sum(not r['idCandidate'] for r in records),'prefixes':dict(collections.Counter(r['idCandidate'].split('-')[0] for r in records if r['idCandidate'])),'lyricUnitsPreserved':sum(len(r['unitIds']) for r in records),'audioSetsPreserved':sum(r['hasAudio'] for r in records),'directReferences':len(refs),'directResolved':sum(r['status']=='resolved' for r in refs),'directHeld':sum(r['status']!='resolved' for r in refs),'nestedStructuredReferenceOccurrences':len(nested),'relatedRows':len(related),'sameSongGroups':len(same),'emptyCanonicals':sum(not by.get(cid) for cid in C),'productionWrites':0,'snapshotOnly':True}
assert len(records)==len(V)==len({r['legacyVersionId'] for r in records})
codes=[r['idCandidate'] for r in records if r['idCandidate']];assert len(codes)==len(set(codes))
assert all(re.fullmatch(r'(knh|kth|ccm|kid)-\d{3,}',x) for x in codes)
assert sorted(r['idCandidate'] for r in records if (r['idCandidate'] or '').startswith('knh-'))==[f'knh-{i:03d}' for i in range(1,646)]
assert sorted(r['idCandidate'] for r in records if (r['idCandidate'] or '').startswith('kth-'))==[f'kth-{i:03d}' for i in range(1,559)]
assert sorted(i for r in records for i in r['unitIds'])==sorted(u['id'] for u in d['mindex_version_units'])
summary['priorCandidateIdsPreserved']=all(r['idCandidate']==prior_records[r['legacyVersionId']]['idCandidate'] for r in records if r['legacyVersionId'] in prior_records and prior_records[r['legacyVersionId']]['idCandidate'])
assert summary['priorCandidateIdsPreserved']
summary['retiredCandidateIds']=sorted(retired | {r['idCandidate'] for vid,r in prior_records.items() if vid not in V and r['idCandidate']})
summary['newVersions']=sum(r['legacyVersionId'] not in prior_records for r in records)
assert hashlib.sha256(snapshot.read_bytes()).hexdigest()==summary['snapshotSha256']
plan={'summary':summary,'records':records,'sameSongGroups':same,'legacyAliases':legacy,'relatedCandidates':related,'worshipDirectReferences':refs,'nestedReferencesToReview':nested}
(OUT/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2))
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
esc=lambda x:html.escape(str(x or ''))
rows=''.join('<tr>'+''.join('<td>'+esc(x)+'</td>' for x in [r['idCandidate'] or '보류',r['title'],r['versionName'],len(r['unitIds']),'있음' if r['hasAudio'] else '',r['hold'],r['legacyVersionId']])+'</tr>' for r in records)
(OUT/'mapping.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><title>단일 ID 매핑 후보</title><style>body{font:15px sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{position:sticky;top:0;background:#eee}td:last-child{font-size:11px}</style><h1>단일 ID 매핑 후보 — 미적용</h1><p>명시한 최신 스냅샷 기준. 기존 후보 번호는 유지하며 삭제된 번호는 재사용하지 않음. 대표곡 ID 없이 기존 버전별 하나의 레코드. kth·kid는 내부 접두어 제안. 번호는 아직 확정 전.</p><table><thead><tr>'+''.join('<th>'+x+'</th>' for x in ['단일 ID','제목','기존 버전명','가사 단위','음원','보류 사유','기존 버전 ID'])+'</tr></thead><tbody>'+rows+'</tbody></table></html>')
print(json.dumps(summary,ensure_ascii=False,indent=2))
