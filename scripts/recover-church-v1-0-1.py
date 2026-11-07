"""Publish the existing verified draft by ID without replacing any asset."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

REPO = 'min-dex/min-dex.github.io'
SHA = '37d12af3f619b3c4c71a16d070c8ca861a8e28c4'
VERSION = '1.0.1'
TAG = f'church-v{VERSION}'


def api(route, *args):
    return json.loads(subprocess.check_output(['gh', 'api', f'repos/{REPO}/{route}', *args], text=True))


def verify_run(run_id, workflow, required_jobs):
    run = api(f'actions/runs/{run_id}')
    assert run['name'] == workflow and run['head_branch'] == 'main' and run['head_sha'] == SHA
    assert run['event'] == 'push' and run['status'] == 'completed'
    jobs = api(f'actions/runs/{run_id}/jobs?per_page=100')['jobs']
    successful = {job['name'] for job in jobs if job['conclusion'] == 'success'}
    assert set(required_jobs) <= successful


def digest(path):
    sha = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            sha.update(chunk)
    return sha.hexdigest()


def main():
    assert os.environ['GITHUB_REPOSITORY'] == REPO
    assert os.environ['GITHUB_REF'] == 'refs/heads/release-recovery/church-v1.0.1'
    verify_run(42392589116, 'Cloud web checks', ['scope', 'deploy-pages', *(f'offline-web ({i})' for i in range(4))])
    verify_run(42392589130, 'Desktop Packages', ['Build mac', 'Build win', 'Verify installed Mac Intel candidate'])
    records = []
    for target in ('mac-arm64.dmg', 'mac-x64.dmg', 'win-x64.exe'):
        name = f'Mindex-{VERSION}-{target}'
        path = Path('release-artifacts') / name
        records.append({'file': name, 'bytes': path.stat().st_size, 'sha256': digest(path)})
    receipt = (json.dumps({'version': VERSION, 'channel': 'internal', 'sourceCommit': SHA, 'assets': records}, indent=2) + '\n').encode()
    sums = ''.join(f"{r['sha256']}  {r['file']}\n" for r in records).encode()
    for name, data in (('internal-build.json', receipt), ('SHA256SUMS.txt', sums)):
        records.append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})

    releases = [r for r in api('releases?per_page=100') if r['tag_name'] == TAG]
    assert len(releases) == 1
    release, = releases
    assert release['draft'] and not release['prerelease'] and release['target_commitish'] == SHA
    assets = {a['name']: a for a in release['assets']}
    assert assets.keys() == {r['file'] for r in records}
    for r in records:
        asset = assets[r['file']]
        assert asset['state'] == 'uploaded' and asset['size'] == r['bytes']
        assert asset['digest'] == 'sha256:' + r['sha256']
    assert api('git/ref/heads/main')['object']['sha'] == SHA
    result = api(f"releases/{release['id']}", '-X', 'PATCH', '-F', 'draft=false', '-f', 'make_latest=true')
    assert not result['draft'] and result['tag_name'] == TAG and result['target_commitish'] == SHA
    print(f"Published {TAG} {SHA}: {result['html_url']}")


if __name__ == '__main__':
    main()
