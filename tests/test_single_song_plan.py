"""Offline identity allocation regression; all records below are synthetic."""
import json, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class SingleSongPlan(unittest.TestCase):
    def test_stable_ids_retirement_and_unclassified_hold(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)
            data = {k: [] for k in ['mindex_canonical_songs', 'mindex_songs', 'mindex_song_versions', 'mindex_version_units', 'mindex_worship_elements', 'mindex_song_relations']}
            ledger, prior = [], []
            def add(vid, title, tags):
                data['mindex_canonical_songs'].append({'id': vid + '-c', 'title': title})
                data['mindex_songs'].append({'id': vid + '-s', 'title': title})
                data['mindex_song_versions'].append({'id': vid, 'canonical_song_id': vid + '-c', 'source_song_id': vid + '-s', 'praise_types': tags})
            for edition, prefix, total in [('new', 'knh', 645), ('union', 'kth', 558)]:
                for n in range(1, total + 1):
                    vid = prefix + str(n)
                    add(vid, vid, ['hymn'])
                    ledger.append({'versionId': vid, 'edition': edition, 'number': n})
                    prior.append({'legacyVersionId': vid, 'idCandidate': f'{prefix}-{n:03d}'})
            add('existing', 'ZZ renamed', ['ccm'])
            add('new', 'AAA new sorted first', ['ccm'])
            add('unknown', 'No class', [])
            prior.append({'legacyVersionId': 'existing', 'idCandidate': 'ccm-001'})
            for name, obj in [('snapshot', data), ('ledger', {'versions': ledger}), ('prior', {'records': prior, 'summary': {'retiredCandidateIds': ['ccm-999']}})]:
                (p / (name + '.json')).write_text(json.dumps(obj))
            args = [sys.executable, str(ROOT / 'tools/build_single_song_plan.py'), '--snapshot', str(p/'snapshot.json'), '--prior-plan', str(p/'prior.json'), '--hymn-ledger', str(p/'ledger.json'), '--output', str(p/'out')]
            subprocess.run(args, check=True, capture_output=True)
            result = json.loads((p/'out/plan.json').read_text())
            by_id = {r['legacyVersionId']: r for r in result['records']}
            self.assertEqual(by_id['existing']['idCandidate'], 'ccm-001')
            self.assertEqual(by_id['new']['idCandidate'], 'ccm-1000')
            self.assertIsNone(by_id['unknown']['idCandidate'])
            self.assertEqual(result['summary']['retiredCandidateIds'], ['ccm-999'])
            self.assertEqual(result['summary']['productionWrites'], 0)
            before = (p/'out/plan.json').read_bytes()
            replay = subprocess.run(args, capture_output=True)
            self.assertNotEqual(replay.returncode, 0)
            self.assertEqual((p/'out/plan.json').read_bytes(), before)

if __name__ == '__main__':
    unittest.main()
