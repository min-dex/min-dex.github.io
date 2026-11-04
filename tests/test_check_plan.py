"""The planning command cannot mistake an estimate for verification."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'cloud'))
import check
import plan_checks


class CheckPlan(unittest.TestCase):
    def test_inventory_matches_real_full_gate(self):
        result = plan_checks.plan()
        self.assertFalse(result['verificationPerformed'])
        self.assertTrue(result['readOnly'])
        self.assertEqual(sum(row['entryPoints'] for row in result['shards']), len(check.selected_tests()))
        self.assertEqual(sum(row['smokes'] for row in result['shards']), len(check.SMOKES))
        timings = json.loads((ROOT / 'cloud/smoke_timings.json').read_text())
        for row in result['shards']:
            names = check.selected_tests(row['shard'], 4)
            self.assertEqual(row['unmeasuredSmokes'], [n for n in names if n in check.SMOKES and n not in timings])

    def test_cli_outputs_only_machine_readable_plan(self):
        output = subprocess.check_output([sys.executable, str(ROOT / 'cloud/plan_checks.py')], text=True)
        self.assertEqual(json.loads(output), plan_checks.plan())


if __name__ == '__main__':
    unittest.main()
