#!/usr/bin/env python3
"""Read-only Bible audit against an operator-supplied EasySlides ZIP.
No DDL, RPC writes or HTTP mutations. Requires URL and anon key only.
"""
import argparse
import collections
import concurrent.futures
import hashlib
import html
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

BOOKS='GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
BLOCK=lambda tag: re.compile(r'<'+tag+r'\b([^>]*)>(.*?)</'+tag+r'>',re.I|re.S)
ATTR=re.compile(r'''([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(['"])(.*?)\2''',re.S)
def attrs(s): return {m[1].lower():html.unescape(m[3].strip()) for m in ATTR.finditer(s)}
def clean(s):
    s=html.unescape(s or '')
    s=re.sub(r'<br\s*/?>','\n',s,flags=re.I).replace('\ufeff','')
    s=re.sub(r'[ \t\r\f\v]+',' ',s)
    s=re.sub(r'\s*\n\s*','\n',s)
    return unicodedata.normalize('NFC',s.strip())
def address(r): return (r['book_code'],r['chapter'],r['verse'])
def digest(x): return hashlib.sha256(x.encode()).hexdigest()
def parse_archive(path):
    result={}
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.filename.startswith('__MACOSX/') or not info.filename.lower().endswith('.xml'):continue
            data=z.read(info);xml=data.decode('utf-8-sig')
            title=clean(re.sub(r'<[^>]+>','',BLOCK('title').search(xml)[2]))
            rows=[];chapters=[];books=[];invalid_verses=[]
            for ba,bb in BLOCK('BIBLEBOOK').findall(xml):
                bn=int(attrs(ba)['bnumber']);assert 1<=bn<=66
                book=BOOKS[bn-1];books.append(book)
                for ca,cb in BLOCK('CHAPTER').findall(bb):
                    chapter=int(attrs(ca)['cnumber']);assert chapter>0;chapters.append((book,chapter))
                    for va,vb in BLOCK('VERS').findall(cb):
                        raw_number=attrs(va).get('vnumber','')
                        try:verse=int(raw_number)
                        except ValueError:verse=0
                        if verse<=0:
                            invalid_verses.append({'book':book,'chapter':chapter,'raw_number':raw_number,'text':clean(vb)[:300],'sha256':digest(clean(vb))})
                            continue
                        text=clean(vb)
                        m=re.match(r'^\s*<([^<>\n]{1,100})>\s*(.*)$',text,re.S)
                        heading,text=(m[1].strip(),m[2].strip()) if m else ('',text)
                        rows.append(dict(book_code=book,chapter=chapter,verse=verse,text=text,section_title=heading))
            assert len(rows)+len(invalid_verses)==len(BLOCK('VERS').findall(xml)),title
            assert title not in result,title
            result[title]={'rows':rows,'source_sha256':hashlib.sha256(data).hexdigest(),
                'invalid_verses':invalid_verses,'books':len(books),'chapters':len(chapters),'duplicate_books':len(books)-len(set(books)),
                'duplicate_chapters':len(chapters)-len(set(chapters))}
    return result

def expected_row(name,row):
    r=dict(row)
    approved=(name=='현대어' or (name in ['쉬운성경','우리말','바른성경','공동번역'] and r['book_code']=='PSA' and r['verse']==1))
    if approved and r['text'].startswith('['):
        m=re.match(r'^\[([^\]\n]+)\]\s*(.*)$',r['text'],re.S)
        if not m:raise ValueError('Malformed reviewed heading')
        parts=[x for x in [r['section_title'],m[1].strip()] if x];body=m[2].strip()
        if name=='쉬운성경':
            m=re.match(r'^<([^<>]+)>\s*(.*)$',body,re.S)
            if not m:raise ValueError('Missing easy heading')
            parts.append(m[1].strip());body=m[2].strip()
        if not body:raise ValueError('Empty body after split')
        r.update(text=body,section_title=' · '.join(parts))
    return r

class Api:
    def __init__(self,env):
        values={}
        for line in Path(env).read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k,v=line.split('=',1);values[k.strip()]=v.strip().strip('\'"')
        self.url=values['SUPABASE_URL'].rstrip('/')+'/rest/v1/'
        self.headers={'apikey':values['SUPABASE_ANON_KEY'],'Authorization':'Bearer '+values['SUPABASE_ANON_KEY'],'Prefer':'count=exact'}
    def get(self,table,params):
        req=urllib.request.Request(self.url+table+'?'+urllib.parse.urlencode(params),headers=self.headers,method='GET')
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req,timeout=40) as response:
                    count=response.headers.get('Content-Range','').split('/')[-1]
                    if not count.isdigit():raise ValueError('Missing exact count')
                    return json.load(response),int(count)
            except Exception:
                if attempt==2:raise
                time.sleep(attempt+1)

def audit_one(api,t,source,cache,repairs=None):
    name=t['name'];start=time.time();rows=[];total=None
    while total is None or len(rows)<total:
        page,count=api.get('mindex_bible_verses',{'translation_id':'eq.'+t['id'],'select':'id,book_code,chapter,verse,verse_end,text,section_title,is_active',
              'order':'book_code,chapter,verse,id','offset':len(rows),'limit':1000})
        if total is not None and total!=count:raise ValueError('Count changed while scanning '+name)
        total=count
        if not page and len(rows)<total:raise ValueError('Truncated pagination '+name)
        rows.extend(page)
    assert len(rows)==total
    (cache/(t['translation_key']+'.json')).write_text(json.dumps(rows,ensure_ascii=False))
    expected=[dict(expected_row(name,r),verse_end=None,is_active=True) for r in source['rows']]
    for r in expected:
        repair=(repairs or {}).get((name,address(r)))
        if repair:
            for field in ['text','section_title','verse_end','is_active']:
                if r[field]!=repair['before'][field]:raise ValueError('Repair source mismatch')
            r.update(repair['patch'])
    source_counts=collections.Counter(map(address,expected));live_counts=collections.Counter(map(address,rows))
    smap={address(r):r for r in expected};lmap={address(r):r for r in rows}
    differences=[]
    for a in sorted(smap.keys() & lmap.keys()):
        s,l=smap[a],lmap[a]
        for field in ['text','section_title','verse_end','is_active']:
            if s[field]!=l[field]:differences.append({'address':a,'field':field,'source_sha256':digest(json.dumps(s[field],ensure_ascii=False)),'live_sha256':digest(json.dumps(l[field],ensure_ascii=False))})
    gaps=[]
    chapter_verses=collections.defaultdict(list)
    for r in source['rows']:chapter_verses[(r['book_code'],r['chapter'])].append(r['verse'])
    for (book,ch),verses in chapter_verses.items():
        missing=sorted(set(range(1,max(verses)+1))-set(verses))
        if missing:gaps.append({'book':book,'chapter':ch,'missing':missing})
    residual=[]
    for r in expected:
        if r['text'].startswith('<') or (r['book_code']=='PSA' and r['text'].startswith('[')):
            residual.append({'address':address(r),'prefix':r['text'][:160]})
    result={'translation':name,'active_translation':t['is_active'],'source_rows':len(expected),'live_rows':len(rows),
      **{k:source[k] for k in ['source_sha256','books','chapters','duplicate_books','duplicate_chapters','invalid_verses']},
      'missing':sorted(smap.keys()-lmap.keys()),'extra':sorted(lmap.keys()-smap.keys()),
      'source_duplicate_addresses':[k for k,v in source_counts.items() if v>1],
      'live_duplicate_addresses':[k for k,v in live_counts.items() if v>1],
      'inactive_rows':sum(not r['is_active'] for r in rows),
      'invalid_addresses':[address(r) for r in rows if r['book_code'] not in BOOKS or r['chapter']<1 or r['verse']<1],
      'empty_body':[address(r) for r in rows if not r['text'].strip()],
      'active_empty_body':[address(r) for r in rows if r['is_active'] and not r['text'].strip()],
      'verse_end_rows':[{'address':address(r),'verse_end':r['verse_end']} for r in rows if r['verse_end'] is not None],
      'replacement_character_rows':[address(r) for r in rows if '\ufffd' in r['text']],
      'differences':differences,'headings':sum(bool(r['section_title']) for r in rows),
      'source_gap_chapters':gaps,'residual_heading_candidates':residual,
      'snapshot_sha256':digest(json.dumps(rows,ensure_ascii=False,sort_keys=True)),
      'elapsed_seconds':round(time.time()-start,1)}
    print(name,len(rows),'rows; missing',len(result['missing']),'extra',len(result['extra']),'differences',len(differences),flush=True)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive',type=Path);p.add_argument('--env',type=Path,default=Path('.env.supabase.local'))
    p.add_argument('--output',type=Path,required=True);p.add_argument('--cache-dir',type=Path,required=True);p.add_argument('--repair-manifest',type=Path);args=p.parse_args()
    repairs={(i['translation'],address(i['before'])):i for i in json.loads(args.repair_manifest.read_text())} if args.repair_manifest else {}
    sources=parse_archive(args.archive);api=Api(args.env);translations,count=api.get('mindex_bible_translations',{'select':'id,name,translation_key,is_active','order':'name'})
    assert len(translations)==count
    args.cache_dir.mkdir(parents=True,exist_ok=True)
    matched=[t for t in translations if t['name'] in sources];missing_sources=[t['name'] for t in translations if t['name'] not in sources]
    print('Inventory:',len(translations),'DB translations;',len(sources),'XML translations; missing sources:',missing_sources,flush=True)
    results=[];errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(audit_one,api,t,sources[t['name']],args.cache_dir,repairs):t['name'] for t in matched}
        for f in concurrent.futures.as_completed(futures):
            try:results.append(f.result())
            except Exception as e:errors.append({'translation':futures[f],'error_type':type(e).__name__});print('FAILED',futures[f],type(e).__name__,flush=True)
    report={'read_only':True,'repair_manifest_sha256':hashlib.sha256(args.repair_manifest.read_bytes()).hexdigest() if args.repair_manifest else None,'archive_sha256':hashlib.sha256(args.archive.read_bytes()).hexdigest(),
      'checked_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'missing_sources':missing_sources,
      'xml_not_in_database':sorted(set(sources)-{t['name'] for t in translations}),'errors':errors,
      'translations':sorted(results,key=lambda r:r['translation'])}
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('Report:',args.output,flush=True)
    return 1 if errors or missing_sources else 0
if __name__=='__main__':raise SystemExit(main())
