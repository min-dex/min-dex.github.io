import unittest
from helpers.readonly_bookkeeping import ReadonlyBookkeeping

class BookkeepingIsolation(unittest.TestCase):
    def request(self, **changes):
        return {'p_token':'b'*64,'p_scope':'device','p_key':'mindex.ui.fixture',
                'p_value':'input','p_revision':'0','p_request_id':'request-1',**changes}

    def test_revision_replay_and_input_are_preserved(self):
        f=ReadonlyBookkeeping();request=self.request();row=f.handle('mindex_state_write_v1',request)
        self.assertEqual(row['revision'],'1');self.assertEqual(request,self.request())
        self.assertEqual(f.handle('mindex_state_write_v1',request),row)
        with self.assertRaisesRegex(ValueError,'STATE_REQUEST_REUSED'):
            f.handle('mindex_state_write_v1',self.request(p_value='changed'))
        with self.assertRaisesRegex(ValueError,'STATE_REVISION_CONFLICT'):
            f.handle('mindex_state_write_v1',self.request(p_request_id='request-2'))
        row['value']='mutated';self.assertEqual(f.handle('mindex_state_read_v1',{'p_token':'b'*64,'p_scope':'device'})[0]['value'],'input')

    def test_context_and_namespace_isolation(self):
        f=ReadonlyBookkeeping();f.handle('mindex_state_write_v1',self.request())
        for other in [ReadonlyBookkeeping()]:
            self.assertEqual(other.handle('mindex_state_read_v1',{'p_token':'b'*64,'p_scope':'device'}),[])
        self.assertEqual(f.handle('mindex_state_read_v1',{'p_token':'c'*64,'p_scope':'device'}),[])
        self.assertEqual(f.handle('mindex_state_read_v1',{'p_token':'b'*64,'p_scope':'session:another'}),[])

    def test_only_exact_bookkeeping_shapes_are_accepted(self):
        f=ReadonlyBookkeeping()
        for name in ['save_worship_service_v1','save_praise_v1','mindex_state_write_v2','get_worship_service_v1']:
            with self.assertRaises(ValueError):f.handle(name,{})
        with self.assertRaises(ValueError):f.handle('mindex_state_read_v1',{'p_token':'b'*64,'p_scope':'device','sid':'service'})
        with self.assertRaises(ValueError):f.handle('mindex_state_write_v1',self.request(p_key='mindex_songs'))
        with self.assertRaises(ValueError):f.handle('mindex_monitor_register',{'service_id':'fixture'})
        self.assertEqual(f.handle('mindex_monitor_register',{}),'a'*64)
        self.assertEqual(f.handle('mindex_monitor_presence',{}),[])


# Execute only the guard definitions, never CLI setup or public config reads.
import ast
import collections
import json
from pathlib import Path
from urllib.parse import urlencode

class Request:
    def __init__(self, method, path, body=None, host='test.fixture.invalid'):
        self.method=method;self.url='https://'+host+path;self.post_data_json=body
class Route:
    def __init__(self, request):self.request=request;self.forwarded=None;self.response=None;self.aborted=False
    def continue_(self, **kwargs):self.forwarded=kwargs
    def fulfill(self, **kwargs):self.response=kwargs
    def abort(self):self.aborted=True

class NetworkGuard(unittest.TestCase):
    def setUp(self):
        from urllib.parse import urlsplit
        source=Path(__file__).with_name('run_live_readonly_smoke.py').read_text()
        nodes=[node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef)and node.name in ('guard','protect')]
        self.g={'url':'https://test.fixture.invalid','host':'test.fixture.invalid','urlsplit':urlsplit,'urlencode':urlencode,
                'json':json,'ReadonlyBookkeeping':ReadonlyBookkeeping,'converted':0,
                'reads':collections.Counter(),'blocked':collections.Counter(),'fixtures':collections.Counter()}
        exec(compile(ast.Module(body=nodes,type_ignores=[]),'<actual readonly guard>','exec'),self.g)
    def call(self,method,path,body=None,fixture=None,host='test.fixture.invalid'):
        route=Route(Request(method,path,body,host));self.g['guard'](route,fixture);return route
    def test_mutations_unknown_rpc_and_cross_host_are_never_forwarded(self):
        for method,path in [('POST','/rest/v1/mindex_songs'),('PATCH','/rest/v1/mindex_worship_services'),
                            ('DELETE','/storage/v1/object/media/test'),('POST','/rest/v1/rpc/save_worship_service_v1'),
                            ('GET','/rest/v1/rpc/save_worship_service_v1'),('POST','/auth/v1/signup')]:
            r=self.call(method,path);self.assertIsNone(r.forwarded);self.assertEqual(r.response['status'],403)
        r=self.call('POST','/rest/v1/rpc/mindex_state_write_v1',{},ReadonlyBookkeeping(),'other.invalid')
        self.assertIsNone(r.forwarded);self.assertEqual(r.response['status'],403)
    def test_worship_post_becomes_read_only_get_and_invalid_body_is_denied(self):
        r=self.call('POST','/rest/v1/rpc/get_worship_service_v1',{'sid':'fixture'})
        self.assertEqual(r.forwarded,{'url':'https://test.fixture.invalid/rest/v1/rpc/get_worship_service_v1?sid=fixture','method':'GET','post_data':''})
        r=self.call('POST','/rest/v1/rpc/get_worship_service_v1',{'sid':'fixture','write':True})
        self.assertIsNone(r.forwarded);self.assertTrue(r.aborted)
    def test_bookkeeping_is_fulfilled_only_locally(self):
        r=self.call('POST','/rest/v1/rpc/mindex_monitor_register',{},ReadonlyBookkeeping())
        self.assertIsNone(r.forwarded);self.assertEqual(r.response['status'],200)
        r=self.call('POST','/not-rpc/mindex_monitor_register',{},ReadonlyBookkeeping())
        self.assertIsNone(r.forwarded);self.assertEqual(r.response['status'],403)
        r=self.call('GET','/rest/v1/rpc/mindex_monitor_register')
        self.assertIsNone(r.forwarded);self.assertEqual(r.response['status'],403)
    def test_websocket_mock_never_connects_or_sync_closes(self):
        class Context:
            def route(self,pattern,callback):self.http=callback
            def route_web_socket(self,pattern,callback):self.websocket=callback
        class Socket:
            def connect_to_server(self):raise AssertionError('Production WebSocket escaped')
            def close(self):raise AssertionError('Sync close deadlock returned')
        context=Context();self.g['protect'](context);context.websocket(Socket())
        callback=context.websocket;self.g['protect'](context);self.assertIs(context.websocket,callback)
        self.assertEqual(self.g['fixtures']['isolated_websocket'],1)

if __name__ == '__main__':unittest.main()
