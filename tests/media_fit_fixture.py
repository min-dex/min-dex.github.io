"""Owned green-rectangle PPTX fixtures; no authoring dependency in the gate."""
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile


def deck_bytes(width, height):
    orientation = 'landscape' if width > height else 'portrait'
    data = (Path(__file__).parent / 'fixtures' / f'media-fit-{orientation}.pptx').read_bytes()
    with ZipFile(BytesIO(data)) as package:
        size = ElementTree.fromstring(package.read('ppt/presentation.xml')).find(
            '{http://schemas.openxmlformats.org/presentationml/2006/main}sldSz')
        assert int(size.attrib['cx']) * height == int(size.attrib['cy']) * width
    return data
