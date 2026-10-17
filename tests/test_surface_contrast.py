"""Text-safe neutral and semantic palettes for both UI themes."""
import re
from pathlib import Path
s=(Path(__file__).resolve().parents[1]/'styles.css').read_text()
def lum(h):
 c=[int(h[i:i+2],16)/255 for i in (1,3,5)];v=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c];return sum(a*b for a,b in zip(v,[.2126,.7152,.0722]))
def ratio(a,b):
 x,y=sorted([lum(a),lum(b)]);return (y+.05)/(x+.05)
for theme,sel in [('light',':root'),('dark','body[data-theme="dark"]')]:
 body=s.split(sel+' {',1)[1].split('}',1)[0];colors=dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})',body))
 for text in ['ink','ink-2','ink-3','ink-4','ink-5','accent']:
  for bg in ['ui-surface-canvas','ui-surface-panel','ui-surface-field']:
   assert ratio(colors[text],colors[bg])>=4.5,(theme,text,bg,ratio(colors[text],colors[bg]))
 for text,bg in [('accent','accent-soft'),('accent-ink','accent'),('warn','warn-bg'),('danger','danger-bg'),('success','success-bg')]:
  assert ratio(colors[text],colors[bg])>=4.5,(theme,text,bg,ratio(colors[text],colors[bg]))
 print(theme,'PASS 23 normal-text contrast pairs >= 4.5:1')
