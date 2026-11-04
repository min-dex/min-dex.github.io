"""Cooperative FIFO release slot shared by local Git worktrees (macOS/Linux).

No Git pushes, network, timers or process termination. A slot is not CI evidence.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
import re
import sys
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


PHASES = ('preparing', 'queue_wait', 'local_checks', 'auth_wait', 'repair_wait',
          'repair', 'push', 'ci', 'integration', 'pages', 'public_readback', 'handoff')


def stamp():
    return datetime.now(timezone.utc).isoformat()


def journal_path(root, release):
    if not re.fullmatch(r'[0-9a-f]{32}', release or ''):
        raise ValueError('Invalid release ID')
    return root / 'timings' / (release + '.json')


def load_journal(root, release):
    data = json.loads(journal_path(root, release).read_text())
    if data.get('version') != 1 or data.get('release') != release or not data.get('events'):
        raise ValueError('Invalid timing journal; preserve it')
    return data


def save_journal(root, data):
    path = journal_path(root, data['release'])
    path.parent.mkdir(exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='timing-')
    try:
        with os.fdopen(fd, 'w') as output:
            json.dump(data, output, ensure_ascii=False, indent=2)
            output.write('\n'); output.flush(); os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def event(data, kind, phase=None, **fields):
    if data.get('closed'):
        raise ValueError('Release timing is closed')
    row = {'at': stamp(), 'event': kind, **fields}
    if phase:
        if phase not in PHASES:
            raise ValueError('Unknown timing phase')
        row['phase'] = phase
    data['events'].append(row)


def new_journal(release, owner, phase='preparing'):
    return {'version': 1, 'release': release, 'owner': owner, 'events': [
        {'at': stamp(), 'event': 'started', 'phase': phase}]}


def timing_report(data):
    # Consecutive phase intervals partition the observed release wall clock.
    now = stamp()
    transitions = [e for e in data['events'] if 'phase' in e or e['event'] == 'finished']
    totals = {}
    for index, row in enumerate(transitions):
        if 'phase' not in row:
            continue
        end = transitions[index + 1]['at'] if index + 1 < len(transitions) else now
        seconds = (datetime.fromisoformat(end) - datetime.fromisoformat(row['at'])).total_seconds()
        if seconds < 0:
            raise ValueError('Clock moved backwards; do not infer duration')
        totals[row['phase']] = totals.get(row['phase'], 0) + seconds
    pending = {}
    queue_seconds = 0
    for row in data['events']:
        ticket = row.get('ticket')
        if row['event'] == 'joined':
            pending[ticket] = row['at']
        elif row['event'] in ('claimed', 'slot_released') and ticket in pending:
            value = (datetime.fromisoformat(row['at']) - datetime.fromisoformat(pending.pop(ticket))).total_seconds()
            if value < 0:
                raise ValueError('Clock moved backwards; do not infer queue duration')
            queue_seconds += value
    for started in pending.values():
        value = (datetime.fromisoformat(now) - datetime.fromisoformat(started)).total_seconds()
        if value < 0:
            raise ValueError('Clock moved backwards; do not infer queue duration')
        queue_seconds += value
    return {'release': data['release'], 'closed': data.get('closed', False),
            'queueWallSeconds': round(queue_seconds, 3),
            'queueWallNote': 'Join-to-claim/cancel wall time includes overlapping local work; do not add to phase totals',
            'observedSeconds': round(sum(totals.values()), 3),
            'phasesSeconds': {k: round(v, 3) for k, v in totals.items()},
            'runningAttempt': data.get('running'),
            'measurement': 'Observed command/queue boundaries, not inferred human activity',
            'uncertainRecovery': any(e['event'] == 'recovered' for e in data['events']),
            'verificationEvidence': False}


def update(root, action, *, ticket=None, owner=None, release=None):
    with transaction(root) as state:
        if action == 'start':
            if not owner or not owner.strip():
                raise ValueError('An owner/task name is required')
            release = uuid.uuid4().hex
            save_journal(root, new_journal(release, owner))
            return {'release': release}
        if action == 'join':
            if not owner or not owner.strip():
                raise ValueError('An owner/task name is required')
            ticket = uuid.uuid4().hex
            if release:
                data = load_journal(root, release)
            else:
                release = ticket
                data = new_journal(release, owner)
            if data['owner'] != owner or data.get('running'):
                raise ValueError('Timing owner mismatch or command still running')
            event(data, 'joined', 'queue_wait', ticket=ticket)
            entry = {'ticket': ticket, 'owner': owner, 'joined': data['events'][-1]['at'], 'release': release}
            state['waiting'].append(entry)
            save_journal(root, data)
            return {'ticket': ticket, 'release': release, 'position': len(state['waiting']), 'active': state['active']}
        if action == 'status':
            return state.copy()
        entries = ([state['active']] if state['active'] else []) + state['waiting']
        if not ticket or ticket not in {e['ticket'] for e in entries}:
            raise ValueError('Unknown ticket; queue unchanged')
        entry = next(e for e in entries if e['ticket'] == ticket)
        # Pre-instrumentation tickets remain valid; do not fabricate old timestamps.
        rid = entry.get('release')
        if action == 'claim':
            if state['active'] and state['active']['ticket'] == ticket:
                return {'claimed': True, 'active': state['active']}
            if not state['active'] and state['waiting'][0]['ticket'] == ticket:
                if rid:
                    data = load_journal(root, rid)
                    event(data, 'claimed', 'preparing', ticket=ticket)
                    save_journal(root, data)
                state['active'] = state['waiting'].pop(0)
                return {'claimed': True, 'active': state['active']}
            return {'claimed': False, 'active': state['active'],
                    'position': next(i + 1 for i, e in enumerate(state['waiting']) if e['ticket'] == ticket)}
        if action == 'leave':
            if rid:
                data = load_journal(root, rid)
                event(data, 'slot_released', ticket=ticket)
                save_journal(root, data)
            if state['active'] and state['active']['ticket'] == ticket:
                state['active'] = None
            state['waiting'] = [e for e in state['waiting'] if e['ticket'] != ticket]
            return {'released': ticket}
        raise ValueError('Unknown action')


AUTH_ERRORS = ('permission denied (publickey)', 'could not read username',
               'authentication failed', 'resource not accessible by integration')


def run_recorded(root, release, phase, command):
    if phase not in PHASES or not command:
        raise ValueError('A valid phase and command are required')
    attempt = uuid.uuid4().hex
    with transaction(root):
        data = load_journal(root, release)
        if data.get('running'):
            raise ValueError('A recorded command is already running; recover explicitly')
        event(data, 'command_started', phase, attempt=attempt)
        data['running'] = attempt
        save_journal(root, data)
    auth = False
    code = 127
    try:
        # Never store command arguments, output, environment or credentials.
        with subprocess.Popen(command, stderr=subprocess.PIPE, text=True, errors='replace') as process:
            for line in process.stderr:
                sys.stderr.write(line)
                auth = auth or any(pattern in line.lower() for pattern in AUTH_ERRORS)
            code = process.wait()
    except KeyboardInterrupt:
        code = 130
    except OSError:
        code = 127
    finally:
        with transaction(root):
            data = load_journal(root, release)
            if data.get('running') != attempt:
                raise ValueError('Timing attempt changed unexpectedly')
            del data['running']
            event(data, 'command_finished', 'handoff' if code == 0 else 'auth_wait' if auth else 'repair_wait',
                  attempt=attempt, exitCode=code)
            save_journal(root, data)
    return code


def finish_recorded(root, release, outcome, recover=False):
    with transaction(root) as state:
        data = load_journal(root, release)
        if not recover and any(e.get('release') == release for e in ([state['active']] if state['active'] else []) + state['waiting']):
            raise ValueError('Release the owned FIFO ticket before finishing timing')
        if data.get('running') and not recover:
            raise ValueError('Command still running; use explicit recovery only after it has stopped')
        if recover:
            data.pop('running', None)
            event(data, 'recovered', 'repair_wait')
        else:
            event(data, 'finished', outcome=outcome)
            data['closed'] = True
        save_journal(root, data)
        return timing_report(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('start', 'join', 'claim', 'status', 'leave', 'run', 'finish', 'report', 'recover', 'phase'))
    parser.add_argument('--owner')
    parser.add_argument('--ticket')
    parser.add_argument('--release')
    parser.add_argument('--phase', choices=PHASES)
    parser.add_argument('--outcome', choices=('complete', 'abandoned'), default='complete')
    args, command = parser.parse_known_args()
    root = common_dir() / 'mindex-release-queue'
    try:
        if args.action == 'phase':
            if command:
                raise ValueError('Unexpected arguments')
            with transaction(root):
                data = load_journal(root, args.release)
                if data.get('running'):
                    raise ValueError('A command is still running')
                if args.phase not in PHASES:
                    raise ValueError('A phase is required')
                event(data, 'external_boundary', args.phase)
                save_journal(root, data)
                print(json.dumps(timing_report(data), indent=2))
            return 0
        if args.action == 'run':
            return run_recorded(root, args.release, args.phase, command[1:] if command[:1] == ['--'] else command)
        if command:
            raise ValueError('Unexpected arguments')
        if args.action in ('finish', 'recover'):
            result = finish_recorded(root, args.release, args.outcome, args.action == 'recover')
        elif args.action == 'report':
            with transaction(root):
                result = timing_report(load_journal(root, args.release))
        else:
            result = update(root, args.action, ticket=args.ticket, owner=args.owner, release=args.release)
    except (ValueError, OSError, TypeError, KeyError) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get('claimed', True) else 2


if __name__ == '__main__':
    raise SystemExit(main())
