"""Offline deployment contract + committed-only artifact regression."""
import importlib.util
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
            self.assertEqual(step['if'], "steps.verified.outputs.reuse != 'true'")
        self.assertEqual(deploy['permissions'], {'contents': 'read', 'pages': 'write', 'id-token': 'write'})
        self.assertEqual(deploy['steps'][0]['with']['ref'], '${{ github.sha }}')
        self.assertIn('origin/main', deploy['steps'][1]['run'])
        self.assertEqual(deploy['concurrency'], {'group': 'pages', 'cancel-in-progress': False})
        self.assertEqual(deploy['steps'][-1]['uses'], 'actions/deploy-pages@v4')
        # Default success() dependency semantics block failed/cancelled parents.
        self.assertNotIn('always()', deploy['if'])

    def test_artifact_ignores_untracked_and_modified_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'repo'
            root.mkdir()
            def git(*args):
                return subprocess.run(['git', *args], cwd=root, check=True, capture_output=True)
            git('init')
            (root / 'index.html').write_text('tested commit')
            git('add', 'index.html')
            git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture')
            (root / 'index.html').write_text('not tested')
            (root / 'private-backup.json').write_text('synthetic untracked fixture')
            target = Path(folder) / 'site'
            stager.stage(root, target)
            self.assertEqual((target / 'index.html').read_text(), 'tested commit')
            self.assertFalse((target / 'private-backup.json').exists())
            self.assertFalse((target / '.git').exists())


if __name__ == '__main__':
    unittest.main()
