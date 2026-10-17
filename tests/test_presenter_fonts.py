"""Compare every common glyph outline, advance, vertical metrics and kerning."""
from pathlib import Path
import hashlib,json
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'vendor/fonts/freesentation'
checks=0
for record in json.loads((D/'common-manifest.json').read_text())['fonts']:
 source=TTFont(D/record['source']);font=TTFont(D/record['file'])
 assert hashlib.sha256((D/record['source']).read_bytes()).hexdigest()==record['source_sha256']
 assert hashlib.sha256((D/record['file']).read_bytes()).hexdigest()==record['sha256']
 assert (D/record['file']).stat().st_size < (D/record['source']).stat().st_size*.4
 original=source.getBestCmap();cmap=font.getBestCmap();assert set(cmap)==set(record['codepoints'])
 before=source.getGlyphSet();after=font.getGlyphSet()
 for cp in cmap:
  a=before[original[cp]];b=after[cmap[cp]];assert a.width==b.width,(cp,record['weight'],'width')
  pa=DecomposingRecordingPen(before);pb=DecomposingRecordingPen(after);a.draw(pa);b.draw(pb)
  assert pa.value==pb.value,(cp,record['weight'],'outline');checks+=1
 for table,attrs in [('hhea',['ascent','descent','lineGap']),('OS/2',['sTypoAscender','sTypoDescender','sTypoLineGap','usWinAscent','usWinDescent']),('head',['unitsPerEm'])]:
  for attr in attrs:assert getattr(source[table],attr)==getattr(font[table],attr),(table,attr)
 assert source['kern'].kernTables[0].kernTable==font['kern'].kernTables[0].kernTable
 def pairs(f):
  result=[]
  for lookup in f['GPOS'].table.LookupList.Lookup:
   assert lookup.LookupType==2
   for table in lookup.SubTable:
    assert table.Format==1
    for left,ps in zip(table.Coverage.glyphs,table.PairSet):
     for pair in ps.PairValueRecord:result.append((left,pair.SecondGlyph,vars(pair.Value1) if pair.Value1 else None,vars(pair.Value2) if pair.Value2 else None))
  return result
 assert pairs(source)==pairs(font),'GPOS pair adjustments changed'
 for filename in ['styles.css','styles.presenter-output.css']:
  css=(ROOT/filename).read_text()
  if filename=='styles.css' or record['weight'] in [500,600,700,800]:
   assert record['file'] in css and record['source'] in css
print('PASS',checks,'exact glyph outlines/advances, vertical metrics, kern/GPOS pairs and full fallback')
