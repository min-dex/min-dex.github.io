"""Every segmented glyph preserves source outlines/metrics at variable weights."""
from pathlib import Path
import hashlib,json
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'vendor/fonts/pretendard'
manifest=json.loads((D/'ui-segments.json').read_text());source=TTFont(D/'MindexSans-Common.woff2')
assert hashlib.sha256((D/'MindexSans-Common.woff2').read_bytes()).hexdigest()==manifest['source_sha256']
original=source.getBestCmap();seen=set();checks=0
css=(ROOT/'styles.css').read_text()
for part in manifest['segments']:
 data=(D/part['file']).read_bytes();assert hashlib.sha256(data).hexdigest()==part['sha256'];assert len(data)==part['bytes']
 font=TTFont(D/part['file']);cmap=font.getBestCmap();points=set(part['codepoints'])
 assert not seen&points;seen|=points;assert points==set(cmap);assert part['file'] in css
 assert [(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in font['fvar'].axes]==[(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in source['fvar'].axes]
 for weight in [45,400,700,930]:
  before=source.getGlyphSet(location={'wght':weight});after=font.getGlyphSet(location={'wght':weight})
  for cp in points:
   a=before[original[cp]];b=after[cmap[cp]];assert a.width==b.width,(cp,weight,'width')
   pa=DecomposingRecordingPen(before);pb=DecomposingRecordingPen(after);a.draw(pa);b.draw(pb)
   assert pa.value==pb.value,(cp,weight,'outline');checks+=1
assert seen==set(original),'characters dropped or added'
assert 'PretendardVariable.woff2' in css,'rare character fallback lost'
assert 'MindexSans-Common.woff2' not in css,'monolith still loaded'
print('PASS',checks,'glyph/weight outline and advance comparisons; exact coverage, hashes, variable axes and fallback')
