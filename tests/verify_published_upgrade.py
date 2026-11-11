"""CI-only real published installer -> candidate upgrade, with synthetic data."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from cleanup_desktop_ci import remove_completed_tree

API = 'https://api.github.com/repos/min-dex/min-dex.github.io/releases'
PUBLIC = 'https://github.com/min-dex/min-dex.github.io/releases/download/'
PUBLISHED_FIXTURES = Path(__file__).resolve().parent / 'fixtures' / 'published-desktop-upgrades.json'
SOURCES = {'1.0.0': 'c61f6a84e82d0ec81d102ca4e4947536eae853aa',
           '1.0.1': '37d12af3f619b3c4c71a16d070c8ca861a8e28c4',
           '1.0.2': 'd66c40c5cff97ce734bb323edea67d0c16f722e4',
           '1.0.4': '2976cde847676d1af2c13162deccb11ea4c0b66d',
           '1.0.5': '816705288a3c5abcc66e4903e48905290a5f00bc',
           '1.0.7': 'c5e87ee15a365e8fc24e8f8e805807b1c8be5402',
           '1.0.8': '03d666e58b6bd6a597ae64a1fc74d3ea85655d20'}
# Prior public releases were retired by the owner; retain immutable identities.
PUBLISHED_SOURCES = {'1.0.8': SOURCES['1.0.8']}


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
    if type(row.get('id')) is not int or row['id'] <= 0:
        raise ValueError('Invalid published asset ID')
    if not isinstance(row.get('bytes'), int) or not 0 < row['bytes'] < 5 * 1024**3:
        raise ValueError('Invalid installer size')
    if len(row.get('sha256', '')) != 64 or any(c not in '0123456789abcdef' for c in row['sha256']):
        raise ValueError('Invalid installer hash')
    return row


def upgrade_temp_root():
    root = Path(tempfile.gettempdir()).resolve()
    if sys.platform == 'win32' and root != Path(os.environ['RUNNER_TEMP']).resolve():
        raise RuntimeError('Windows TEMP/TMP must use the disposable RUNNER_TEMP volume')
    return root


def retry_download(read):
    for attempt in range(3):
        try:
            return read()
        except urllib.error.HTTPError as error:
            if error.code not in (401, 403, 408, 429, 500, 502, 503, 504) or attempt == 2:
                raise
            error.close()
        except (TimeoutError, ConnectionError, urllib.error.URLError):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)


def api_request(path, token, accept='application/vnd.github+json'):
    # Do not reuse a prior runner's cached authorization error or expired CDN redirect.
    separator = '&' if '?' in path else '?'
    url = API + path + separator + 'mindexVerify=' + uuid.uuid4().hex
    request = urllib.request.Request(url, headers={'Accept': accept})
    if token:
        # GitHub redirects downloads to its asset CDN. Do not forward the token.
        request.add_unredirected_header('Authorization', 'Bearer ' + token)
    return request


def open_release(request, timeout):
    try:
        return urllib.request.urlopen(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        if error.code not in (401, 403) or not isinstance(request, urllib.request.Request) or not request.has_header('Authorization'):
            raise
        error.close()
        # Public assets may remain available even if a runner token is rejected.
        public = urllib.request.Request(request.full_url + '&public=1', headers=request.headers)
        return urllib.request.urlopen(public, timeout=timeout)


def download_installer(url, installer, record):
    digest = hashlib.sha256()
    with open_release(url, timeout=120) as response, installer.open('wb') as out:
        for block in iter(lambda: response.read(1024 * 1024), b''):
            out.write(block)
            digest.update(block)
            if out.tell() > record['bytes']:
                raise RuntimeError('Installer exceeds recorded size')
    if installer.stat().st_size != record['bytes'] or digest.hexdigest() != record['sha256']:
        raise RuntimeError('Published installer integrity mismatch')


def download_published_installer(installer, record, version, token):
    try:
        retry_download(lambda: download_installer(
            api_request(f"/assets/{record['id']}?download=1", token, 'application/octet-stream'),
            installer, record))
    except (TimeoutError, ConnectionError, urllib.error.URLError):
        # A public browser download serves the same immutable asset. The
        # pinned size and digest checks still apply to every byte.
        url = PUBLIC + 'church-v' + version + '/' + record['file']
        retry_download(lambda: download_installer(
            url + '?mindexVerify=' + uuid.uuid4().hex, installer, record))


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('Disposable CI runner required; never install over a real profile')
    token = os.environ.pop('MINDEX_QA_GITHUB_TOKEN', '')
    candidate, target, sha, version = sys.argv[1:]
    candidate = Path(candidate).resolve()
    assert candidate.is_file() and version not in SOURCES
    receipt_dir = Path(os.environ['RUNNER_TEMP']) / ('published-upgrade-' + target)
    receipt_dir.mkdir(exist_ok=True)
    temp_root = upgrade_temp_root()
    print(f'Published upgrade temporary root: {temp_root}', flush=True)
    published = json.loads(PUBLISHED_FIXTURES.read_text(encoding='utf-8'))
    if published.keys() != PUBLISHED_SOURCES.keys():
        raise ValueError('Published upgrade fixture versions differ from the required matrix')
    for previous in PUBLISHED_SOURCES:
        free = shutil.disk_usage(temp_root).free
        print(f'Published upgrade {previous}: free {free / 1024**3:.2f} GiB; required 26 GiB', flush=True)
        if free < 26 * 1024**3:
            raise RuntimeError('Need 20 GiB reserve plus 6 GiB for published upgrade fixture')
        record = asset_record(published[previous], previous, target)
        with tempfile.TemporaryDirectory(prefix='mindex-published-download-') as folder:
            installer = Path(folder) / record['file']
            download_published_installer(installer, record, previous, token)
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
