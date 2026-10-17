"""Build lossless, preview-sized derivatives; never replace output/print originals."""
import re
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/worship-backgrounds'
match=re.search(r'const WORSHIP_BACKGROUND_STATIC_FILES = new Set\(\[(.*?)\]\)',(ROOT/'app.js').read_text(),re.S)
names=re.findall(r'"([^"]+\.png)"',match[1])
(SOURCE/'previews').mkdir(exist_ok=True)
for name in names:
    with Image.open(SOURCE/name) as image:
        image.thumbnail((1280,1280),Image.Resampling.LANCZOS)
        image.save(SOURCE/'previews'/Path(name).with_suffix('.webp'),format='WEBP',lossless=True,method=6)
print(f'Built {len(names)} preview backgrounds; originals unchanged')
