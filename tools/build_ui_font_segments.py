"""Reproduce immutable UI font segments; full-font glyphs remain intact with disjoint fallback coverage."""
from pathlib import Path
from collections import Counter
import hashlib,json,re
from fontTools.ttLib import TTFont
from fontTools import subset
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'vendor/fonts/pretendard'
SOURCE=DEST/'MindexSans-Common.woff2'
MANIFEST=DEST/'ui-segments.json'
def ranges(points):
 out=[]
 for p in sorted(points):
  if out and p==out[-1][1]+1:out[-1][1]=p
  else:out.append([p,p])
 return ', '.join(f'U+{a:X}'+(f'-{b:X}' if b!=a else '') for a,b in out)
def main():
 font=TTFont(SOURCE);cmap=font.getBestCmap()
 if MANIFEST.exists():groups=[x['codepoints'] for x in json.loads(MANIFEST.read_text())['segments']]
 else:
  freq=Counter(''.join((ROOT/name).read_text() for name in ['app.js','index.html','mindex.constants.js']))
  latin=sorted(p for p in cmap if not 0xAC00 <= p <= 0xD7A3)
  rest=sorted((p for p in cmap if 0xAC00 <= p <= 0xD7A3),key=lambda p:(-freq[chr(p)],p))
  groups=[latin]+[rest[i:i+128] for i in range(0,len(rest),128)]
 records=[];css=[]
 for points in groups:
  f=TTFont(SOURCE,recalcTimestamp=False);options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.recalc_timestamp=False
  sub=subset.Subsetter(options=options);sub.populate(unicodes=points);sub.subset(f)
  import io
  out=io.BytesIO();f.save(out);data=out.getvalue();digest=hashlib.sha256(data).hexdigest();name=f'MindexSans-{digest[:16]}.woff2';(DEST/name).write_bytes(data)
  records.append({'file':name,'sha256':digest,'bytes':len(data),'codepoints':sorted(points)})
  css.append('@font-face {\n  font-family: "Pretendard Variable";\n  src: url("./vendor/fonts/pretendard/'+name+'") format("woff2-variations");\n  font-weight: 45 930;\n  font-style: normal;\n  font-display: swap;\n  unicode-range: '+ranges(points)+';\n}')
 MANIFEST.write_text(json.dumps({'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'segments':records},ensure_ascii=False,indent=2)+'\n')
 styles=ROOT/'styles.css';s=styles.read_text()
 full=TTFont(DEST/'PretendardVariable.woff2').getBestCmap()
 fallback=ranges(set(full)-set(cmap))
 first=re.search(r'@font-face \{[^}]+\}',s)
 block=re.sub(r'\n  unicode-range: [^;]+;', '', first[0])
 block=block.replace('\n}', '\n  unicode-range: '+fallback+';\n}')
 s=s[:first.start()]+block+s[first.end():]
 start=s.index('@font-face {',s.index('@font-face {')+1);end=s.index('@font-face {\n  font-family: "Mindex Wordmark";',start)
 s=s[:start]+'\n'.join(css)+'\n'+s[end:];s=s.replace('src: url("./vendor/fonts/pretendard/MindexSans-Common.woff2")','src: url("./vendor/fonts/pretendard/'+records[0]['file']+'")');styles.write_text(s)
 p=ROOT/'index.html';s=p.read_text();s=re.sub(r'href="\./vendor/fonts/pretendard/(?:MindexSans-Common|MindexSans-[a-f0-9]{16})\.woff2" as="font"','href="./vendor/fonts/pretendard/'+records[0]['file']+'" as="font"',s);p.write_text(s)
 print(len(records),'segments',sum(x['bytes'] for x in records),'bytes; Latin/wordmark',records[0]['bytes'])
if __name__=='__main__':main()
