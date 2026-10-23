"""Check derived hymn review counts; --write refreshes counts, never song data."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
path = ROOT / 'data/hymn-musical-structure.json'
data = json.loads(path.read_text())
versions = data['versions']
assert len({v['versionId'] for v in versions}) == len(versions)
measured = [v for v in versions if v['stanzaApproxMeasures'] is not None]
recitative = [v for v in versions if v['reviewStatus'] == 'recitative_exception']
partial = [v for v in measured if any(p['approxMeasures'] is None for p in v['parts'])]
deferred = [v for v in versions if v.get('reviewDisposition') == 'deferred']
counts = {
    'versions': len(versions),
    'stanzaMeasuredVersions': len(measured),
    'recitativeExceptions': len(recitative),
    # Legacy field includes recitative versions; keep its meaning stable.
    'unmeasuredVersions': len(versions) - len(measured),
    'fullyMeasuredVersions': len(measured) - len(partial),
    'partiallyMeasuredVersions': len(partial),
    'notMeasuredVersions': len(versions) - len(measured) - len(recitative),
    # Overlaps partial/notMeasured; never add this to the population total.
    'deferredVersions': len(deferred),
    'complete': len(measured) + len(recitative) == len(versions) and not partial and not deferred,
}
if args.write:
    data['summary'].update(counts)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
else:
    assert all(data['summary'].get(k) == value for k, value in counts.items()), 'Stale summary; run with --write'
print(json.dumps(counts, ensure_ascii=False))
