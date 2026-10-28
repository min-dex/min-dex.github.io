"""Offline ID-transition planner/verifier. Never connects to or writes a database.

Input: records, issuedIds (including deleted), counters, active, references, preserved.
references: [{path: [typed object keys/list indexes], id: exact current ID}].
Paths address the whole snapshot. Only explicitly inventoried reference leaves
are rewritten. Historical payloads belong in preserved and remain byte-equivalent.
"""
import argparse
import copy
import hashlib
import json
import os
import re
from pathlib import Path

ID = re.compile(r'^SONG-(CONT|CHLD)-(\d{4})-(\d{4})$')


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def leaf(value, path):
    for key in path:
        require((isinstance(value, dict) and isinstance(key, str)) or
                (isinstance(value, list) and type(key) is int and 0 <= key < len(value)),
                'Invalid reference path')
        value = value[key]
    return value


def assign(value, path, replacement):
    require(bool(path), 'Root replacement forbidden')
    leaf(value, path[:-1])[path[-1]] = replacement


def plan(snapshot):
    require(set(snapshot) == {'records', 'issuedIds', 'counters', 'active', 'references', 'preserved'},
            'Explicit complete snapshot envelope required')
    records = snapshot['records']
    by_id = {r['id']: r for r in records}
    require(len(by_id) == len(records), 'Duplicate records')
    issued = snapshot['issuedIds']
    require(len(set(issued)) == len(issued) and set(by_id) <= set(issued), 'Issued ledger incomplete')
    counter = snapshot['counters']['SONG-CONT']
    require(type(counter) is int and 0 <= counter <= 9999, 'Invalid counter')
    reserved = [int(m[2]) for x in issued if (m := ID.fullmatch(x)) and m[1] == 'CONT']
    require(counter >= max(reserved, default=0), 'Allocator behind issued ledger')
    groups = {}
    for old in sorted(by_id):
        if not old.startswith('SONG-CHLD-'):
            continue
        match = ID.fullmatch(old)
        require(match is not None and int(match[2]) > 0 and int(match[3]) > 0, 'Invalid source ID')
        groups.setdefault(old.rsplit('-', 1)[0], []).append(old)
    require(bool(groups), 'No source IDs; do not replay migration')
    mapping = {}
    for group, members in sorted(groups.items()):
        counter += 1
        require(counter <= 9999, 'ID capacity exceeded')
        for old in members:
            new = f'SONG-CONT-{counter:04d}-{old.rsplit("-", 1)[1]}'
            require(new not in issued, 'Issued destination collision')
            mapping[old] = new
    after = copy.deepcopy(snapshot)
    changes, seen = [], set()
    for ref in snapshot['references']:
        path = ref['path']
        token = json.dumps(path)
        require(token not in seen, 'Duplicate reference path')
        seen.add(token)
        require(path and path[0] not in ('issuedIds', 'counters', 'references', 'preserved'),
                'Immutable bookkeeping/history cannot be reference targets')
        # Lyric/audio/timing content is never an ID rewriting surface.
        require('content' not in path and 'legacy' not in path, 'Protected content reference')
        if ref.get('kind') == 'sourceText':
            require(path[-1] == 'sourceText', 'Source text adapter scope')
            original = leaf(snapshot, path)
            require(isinstance(original, str), 'Source text must be text')
            pattern = re.compile(r'(?m)^([ \t]*-[ \t]*곡 ID:[ \t]*)(SONG-CHLD-\d{4}-\d{4})([ \t]*\r?$)')
            updated = pattern.sub(lambda hit: hit[1] + mapping.get(hit[2], hit[2]) + hit[3], original)
            if updated != original:
                assign(after, path, updated)
                changes.append({'path': path, 'before': original, 'after': updated})
            continue
        require(leaf(snapshot, path) == ref['id'], 'Reference drift')
        if ref['id'] in mapping:
            assign(after, path, mapping[ref['id']])
            changes.append({'path': path, 'before': ref['id'], 'after': mapping[ref['id']]})
    for i, record in enumerate(records):
        if record['id'] in mapping:
            require(['records', i, 'id'] in [c['path'] for c in changes], 'Missing primary ID reference')
        require(after['records'][i]['content'] == record['content'], 'Content changed')
    # All active exact-ID occurrences must be accounted for. Unknown fields block
    # planning instead of silently changing lyrics, URLs, labels or serialized JSON.
    def audit(value, path):
        if isinstance(value, dict):
            for k, v in value.items():
                require(k not in mapping, 'ID object key needs reviewed adapter')
                audit(v, path + [k])
        elif isinstance(value, list):
            for i, v in enumerate(value):
                audit(v, path + [i])
        elif isinstance(value, str):
            require(not any(old in value for old in mapping),
                    'Unmapped ID occurrence at ' + json.dumps(path))
    audit(after['records'], ['records'])
    audit(after['active'], ['active'])
    after['issuedIds'] = issued + sorted(mapping.values())  # old IDs never reused
    after['counters']['SONG-CONT'] = counter
    after['references'] = [copy.deepcopy(r) if r.get('kind') == 'sourceText' else {**r, 'id': mapping.get(r['id'], r['id'])} for r in snapshot['references']]
    return {'format': 1, 'scope': 'offline-candidate-not-production-authority',
            'beforeHash': digest(snapshot), 'afterHash': digest(after),
            'mapping': mapping, 'changes': changes, 'before': snapshot, 'after': after}


def verify(package, current, rollback=False):
    # Recompute rather than trust editable expected hashes or a caller's patch.
    require(package == plan(package['before']), 'Plan tampered or stale tool contract')
    expected = package['after'] if rollback else package['before']
    require(current == expected, 'Snapshot drift; reread and replan, never overwrite')
    return copy.deepcopy(package['before'] if rollback else package['after'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['plan', 'verify', 'rollback-rehearsal'])
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--plan', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    if args.mode == 'plan':
        result = plan(snapshot)
    else:
        require(args.plan is not None, '--plan required')
        result = verify(json.loads(args.plan.read_text()), snapshot, args.mode == 'rollback-rehearsal')
    # Never overwrite evidence; private permissions from creation, not after write.
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as out:
        json.dump(result, out, ensure_ascii=False, indent=2, allow_nan=False)
        out.write('\n')
    print(json.dumps({'status': 'offline-pass', 'productionWrites': 0}))


if __name__ == '__main__':
    main()
