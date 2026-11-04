"""Read-only full-gate inventory; estimates are scheduling hints, never PASS."""
import json
from pathlib import Path

import check


def plan():
    timings = json.loads((Path(__file__).parent / 'smoke_timings.json').read_text())
    shards = []
    for index in range(4):
        selected = check.selected_tests(index, 4)
        smokes = [name for name in selected if name in check.SMOKES]
        unknown = [name for name in smokes if name not in timings]
        shards.append({
            'shard': index,
            'entryPoints': len(selected),
            'smokes': len(smokes),
            'estimatedSmokeSeconds': round(sum(timings.get(name, 10.0) for name in smokes), 1),
            'unmeasuredSmokes': unknown,
        })
    return {
        'readOnly': True,
        'verificationPerformed': False,
        'profile': 'full',
        'shards': shards,
        'excludedFromEstimate': ['runner queue', 'setup/downloads', 'unit/manual checks', 'Pages', 'public readback'],
        'warning': 'Historical smoke timings are not a deadline or a verification receipt. Unmeasured smokes use 10s only for scheduling.',
    }


if __name__ == '__main__':
    print(json.dumps(plan(), ensure_ascii=False, indent=2))
