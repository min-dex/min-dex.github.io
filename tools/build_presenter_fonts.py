"""Build immutable common-glyph faces; retain full originals for every rare glyph."""
from pathlib import Path
import hashlib,io,json,re
from fontTools.ttLib import TTFont
from fontTools import subset
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'vendor/fonts/freesentation'
WEIGHTS={400:'4Regular',500:'5Medium',600:'6SemiBold',700:'7Bold',800:'8ExtraBold',900:'9Black'}
def ranges(points):
 out=[]
 for p in sorted(points):
  if out and p==out[-1][1]+1:out[-1][1]=p
  else:out.append([p,p])
 return ','.join(f'U+{a:X}'+(f'-{b:X}' if a!=b else '') for a,b in out)
def kerning_glyphs(font):
 glyphs=set()
 for table in font['kern'].kernTables:
  for pair in table.kernTable:glyphs.update(pair)
 for lookup in font['GPOS'].table.LookupList.Lookup:
  assert lookup.LookupType==2
  for table in lookup.SubTable:
   assert table.Format==1
   glyphs.update(table.Coverage.glyphs)
   for pairset in table.PairSet:
    glyphs.update(pair.SecondGlyph for pair in pairset.PairValueRecord)
 return glyphs
def main():
 common=TTFont(ROOT/'vendor/fonts/pretendard/MindexSans-Common.woff2').getBestCmap()
 records=[]
 for weight,label in WEIGHTS.items():
  source=DEST/f'Freesentation-{label}.woff2';font=TTFont(source,recalcTimestamp=False);cmap=font.getBestCmap()
  kern=kerning_glyphs(font)
  points={p for p,g in cmap.items() if p in common or p<0x3000 or g in kern}
  options=subset.Options();options.legacy_kern=True;options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.recalc_timestamp=False
  sub=subset.Subsetter(options=options);sub.populate(unicodes=points);sub.subset(font)
  # Derived font name; original copyright/license records remain intact.
  names={1:'Mindex Presenter Common',3:f'MindexPresenterCommon-{weight}',4:f'Mindex Presenter Common {weight}',6:f'MindexPresenterCommon-{weight}',16:'Mindex Presenter Common'}
  for record in font['name'].names:
   if record.nameID in names:record.string=names[record.nameID].encode(record.getEncoding())
  out=io.BytesIO();font.save(out);data=out.getvalue();digest=hashlib.sha256(data).hexdigest();filename=f'MindexPresenterCommon-{weight}-{digest[:16]}.woff2';(DEST/filename).write_bytes(data)
  records.append(dict(weight=weight,label=label,source=source.name,source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),file=filename,sha256=digest,bytes=len(data),codepoints=sorted(points)))
 for cssname in ['styles.css','styles.presenter-output.css']:
  p=ROOT/cssname;s=p.read_text()
  blocks=[m for m in re.finditer(r'@font-face \{[^}]+\}',s) if 'fonts/freesentation/' in m[0]]
  common_faces=[];fallback_faces=[]
  for m in blocks:
   if 'MindexPresenterCommon-' in m[0]:continue
   block=re.sub(r'\n  unicode-range: [^;]+;', '', m[0])
   record=next(r for r in records if r['source'] in block)
   common_face=block.replace(record['source'],record['file']).replace('\n}', '\n  unicode-range: '+ranges(record['codepoints'])+';\n}')
   # Complement of common coverage, including unencoded points, keeps CSS small.
   points=record['codepoints'];gaps=[];start=0
   for cp in points:
    if start<cp:gaps.append(f'U+{start:X}'+(f'-{cp-1:X}' if start!=cp-1 else ''))
    start=cp+1
   gaps.append(f'U+{start:X}-10FFFF')
   fallback=block.replace('\n}', '\n  unicode-range: '+','.join(gaps)+';\n}')
   common_faces.append(common_face);fallback_faces.append(fallback)
  # Adjacent identical ranges stay within gzip's dictionary window.
  region='\n\n'.join(fallback_faces+common_faces)
  s=s[:blocks[0].start()]+region+s[blocks[-1].end():];p.write_text(s)
 p=ROOT/'index.html';s=p.read_text()
 mapping={r['label']:r['file'] for r in records if 500<=r['weight']<=800}
 declaration='          const commonFonts = '+json.dumps(mapping,separators=(',',':'))+';\n'
 s=re.sub(r'          const commonFonts = .*?;\n','',s)
 anchor='          for (const weight of weights) {';s=s.replace(anchor,declaration+anchor)
 s=s.replace('`./vendor/fonts/freesentation/Freesentation-${weight}.woff2`','`./vendor/fonts/freesentation/${commonFonts[weight]}`');p.write_text(s)
 (DEST/'common-manifest.json').write_text(json.dumps({'fonts':records},indent=2)+'\n')
 print([(r['weight'],r['bytes'],len(r['codepoints'])) for r in records])
if __name__=='__main__':main()
