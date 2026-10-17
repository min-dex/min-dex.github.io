"""Derived preview assets are complete and lossless after deterministic resizing."""
import re
import unittest
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
class PreviewAssets(unittest.TestCase):
    def test_all_builtin_backgrounds(self):
        source=(ROOT/'app.js').read_text()
        match=re.search(r'const WORSHIP_BACKGROUND_STATIC_FILES = new Set\(\[(.*?)\]\)',source,re.S)
        names=re.findall(r'"([^"]+\.png)"',match[1])
        self.assertGreater(len(names),0)
        for name in names:
            with self.subTest(name=name),Image.open(ROOT/'assets/worship-backgrounds'/name) as original:
                original.thumbnail((1280,1280),Image.Resampling.LANCZOS)
                with Image.open(ROOT/'assets/worship-backgrounds/previews'/Path(name).with_suffix('.webp')) as preview:
                    self.assertEqual(preview.size,original.size)
                    self.assertTrue(all(channel.getbbox() is None for channel in ImageChops.difference(preview.convert('RGBA'),original.convert('RGBA')).split()))
if __name__=='__main__':unittest.main()
