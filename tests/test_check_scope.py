"""CSS scope inference, complete partitions, conservative fallback and evidence."""
from collections import Counter
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'cloud'))
import check_scope as scope
import check as gate


class CheckScope(unittest.TestCase):
    def plan(self, changes, blobs=None, verified=True, base='a' * 40):
        def read(ref, path):
            return blobs[(ref, path)]
        return scope.classify(changes, read, gate.SMOKES, base, verified)

    def test_every_known_css_maps_to_complete_disjoint_partitions(self):
        for path in scope.CSS_SCREENS:
            with self.subTest(path=path):
                plan = self.plan([('M', path)])
                self.assertEqual(plan['profile'], 'css')
                self.assertTrue(plan['smokes'])
                self.assertTrue(set(plan['smokes']) <= set(gate.SMOKES))
                expected = gate.selected_tests(smokes=plan['smokes'], node_tests=scope.CSS_NODE_TESTS)
                for count in (1, 2, 4, 20):
                    actual = [name for i in range(count) for name in gate.selected_tests(i, count, smokes=plan['smokes'], node_tests=scope.CSS_NODE_TESTS)]
                    self.assertEqual(Counter(actual), Counter(expected))
                    self.assertEqual(len(actual), len(set(actual)))
        self.assertEqual(set(self.plan([('M', 'styles.css')])['smokes']), set(gate.SMOKES))
        self.assertTrue(set(scope.CSS_NODE_TESTS) <= set(gate.NODE_TESTS))

    def test_multiple_stylesheets_union_and_signature_bind_baseline(self):
        paths = ['styles.monitor.css', 'styles.calendar.css']
        plan = self.plan([('M', name) for name in paths])
        self.assertEqual(set(plan['smokes']), set(scope.CSS_SCREENS[paths[0]]) | set(scope.CSS_SCREENS[paths[1]]))
        self.assertEqual(plan['signature'], self.plan([('M', name) for name in reversed(paths)])['signature'])
        self.assertNotEqual(plan['signature'], self.plan([('M', name) for name in paths], base='b' * 40)['signature'])

    def test_behavior_data_tests_unknown_styles_and_file_operations_are_full(self):
        for path in ('app.js', 'mindex.presenter.js', 'scripts/worship-schema.sql', '.env',
                     'tests/smoke_children_theme.py', '.github/workflows/cloud-check.yml',
                     'cloud/check.py', 'unmapped.css', 'vendor/theme.css'):
            with self.subTest(path=path):
                self.assertEqual(self.plan([('M', 'styles.presenter-output.css'), ('M', path)])['profile'], 'full')
        for status in ('A', 'D', 'R100', 'T'):
            self.assertEqual(self.plan([(status, 'styles.monitor.css')])['profile'], 'full')
        self.assertEqual(self.plan([])['profile'], 'full')
        self.assertEqual(self.plan([('M', 'docs/note.md')])['profile'], 'full')
        self.assertEqual(self.plan([('M', 'styles.monitor.css')], verified=False)['profile'], 'full')

    def test_release_companions_require_version_only(self):
        base = 'a' * 40
        before = 'const fallbackVersion = "v1";\nconst compiledAppVersion = "v1";\n<body>unchanged</body>'
        after = before.replace('v1', 'v2')
        blobs = {(base, 'index.html'): before, ('HEAD', 'index.html'): after,
                 (base, 'mindex-release.json'): '{"version":"v1"}', ('HEAD', 'mindex-release.json'): '{"version":"v2"}',
                 (base, 'app.runtime.json'): '{"version":"v1","source_sha256":"unchanged"}',
                 ('HEAD', 'app.runtime.json'): '{"version":"v2","source_sha256":"unchanged"}'}
        changes = [('M', name) for name in ('styles.monitor.css', 'index.html', 'mindex-release.json', 'app.runtime.json', 'docs/note.md')]
        self.assertEqual(self.plan(changes, blobs)['profile'], 'css')
        for path, bad in [('index.html', after + '<script>changed()</script>'),
                          ('mindex-release.json', '{"version":"v2","new":1}'),
                          ('app.runtime.json', '{"version":"v2","source_sha256":"changed"}')]:
            changed = dict(blobs); changed[('HEAD', path)] = bad
            self.assertEqual(self.plan(changes, changed)['profile'], 'full')
        self.assertFalse(scope.metadata_only('index.html', before, after.replace('compiledAppVersion', 'other')))
        self.assertFalse(scope.metadata_only('app.runtime.json', '{}', '{}'))

    def test_published_baseline_requires_all_shards_and_pages(self):
        run = dict(id=1, run_attempt=2, head_sha='a' * 40, head_branch='main',
                   head_repository={'full_name':'owner/repo'}, path='.github/workflows/cloud-check.yml',
                   event='push', status='completed', conclusion='success')
        jobs = [dict(name=name, status='completed', conclusion='success') for name in
                [*(f'offline-web ({i})' for i in range(4)), 'deploy-pages']]
        def verify(candidate=run, checks=jobs):
            return scope.published_baseline(lambda path: {'workflow_runs':[candidate]} if '/workflows/' in path else {'jobs':checks}, 'owner/repo', 'a' * 40)
        self.assertTrue(verify())
        for field, value in (('head_branch','codex/other'), ('head_sha','other'), ('conclusion','failure'), ('head_repository',{'full_name':'fork/repo'})):
            self.assertFalse(verify(dict(run, **{field:value})))
        self.assertFalse(verify(checks=jobs[:-1]))
        self.assertFalse(verify(checks=jobs + jobs[:1]))
        for state in ('failure', 'cancelled', 'skipped', None):
            bad = copy.deepcopy(jobs); bad[-1]['conclusion'] = state
            self.assertFalse(verify(checks=bad))

    def test_unknown_or_unavailable_scope_falls_back_to_full(self):
        with tempfile.TemporaryDirectory() as folder:
            output, summary = Path(folder)/'out', Path(folder)/'summary'
            for error in (OSError('missing history'), ValueError('malformed API'), TimeoutError('unavailable')):
                output.write_text('')
                with patch.dict(os.environ, GITHUB_OUTPUT=str(output), GITHUB_STEP_SUMMARY=str(summary)), patch.object(scope, 'build_plan', side_effect=error), patch('sys.stdout', new_callable=io.StringIO):
                    scope.main()
                self.assertIn('profile=full\n', output.read_text())
                self.assertIn('signature=full\n', output.read_text())

    def test_invalid_runner_selection_fails_before_subprocess(self):
        for value in ('[]', '["unknown.py"]', '["smoke_children_theme.py","smoke_children_theme.py"]', '{}', 'invalid'):
            with patch.dict(os.environ, MINDEX_CHECK_PROFILE='css', MINDEX_CHECK_SMOKES=value), patch.object(gate.subprocess, 'run') as run:
                with self.assertRaises(ValueError): gate.scope_parameters()
                run.assert_not_called()
        with patch.dict(os.environ, MINDEX_CHECK_PROFILE='css', MINDEX_CHECK_SMOKES='["smoke_children_theme.py"]'), patch('sys.argv',['check.py','--shard-index','1','--shard-count','4']), patch.object(gate.subprocess,'run',side_effect=subprocess.CalledProcessError(1,'fixture')), patch('sys.stdout',new_callable=io.StringIO):
            with self.assertRaises(subprocess.CalledProcessError): gate.main()


if __name__ == '__main__': unittest.main()
