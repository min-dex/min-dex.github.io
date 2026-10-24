"""Ephemeral test coordination only; never forwards state/presence/output RPCs."""
import copy

class ReadonlyBookkeeping:
    NAMES = {'mindex_state_read_v1', 'mindex_state_write_v1',
             'mindex_monitor_register', 'mindex_monitor_ping', 'mindex_monitor_presence',
             'mindex_remote_output'}

    def __init__(self):
        self.rows = {}
        self.receipts = {}
        self.output_active = False

    def handle(self, name, body):
        if name not in self.NAMES:
            raise ValueError('Unknown bookkeeping RPC')
        if not isinstance(body, dict):
            raise ValueError('Invalid bookkeeping body')
        if name == 'mindex_remote_output':
            return self.output(body)
        if name == 'mindex_monitor_register':
            if body: raise ValueError('Invalid monitor registration')
            return 'a' * 64
        if name == 'mindex_monitor_ping':
            if set(body) != {'p_token', 'p_status'}: raise ValueError('Invalid monitor heartbeat')
            return True
        if name == 'mindex_monitor_presence':
            if body: raise ValueError('Invalid monitor presence')
            return []
        fields = {'p_token', 'p_scope'}
        if name == 'mindex_state_write_v1':
            fields |= {'p_key', 'p_value', 'p_revision', 'p_request_id'}
        if set(body) != fields or not all(isinstance(body[k], str) for k in ('p_token', 'p_scope')):
            raise ValueError('Invalid state scope')
        owner = ('shared', 'shared') if body['p_scope'] == 'shared' else (body['p_token'], body['p_scope'])
        if name == 'mindex_state_read_v1':
            return copy.deepcopy(sorted((row for (scope, _), row in self.rows.items() if scope == owner), key=lambda row: row['key']))
        key, value = body['p_key'], body['p_value']
        if not isinstance(key, str) or not key.startswith(('mindex.', 'mindex:')) or (value is not None and not isinstance(value, str)):
            raise ValueError('Invalid state value')
        revision, request_id = body['p_revision'], body['p_request_id']
        if not isinstance(revision, str) or not revision.isdecimal() or not isinstance(request_id, str):
            raise ValueError('Invalid state request')
        receipt = (owner, request_id)
        if receipt in self.receipts:
            previous, row = self.receipts[receipt]
            if previous != body: raise ValueError('STATE_REQUEST_REUSED')
            return copy.deepcopy(row)
        previous = self.rows.get((owner, key))
        if revision != (previous['revision'] if previous else '0'):
            raise ValueError('STATE_REVISION_CONFLICT')
        row = {'key': key, 'value': value, 'revision': str(int(revision) + 1), 'requestId': request_id}
        self.rows[(owner, key)] = row
        self.receipts[receipt] = (copy.deepcopy(body), row)
        return copy.deepcopy(row)

    def output(self, body):
        identity = {'id': '00000000-0000-4000-8000-000000000100', 'token': 'c' * 64}
        action = body.get('p_action')
        if action == 'register' and set(body) == {'p_action'}:
            self.output_active = True
            return {'ok': True, **identity, 'code': '1234'}
        fields = {'p_action', 'p_id', 'p_token'}
        if action == 'tick':
            fields |= {'p_info', 'p_ready'}
        elif action != 'remove':
            raise ValueError('Unknown local output action')
        if set(body) != fields or any(body.get('p_' + key) != value for key, value in identity.items()):
            raise ValueError('Invalid local output identity')
        if action == 'tick' and (not isinstance(body['p_info'], dict) or body['p_ready'] is not None):
            raise ValueError('Invalid local output presence')
        if not self.output_active:
            return {'ok': False, 'error': 'expired'}
        if action == 'remove':
            self.output_active = False
            return {'ok': True}
        return {'ok': True, 'code': '1234', 'links': [], 'guest': None}

    def broadcast(self, body):
        # Acknowledge HTTP fallback locally; never retain or relay the payload.
        if not isinstance(body, dict) or set(body) != {'messages'} or not isinstance(body['messages'], list) or not body['messages']:
            raise ValueError('Invalid local broadcast')
        for message in body['messages']:
            if (not isinstance(message, dict) or set(message) != {'topic', 'event', 'payload', 'private'}
                or not all(isinstance(message[key], str) for key in ('topic', 'event'))
                or not isinstance(message['payload'], dict) or not isinstance(message['private'], bool)):
                raise ValueError('Invalid local broadcast message')
        return {}
