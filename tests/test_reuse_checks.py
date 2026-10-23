"""Exact-commit reuse must never accept partial or untrusted gate evidence."""
import copy
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reuse_checks', ROOT / 'cloud/reuse_checks.py')
reuse = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reuse)


class ReuseChecks(unittest.TestCase):
    def setUp(self):
        self.run = dict(id=123, head_sha='exact', head_repository={'full_name': 'owner/repo'}, path='.github/workflows/cloud-check.yml', event='push', head_branch='codex/fix', status='completed', conclusion='success', run_attempt=2)
        self.jobs = [dict(name=f'offline-web ({i})', status='completed', conclusion='success') for i in range(4)] + [dict(name='scope', status='completed', conclusion='success', steps=[dict(name='Scope proof: full', status='completed', conclusion='success')])]

    def verify(self, run=None, jobs=None):
        return reuse.verified_run(self.run if run is None else run, self.jobs if jobs is None else jobs, 'owner/repo', 'exact', 456)

    def test_exact_success_only(self):
        self.assertTrue(self.verify())
        for key, value in [('head_sha', 'other'), ('id', 456), ('head_repository', {'full_name': 'fork/repo'}), ('path', 'other.yml'), ('event', 'pull_request'), ('head_branch', 'main'), ('status', 'in_progress'), ('conclusion', 'failure')]:
            with self.subTest(key=key):
                self.assertFalse(self.verify(dict(self.run, **{key: value})))

    def test_every_shard_must_succeed_exactly_once(self):
        for state in ('failure', 'cancelled', 'skipped', None):
            jobs = copy.deepcopy(self.jobs)
            jobs[2]['conclusion'] = state
            self.assertFalse(self.verify(jobs=jobs))
        self.assertFalse(self.verify(jobs=self.jobs[:3]))
        self.assertFalse(self.verify(jobs=self.jobs + self.jobs[:1]))
        jobs = copy.deepcopy(self.jobs)
        jobs[0]['status'] = 'in_progress'
        self.assertFalse(self.verify(jobs=jobs))

    def test_scoped_proof_requires_matching_baseline_and_selection(self):
        signature = 'css-' + 'a' * 20
        jobs = copy.deepcopy(self.jobs)
        jobs[-1]['steps'][0]['name'] = 'Scope proof: ' + signature
        self.assertTrue(reuse.verified_run(self.run, jobs, 'owner/repo', 'exact', 456, signature))
        self.assertFalse(self.verify(jobs=jobs))
        self.assertFalse(reuse.verified_run(self.run, jobs, 'owner/repo', 'exact', 456, 'css-' + 'b' * 20))
        self.assertTrue(reuse.verified_run(self.run, self.jobs, 'owner/repo', 'exact', 456, signature))
        self.assertFalse(self.verify(jobs=self.jobs[:-1]))
        jobs[-1]['conclusion'] = 'failure'
        self.assertFalse(reuse.verified_run(self.run, jobs, 'owner/repo', 'exact', 456, signature))

    def test_pagination_and_successful_attempt(self):
        seen = []
        def get(path):
            seen.append(path)
            if '/workflows/' in path:
                return {'workflow_runs': [self.run]}
            self.assertIn('/attempts/2/jobs?', path)
            return {'jobs': [dict(name='unrelated')] * 100 if path.endswith('&page=1') else self.jobs}
        self.assertEqual(reuse.find_verified(get, 'owner/repo', 'exact', 456), '123')
        self.assertEqual(len(seen), 3)

    def test_api_failure_runs_full_gate_and_non_main_does_not_query(self):
        with tempfile.TemporaryDirectory() as folder:
            output = str(Path(folder) / 'output')
            env = dict(GITHUB_EVENT_NAME='push', GITHUB_REF='refs/heads/main', GITHUB_OUTPUT=output, GITHUB_TOKEN='synthetic', GITHUB_REPOSITORY='owner/repo', GITHUB_SHA='exact', GITHUB_RUN_ID='456')
            with patch.dict(os.environ, env), patch.object(reuse.urllib.request, 'urlopen', side_effect=OSError('offline')):
                reuse.main()
            self.assertEqual(Path(output).read_text(), 'reuse=false\n')
            env['GITHUB_REF'] = 'refs/heads/codex/fix'
            with patch.dict(os.environ, env), patch.object(reuse.urllib.request, 'urlopen') as request:
                reuse.main()
                request.assert_not_called()


if __name__ == '__main__':
    unittest.main()
