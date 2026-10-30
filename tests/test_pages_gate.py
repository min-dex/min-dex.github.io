"""Offline deployment contract + committed-only artifact regression."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_pages', ROOT / 'cloud/stage_pages.py')
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)


class PagesGate(unittest.TestCase):
    def test_gate_and_permissions(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/cloud-check.yml').read_text())
        check = workflow['jobs']['offline-web']
        deploy = workflow['jobs']['deploy-pages']
        scope = workflow['jobs']['scope']
        self.assertEqual(check['needs'], 'scope')
        self.assertEqual(scope['steps'][1]['run'], 'python3 cloud/check_scope.py')
        self.assertEqual(scope['steps'][2]['name'], 'Scope proof: ${{ steps.plan.outputs.signature }}')
        self.assertEqual(check['env']['MINDEX_CHECK_PROFILE'], '${{ needs.scope.outputs.profile }}')
        self.assertEqual(check['env']['MINDEX_CHECK_SMOKES'], '${{ needs.scope.outputs.smokes }}')
        self.assertEqual(check['env']['MINDEX_CHECK_SIGNATURE'], '${{ needs.scope.outputs.signature }}')
        self.assertEqual(deploy['needs'], 'offline-web')
        self.assertEqual(deploy['if'], "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'")
        self.assertEqual(check['strategy']['matrix']['shard'], [0, 1, 2, 3])
        self.assertFalse(check['strategy']['fail-fast'])
        self.assertEqual(check['concurrency'], {
            'group': 'cloud-check-${{ github.event_name }}-${{ github.ref }}-${{ matrix.shard }}',
            'cancel-in-progress': True,
        })
        command = next(step['run'] for step in check['steps'] if 'cloud/check.py' in step.get('run', ''))
        self.assertIn('--shard-index ${{ matrix.shard }} --shard-count 4', command)
        self.assertNotIn('continue-on-error', check)
        for step in check['steps']:
            self.assertNotIn('continue-on-error', step)
        self.assertTrue(any('cloud/check.py' in step.get('run', '') for step in check['steps']))
        self.assertEqual(workflow['permissions'], {'contents': 'read'})
        self.assertEqual(check['permissions'], {'contents': 'read', 'actions': 'read'})
        reuse_step = next(step for step in check['steps'] if step.get('id') == 'verified')
        self.assertEqual(reuse_step['run'], 'python3 cloud/reuse_checks.py')
        for step in check['steps'][2:]:
            if step.get('id') in ('python', 'pip-cache-seed'):
                continue
            self.assertEqual(step['if'], "steps.verified.outputs.reuse != 'true'")
        python_step = next(step for step in check['steps'] if step.get('uses') == 'actions/setup-python@v5')
        self.assertEqual(python_step['with']['cache'], 'pip')
        self.assertEqual(python_step['with']['cache-dependency-path'], 'cloud/requirements.txt')
        setup_step = next(step for step in check['steps'] if step.get('run') == 'bash cloud/setup.sh')
        self.assertNotIn('cache-hit', setup_step['if'])
        setup = (ROOT / 'cloud/setup.sh').read_text()
        self.assertIn('pip install -r cloud/requirements.txt', setup)
        self.assertIn('playwright install --with-deps chromium webkit', setup)
        self.assertEqual(deploy['permissions'], {'contents': 'read', 'pages': 'write', 'id-token': 'write'})
        self.assertEqual(deploy['steps'][0]['with']['ref'], '${{ github.sha }}')
        self.assertIn('origin/main', deploy['steps'][1]['run'])
        self.assertEqual(deploy['concurrency'], {'group': 'pages', 'cancel-in-progress': False})
        self.assertEqual(deploy['steps'][-1]['uses'], 'actions/deploy-pages@v4')
        # Default success() dependency semantics block failed/cancelled parents.
        self.assertNotIn('always()', deploy['if'])

    def test_default_branch_seed_does_not_repeat_checks_or_browser_setup(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/cloud-check.yml').read_text())
        steps = workflow['jobs']['offline-web']['steps']
        python = next(step for step in steps if step.get('id') == 'python')
        seed = next(step for step in steps if step.get('id') == 'pip-cache-seed')
        self.assertEqual(python['uses'], 'actions/setup-python@v5')
        self.assertEqual(python['if'], "steps.verified.outputs.reuse != 'true' || (github.ref == 'refs/heads/main' && matrix.shard == 0)")
        self.assertEqual(seed['if'], "github.ref == 'refs/heads/main' && matrix.shard == 0 && steps.verified.outputs.reuse == 'true' && steps.python.outputs.cache-hit != 'true'")
        self.assertEqual(seed['timeout-minutes'], 2)
        self.assertEqual(seed['run'], 'python -m pip download --only-binary=:all: --requirement cloud/requirements.txt --dest "$RUNNER_TEMP/mindex-pip-cache-seed"')
        self.assertLess(steps.index(python), steps.index(seed))
        for command in ('bash cloud/setup.sh', '.cache/cloud-venv/bin/python cloud/check.py --shard-index ${{ matrix.shard }} --shard-count 4'):
            step = next(step for step in steps if step.get('run') == command)
            self.assertEqual(step['if'], "steps.verified.outputs.reuse != 'true'")

    def test_artifact_ignores_untracked_and_modified_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'repo'
            root.mkdir()
            def git(*args):
                return subprocess.run(['git', *args], cwd=root, check=True, capture_output=True)
            git('init')
            (root / 'index.html').write_text('tested commit')
            excluded = ['tests/fixture.json', 'cloud/check.py', '.github/workflows/test.yml',
                        'tools/build.js', 'migrations/schema.sql', 'electron/main.js']
            retained = ['assets/tests/image.webp', 'assets/video.mp4', 'vendor/LICENSE',
                        'data/runtime.json', 'docs/manual.md', '.nojekyll', 'app.js']
            for name in excluded + retained:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('committed fixture')
            (root / 'package.json').write_text(json.dumps({'version':'0.1.1'}))
            (root / 'product-release.json').write_text(json.dumps({'channel':'development','changes':['검증용 변경']}))
            (root / 'mindex-release.json').write_text(json.dumps({'version':'fixture-build'}))
            git('add', '.')
            git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture')
            (root / 'index.html').write_text('not tested')
            (root / 'private-backup.json').write_text('synthetic untracked fixture')
            target = Path(folder) / 'site'
            stager.stage(root, target)
            self.assertEqual((target / 'index.html').read_text(), 'tested commit')
            self.assertFalse((target / 'private-backup.json').exists())
            self.assertFalse((target / '.git').exists())
            identity=json.loads((target / 'mindex-build.json').read_text())
            self.assertEqual(identity['sourceCommit'],git('rev-parse','HEAD').stdout.decode().strip())
            self.assertEqual(identity['channel'],'development')
            self.assertEqual(identity['productVersion'],'0.1.1')
            for name in excluded:
                self.assertFalse((target / name).exists(), name)
            for name in retained:
                self.assertEqual((target / name).read_text(), 'committed fixture', name)


if __name__ == '__main__':
    unittest.main()
