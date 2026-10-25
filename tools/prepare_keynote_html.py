"""Prepare an Apple HTML export's immutable manifest; never opens or edits Keynote."""
import argparse, hashlib, json, pathlib, re

def prepare(source, exported):
    if source.suffix.lower() != '.key' or not source.is_file():
        raise ValueError('Select the preserved .key source.')
    sha = hashlib.sha256(source.read_bytes()).hexdigest()
    header = json.loads((exported / 'assets/header.json').read_text())
    if not 1 <= len(header['slideList']) <= 300:
        raise ValueError('Expected 1–300 slides.')
    slides, scene = [], 0
    for slide_id in header['slideList']:
        if not re.fullmatch(r'[A-Fa-f0-9-]{36}', slide_id):
            raise ValueError('Invalid exported slide identity.')
        data = json.loads((exported / 'assets' / slide_id / (slide_id + '.json')).read_text())
        count = len(data.get('events', []))
        if not 1 <= count <= 1000:
            raise ValueError('Invalid exported scene count.')
        slides.append({'thumbnail': f'assets/{slide_id}/thumbnail.jpeg', 'sceneStart': scene, 'scenes': count})
        scene += count
    files = {}
    for item in sorted(exported.rglob('*')):
        if item.is_symlink():
            raise ValueError('Symbolic links are not supported.')
        if not item.is_file() or item.name == 'manifest.json' or item.name.startswith('.'):
            continue
        name = item.relative_to(exported).as_posix()
        if (name != 'index.html' and not name.startswith('assets/')) or not re.fullmatch(r'[a-zA-Z0-9_./@-]+', name):
            raise ValueError('Unsupported exported path: ' + name)
        data = item.read_bytes()
        files[name] = {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    if len(files) > 5000 or sum(x['size'] for x in files.values()) > 500 * 1024 * 1024:
        raise ValueError('Export exceeds supported limits.')
    runtime = files['assets/player/main.js']['sha256']
    # Apple 15.4 export. Other runtime versions require adapter verification.
    if runtime != '17c0c938caa49d5c70bd83bd5b84f57381faa51602932ca733aa965055026d91':
        raise ValueError('This Keynote export runtime needs adapter verification.')
    manifest = {'format': 'apple-keynote-html-v1', 'sourceSha256': sha, 'pages': len(slides),
                'scenes': scene, 'runtimeSha256': runtime, 'slides': slides, 'files': files}
    path = exported / 'manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
    return {'sourceSha256': sha, 'pages': len(slides), 'scenes': scene, 'files': len(files),
            'manifestSha256': hashlib.sha256(path.read_bytes()).hexdigest()}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=pathlib.Path)
    parser.add_argument('--export', required=True, dest='exported', type=pathlib.Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source.resolve(), args.exported.resolve())))
