"""Remove only this successful CI job's reproducible TEST build/fixture output."""
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile


def cleanup(root, temp, phase):
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('Disposable CI runner required')
    root, temp = Path(root).resolve(), Path(temp).resolve()
    names = {'test': ('install-fixture.json', 'upgrade-proof.json'),
             'intel-test': ('intel-fixture.json', 'intel-proof.json'),
             'internal': ('internal-install.json', 'internal-proof.json'),
             'intel-internal': ('intel-internal.json', 'intel-internal-proof.json')}[phase]
    state = json.loads((temp / names[0]).read_text(encoding='utf-8'))
    proof = json.loads((temp / names[1]).read_text(encoding='utf-8'))
    install = Path(state['root'])
    token = proof['token']
    profile = Path(proof['profile']).parent
    assert install.parent.resolve() == Path(tempfile.gettempdir()).resolve()
    assert not install.is_symlink() and install.name.startswith('mindex-install-qa-')
    assert (install / 'fixture-only').read_text(encoding='utf-8') == 'kr.mindex.app.test'
    assert len(token) == 32 and all(c in '0123456789abcdef' for c in token)
    assert profile.parent.resolve() == Path(tempfile.gettempdir()).resolve()
    assert not profile.is_symlink() and profile.name == 'mindex-isolated-upgrade-' + token
    marker = profile / 'fixture-only.json'
    assert not marker.is_symlink()
    assert json.loads(marker.read_text(encoding='utf-8')) == {'token': token, 'appId': 'kr.mindex.app.test'}
    paths = [install, profile]
    if phase.endswith('test'):
        # The workflow uploads requested TEST installers before this call.
        for name in ('prior-test', 'test'):
            folder = root / 'dist' / name
            assert not (root / 'dist').is_symlink() and not folder.is_symlink()
            if folder.exists(): paths.append(folder)
    for folder in paths:
        shutil.rmtree(folder)
    print('Removed completed CI fixtures; proof JSON and internal installers retained', flush=True)


if __name__ == '__main__':
    cleanup(Path.cwd(), os.environ['RUNNER_TEMP'], sys.argv[1])
