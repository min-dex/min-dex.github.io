"""Sharding preserves every gate check exactly once and propagates failure."""
from collections import Counter
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('cloud_check', ROOT / 'cloud/check.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class CloudShards(unittest.TestCase):
    def test_smoke_server_keeps_isolation_with_short_shutdown_poll(self):
        spec = importlib.util.spec_from_file_location('smoke_server_contract', ROOT / 'tests/smoke_app.py')
        smoke = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(smoke)
        with patch.object(smoke, 'MindexSmokeServer') as server, patch.object(smoke.threading, 'Thread') as thread:
            server.return_value.server_address = ('127.0.0.1', 12345)
            instance, url = smoke.start_local_app_server()
            self.assertIs(instance, server.return_value)
            self.assertEqual(url, 'http://127.0.0.1:12345/index.html')
            self.assertEqual(server.call_args.args[0], ('127.0.0.1', 0))
            thread.assert_called_once_with(target=instance.serve_forever, kwargs={'poll_interval': 0.05}, daemon=True)
            thread.return_value.start.assert_called_once_with()

    def test_complete_disjoint_partition(self):
        full = gate.selected_tests()
        self.assertEqual(len(full), len(set(full)))
        for count in (1, 2, 4, len(gate.SMOKES) + 1):
            combined = [name for index in range(count) for name in gate.selected_tests(index, count)]
            self.assertEqual(Counter(combined), Counter(full))
        self.assertTrue(set(gate.NODE_TESTS) <= set(gate.selected_tests(0, 4)))
        for index in (1, 2, 3):
            self.assertTrue(set(gate.selected_tests(index, 4)) <= set(gate.SMOKES))

    def test_invalid_shards_fail_before_execution(self):
        for index, count in ((-1, 4), (4, 4), (0, 0), (0, -1)):
            with self.assertRaises(ValueError):
                gate.selected_tests(index, count)
        with patch('sys.argv', ['check.py', '--shard-index', '4', '--shard-count', '4']), patch.object(gate.subprocess, 'run') as run, patch('sys.stderr', new_callable=io.StringIO):
            with self.assertRaises(SystemExit) as raised:
                gate.main()
            self.assertEqual(raised.exception.code, 2)
            run.assert_not_called()

    def test_measured_load_is_balanced_and_unknown_tests_are_retained(self):
        timings = json.loads((ROOT / 'cloud/smoke_timings.json').read_text())
        loads = [sum(timings.get(name, 10) for name in gate.selected_tests(i, 4) if name in gate.SMOKES) + (7 if i == 0 else 0) for i in range(4)]
        self.assertLess(max(loads) - min(loads), 10)
        with patch.object(gate, 'SMOKES', gate.SMOKES + ('new_offline_fixture.py',)):
            combined = [name for i in range(4) for name in gate.selected_tests(i, 4)]
            self.assertEqual(combined.count('new_offline_fixture.py'), 1)

    def test_failure_is_not_swallowed_and_offline_env_is_enforced(self):
        with patch('sys.argv', ['check.py', '--shard-index', '1', '--shard-count', '4']), patch.dict(gate.os.environ, {'SUPABASE_TEST_SENTINEL': 'synthetic'}), patch.object(gate.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'fixture')) as run, patch('sys.stdout', new_callable=io.StringIO):
            with self.assertRaises(subprocess.CalledProcessError):
                gate.main()
            kwargs = run.call_args.kwargs
            self.assertTrue(kwargs['check'])
            self.assertEqual(kwargs['timeout'], 180)
            self.assertEqual(kwargs['env']['MINDEX_SMOKE_OFFLINE'], '1')
            self.assertFalse(any('SUPABASE' in key.upper() for key in kwargs['env']))


if __name__ == '__main__':
    unittest.main()
