"""Synthetic offline preservation, allocation and drift tests; no DB access."""
import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('transition', Path(__file__).resolve().parents[1] / 'tools/praise_id_transition.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
A, B = 'SONG-CHLD-0001-0001', 'SONG-CHLD-0001-0002'


def fixture():
    records = [{'id': x, 'revision': 7, 'metadata': {'title': '같은 제목'},
                'content': {'lyrics': '첫 줄\n둘째 줄\n\n다음', 'form': ['Lyrics'],
                            'audio_set': {'audioUrl': 'https://example.test/a.mp3', 'cues': [0, 1.25, 8]}},
                'relations': {'same_song': [y], 'related': []}}
               for x, y in [(A, B), (B, A)]]
    refs = []
    for i, r in enumerate(records):
        refs += [{'path': ['records', i, 'id'], 'id': r['id']},
                 {'path': ['records', i, 'relations', 'same_song', 0], 'id': r['relations']['same_song'][0]}]
    refs += [{'path': ['active', 'elements', 0, 'praise_record_id'], 'id': A}]
    return {'records': records, 'issuedIds': [A, B, 'SONG-CONT-0500-0001'],
            'counters': {'SONG-CONT': 500, 'SONG-CHLD': 1},
            'active': {'elements': [{'id': 'unchanged-uuid', 'praise_record_id': A, 'revision': 4}]},
            'references': refs, 'preserved': {'history': {'songId': A, 'lyrics': '옛 원문'}, 'receipt': 'immutable'}}


class Transition(unittest.TestCase):
    def test_roundtrip_and_reserved_deleted_number(self):
        before = fixture(); original = copy.deepcopy(before); p = m.plan(before)
        self.assertEqual(before, original)
        self.assertEqual(p['mapping'], {A: 'SONG-CONT-0501-0001', B: 'SONG-CONT-0501-0002'})
        after = m.verify(p, before)
        self.assertEqual(after['preserved'], before['preserved'])
        self.assertEqual(after['active']['elements'][0]['id'], 'unchanged-uuid')
        for old, new in zip(before['records'], after['records']):
            self.assertEqual(old['content'], new['content'])
        self.assertEqual(m.verify(p, after, rollback=True), before)
        self.assertTrue(set(before['issuedIds']) <= set(after['issuedIds']))

    def test_unknown_reference_and_missing_primary_block(self):
        for change in ('unknown', 'primary', 'serialized'):
            s = fixture()
            if change == 'unknown': s['active']['unknown'] = A
            elif change == 'serialized': s['active']['document'] = '{"id":"' + A + '"}'
            else: s['references'] = s['references'][1:]
            with self.assertRaises(ValueError): m.plan(s)

    def test_drift_tamper_and_post_migration_edit_block_rollback(self):
        p = m.plan(fixture())
        for rollback in (False, True):
            s = copy.deepcopy(p['after'] if rollback else p['before'])
            s['records'][0]['content']['lyrics'] = '누군가 방금 수정'
            with self.assertRaises(ValueError): m.verify(p, s, rollback)
        p['after']['records'][0]['content']['lyrics'] = '변조'
        with self.assertRaises(ValueError): m.verify(p, fixture())

    def test_ledger_counter_capacity_and_replay(self):
        for kind in ('ledger', 'counter', 'capacity', 'duplicate'):
            s = fixture()
            if kind == 'ledger': s['issuedIds'].remove(A)
            if kind == 'counter': s['counters']['SONG-CONT'] = 499
            if kind == 'capacity': s['counters']['SONG-CONT'] = 9999
            if kind == 'duplicate': s['references'].append(s['references'][0])
            with self.assertRaises(ValueError): m.plan(s)
        with self.assertRaises(ValueError): m.plan(m.plan(fixture())['after'])

    def test_source_text_exact_field_only(self):
        s = fixture()
        s['active']['sourceText'] = '원문\r\n- 곡 ID: ' + A + '  \r\n끝\n'
        s['references'].append({'kind': 'sourceText', 'path': ['active', 'sourceText']})
        p = m.plan(s)
        self.assertEqual(p['after']['active']['sourceText'], s['active']['sourceText'].replace(A, p['mapping'][A]))
        self.assertEqual(m.verify(p, p['after'], True), s)
        s['active']['sourceText'] += '본문에 들어간 ' + A
        with self.assertRaises(ValueError): m.plan(s)

    def test_protected_content_never_rewritten(self):
        s = fixture(); s['records'][0]['content']['lyrics'] = A
        s['references'].append({'path': ['records', 0, 'content', 'lyrics'], 'id': A})
        with self.assertRaises(ValueError): m.plan(s)


if __name__ == '__main__': unittest.main()
