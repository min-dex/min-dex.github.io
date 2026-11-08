"""CI-only real published installer -> candidate upgrade, with synthetic data."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from cleanup_desktop_ci import remove_completed_tree

BASE = 'https://github.com/min-dex/min-dex.github.io/releases/download/'
SOURCES = {'1.0.0': 'c61f6a84e82d0ec81d102ca4e4947536eae853aa',
           '1.0.1': '37d12af3f619b3c4c71a16d070c8ca861a8e28c4'}


def asset_record(receipt, version, target):
    if target not in ('mac-arm64', 'mac-x64', 'win-x64'):
        raise ValueError('Unsupported target')
    if receipt.get('version') != version or receipt.get('channel') != 'internal' or receipt.get('sourceCommit') != SOURCES[version]:
        raise ValueError('Published source identity mismatch')
    name = f'Mindex-{version}-{target}.' + ('exe' if target == 'win-x64' else 'dmg')
    records = [row for row in receipt.get('assets', []) if row.get('file') == name]
    if len(records) != 1:
        raise ValueError('Missing/duplicate published installer')
    row = records[0]
    if not isinstance(row.get('bytes'), int) or not 0 < row['bytes'] < 5 * 1024**3:
        raise ValueError('Invalid installer size')
    if len(row.get('sha256', '')) != 64 or any(c not in '0123456789abcdef' for c in row['sha256']):
        raise ValueError('Invalid installer hash')
    return row


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('Disposable CI runner required; never install over a real profile')
    candidate, target, sha, version = sys.argv[1:]
    candidate = Path(candidate).resolve()
    assert candidate.is_file() and version not in SOURCES
    receipt_dir = Path(os.environ['RUNNER_TEMP']) / ('published-upgrade-' + target)
    receipt_dir.mkdir(exist_ok=True)
    for previous in SOURCES:
        free = shutil.disk_usage(tempfile.gettempdir()).free
        print(f'Published upgrade {previous}: free {free / 1024**3:.2f} GiB; required 26 GiB', flush=True)
        if free < 26 * 1024**3:
            raise RuntimeError('Need 20 GiB reserve plus 6 GiB for published upgrade fixture')
        base = BASE + 'church-v' + previous + '/'
        with urllib.request.urlopen(base + 'internal-build.json', timeout=60) as response:
            receipt = json.loads(response.read(100000))
        record = asset_record(receipt, previous, target)
        with tempfile.TemporaryDirectory(prefix='mindex-published-download-') as folder:
            installer = Path(folder) / record['file']
            digest = hashlib.sha256()
            with urllib.request.urlopen(base + record['file'], timeout=120) as response, installer.open('wb') as out:
                for block in iter(lambda: response.read(1024 * 1024), b''):
                    out.write(block)
                    digest.update(block)
                    if out.tell() > record['bytes']:
                        raise RuntimeError('Installer exceeds recorded size')
            if installer.stat().st_size != record['bytes'] or digest.hexdigest() != record['sha256']:
                raise RuntimeError('Published installer integrity mismatch')
            state = receipt_dir / (previous + '-install.json')
            proof = receipt_dir / (previous + '-proof.json')
            subprocess.run([sys.executable, 'tests/install_test_fixture.py', str(installer), str(state), 'internal'], check=True)
            exe = json.loads(state.read_text(encoding='utf-8'))['exe']
            for phase in ('seed', 'restart'):
                subprocess.run(['node', 'tests/test_desktop_upgrade.cjs', exe, str(proof), phase, SOURCES[previous], previous], check=True)
            subprocess.run([sys.executable, 'tests/install_test_fixture.py', str(candidate), str(state), 'internal'], check=True)
            for phase in ('upgrade', 'restart'):
                subprocess.run(['node', 'tests/test_desktop_upgrade.cjs', exe, str(proof), phase, sha, version], check=True)
            # Only marker-owned, successful CI installation output is reproducible.
            root = Path(json.loads(state.read_text(encoding='utf-8'))['root'])
            assert root.parent.resolve() == Path(tempfile.gettempdir()).resolve()
            assert not root.is_symlink() and root.name.startswith('mindex-install-qa-')
            assert (root / 'fixture-only').read_text(encoding='utf-8') == 'kr.mindex.app.test'
            remove_completed_tree(root)
            saved = json.loads(proof.read_text(encoding='utf-8'))
            profile = Path(saved['profile']).parent
            token = saved['token']
            assert len(token) == 32 and all(c in '0123456789abcdef' for c in token)
            assert profile.parent.resolve() == Path(tempfile.gettempdir()).resolve()
            assert not profile.is_symlink() and profile.name == 'mindex-isolated-upgrade-' + token
            marker = profile / 'fixture-only.json'
            assert not marker.is_symlink()
            assert json.loads(marker.read_text(encoding='utf-8')) == {'token': token, 'appId': 'kr.mindex.app.test'}
            remove_completed_tree(profile)
            print(f'PASS published {previous} -> {version} {target}; synthetic data preserved', flush=True)


if __name__ == '__main__':
    main()
