"""Cooperative FIFO release slot shared by local Git worktrees (macOS/Linux).

No Git pushes, network, timers or process termination. A slot is not CI evidence.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import subprocess
import tempfile
import uuid


def common_dir():
    return Path(subprocess.check_output(
        ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'],
        text=True).strip())


@contextmanager
def transaction(root):
    root.mkdir(parents=True, exist_ok=True)
    # This guard covers only the short state transaction, not the CI wait.
    with (root / 'guard').open('a') as guard:
        fcntl.flock(guard, fcntl.LOCK_EX)
        path = root / 'state.json'
        state = json.loads(path.read_text()) if path.exists() else {'active': None, 'waiting': []}
        if not isinstance(state, dict) or set(state) != {'active', 'waiting'}:
            raise ValueError('Invalid queue state; preserve it and inspect before retrying')
        entries = ([state['active']] if state['active'] else []) + state['waiting']
        if any(not isinstance(e, dict) or not all(k in e for k in ('ticket', 'owner', 'joined')) for e in entries):
            raise ValueError('Invalid queue entries; preserve state')
        if len({e['ticket'] for e in entries}) != len(entries):
            raise ValueError('Duplicate tickets; preserve state')
        yield state
        fd, temporary = tempfile.mkstemp(dir=root, prefix='state-')
        try:
            with os.fdopen(fd, 'w') as output:
                json.dump(state, output, ensure_ascii=False, indent=2)
                output.write('\n')
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)


def update(root, action, *, ticket=None, owner=None):
    with transaction(root) as state:
        if action == 'join':
            if not owner or not owner.strip():
                raise ValueError('An owner/task name is required')
            entry = {'ticket': uuid.uuid4().hex, 'owner': owner,
                     'joined': datetime.now(timezone.utc).isoformat()}
            state['waiting'].append(entry)
            return {'ticket': entry['ticket'], 'position': len(state['waiting']), 'active': state['active']}
        if action == 'status':
            return state.copy()
        entries = ([state['active']] if state['active'] else []) + state['waiting']
        if not ticket or ticket not in {e['ticket'] for e in entries}:
            raise ValueError('Unknown ticket; queue unchanged')
        if action == 'claim':
            if state['active'] and state['active']['ticket'] == ticket:
                return {'claimed': True, 'active': state['active']}
            if not state['active'] and state['waiting'][0]['ticket'] == ticket:
                state['active'] = state['waiting'].pop(0)
                return {'claimed': True, 'active': state['active']}
            return {'claimed': False, 'active': state['active'],
                    'position': next(i + 1 for i, e in enumerate(state['waiting']) if e['ticket'] == ticket)}
        if action == 'leave':
            if state['active'] and state['active']['ticket'] == ticket:
                state['active'] = None
            state['waiting'] = [e for e in state['waiting'] if e['ticket'] != ticket]
            return {'released': ticket}
        raise ValueError('Unknown action')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('join', 'claim', 'status', 'leave'))
    parser.add_argument('--owner', help='Task/branch name; required for join')
    parser.add_argument('--ticket', help='Ticket returned by join; required for claim/leave')
    args = parser.parse_args()
    try:
        result = update(common_dir() / 'mindex-release-queue', args.action,
                        ticket=args.ticket, owner=args.owner)
    except (ValueError, OSError, TypeError, KeyError) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    # Waiting is a non-success: never chain a push after an unclaimed slot.
    return 0 if result.get('claimed', True) else 2


if __name__ == '__main__':
    raise SystemExit(main())
