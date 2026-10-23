"""Release serialization never replaces the required exact-commit gate."""
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'cloud/release_queue.py'
spec = importlib.util.spec_from_file_location('release_queue', SCRIPT)
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)


class ReleaseQueue(unittest.TestCase):
    def test_fifo_cancel_retry_and_owner_protection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            a = queue.update(root, 'join', owner='a')['ticket']
            b = queue.update(root, 'join', owner='b')['ticket']
            self.assertFalse(queue.update(root, 'claim', ticket=b)['claimed'])
            self.assertTrue(queue.update(root, 'claim', ticket=a)['claimed'])
            self.assertTrue(queue.update(root, 'claim', ticket=a)['claimed'])
            with self.assertRaises(ValueError):
                queue.update(root, 'leave', ticket='wrong')
            self.assertFalse(queue.update(root, 'claim', ticket=b)['claimed'])
            queue.update(root, 'leave', ticket=a)
            self.assertTrue(queue.update(root, 'claim', ticket=b)['claimed'])
            c = queue.update(root, 'join', owner='c')['ticket']
            queue.update(root, 'leave', ticket=c)
            self.assertEqual(queue.update(root, 'status')['waiting'], [])
            self.assertEqual(queue.update(root, 'status')['active']['ticket'], b)

    def test_corruption_fails_closed_without_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'state.json'
            path.write_text('{broken')
            with self.assertRaises(ValueError):
                queue.update(root, 'join', owner='a')
            self.assertEqual(path.read_text(), '{broken')

    def test_two_real_worktrees_share_fifo_and_concurrent_joins(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            repo, other = root / 'repo', root / 'other'
            subprocess.run(['git', 'init', '-q', str(repo)], check=True)
            subprocess.run(['git', '-C', str(repo), '-c', 'user.name=Fixture', '-c',
                            'user.email=fixture@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'fixture'], check=True)
            subprocess.run(['git', '-C', str(repo), 'worktree', 'add', '-q', '--detach', str(other)], check=True)

            def run(cwd, *args):
                return subprocess.run(['python3', str(SCRIPT), *args], cwd=cwd,
                                      capture_output=True, text=True)

            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(lambda i: run(repo if i % 2 else other, 'join', '--owner', str(i)), range(8)))
            self.assertTrue(all(r.returncode == 0 for r in results))
            state = json.loads(run(repo, 'status').stdout)
            self.assertEqual(len(state['waiting']), 8)
            self.assertEqual(state, json.loads(run(other, 'status').stdout))
            first, second = [e['ticket'] for e in state['waiting'][:2]]
            self.assertEqual(run(other, 'claim', '--ticket', second).returncode, 2)
            self.assertEqual(run(repo, 'claim', '--ticket', first).returncode, 0)
            self.assertEqual(run(other, 'claim', '--ticket', second).returncode, 2)
            self.assertEqual(run(repo, 'leave', '--ticket', first).returncode, 0)
            self.assertEqual(run(other, 'claim', '--ticket', second).returncode, 0)


if __name__ == '__main__':
    unittest.main()
