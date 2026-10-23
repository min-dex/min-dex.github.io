"""Derive tiny foreground metadata; no department or artwork-specific decisions."""
import argparse
from pathlib import Path
from statistics import median
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
START = '// BEGIN GENERATED BACKGROUND LUMINANCE\n'
END = '// END GENERATED BACKGROUND LUMINANCE'

def luminance(rgb):
    values = [value / 255 for value in rgb]
    values = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values]
    return sum(v * weight for v, weight in zip(values, (.2126, .7152, .0722)))

def generated():
    rows = []
    for path in sorted((ROOT / 'assets/worship-backgrounds').glob('*.png')):
        with Image.open(path) as source:
            height = max(1, round(source.height * 64 / source.width))
            image = source.convert('RGBA').resize((64, height), Image.Resampling.BILINEAR)
            black = Image.new('RGBA', (64, 36), (0, 0, 0, 255))
            black.alpha_composite(image, (0, round((36 - height) / 2)))
            image = black.convert('RGB')
            value = median(luminance(image.getpixel((x, y))) for y in range(4, 32) for x in range(5, 59))
            rows.append(f'  "{path.stem}": {value:.6f},')
    return START + 'const PRESENTER_BACKGROUND_LUMINANCE = Object.freeze({\n' + '\n'.join(rows) + '\n});\n' + END

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    path = ROOT / 'mindex.presenter.js'
    text = path.read_text()
    start, end = text.index(START), text.index(END) + len(END)
    replacement = generated()
    updated = text[:start] + replacement + text[end:]
    if args.check:
        if updated != text:
            raise SystemExit('Background luminance metadata is stale')
        print('PASS background metadata matches source images')
    else:
        path.write_text(updated)
