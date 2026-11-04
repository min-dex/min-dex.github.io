"""Real HTTP media byte ranges for browser decoding; no app/DB setup."""
import threading
import tempfile
import unittest
from functools import partial
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from smoke_app import MindexSmokeHandler, MindexSmokeServer


class MediaHttpTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        Path(self.folder.name, 'sample.mp3').write_bytes(b'0123456789')
        Path(self.folder.name, 'sample.json').write_bytes(b'0123456789')
        self.server = MindexSmokeServer(('127.0.0.1', 0), partial(MindexSmokeHandler, directory=self.folder.name))
        threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': .01}, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}/'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.folder.cleanup()

    def read(self, span=None, method='GET', name='sample.mp3'):
        return urlopen(Request(self.url+name, headers={'Range': span} if span else {}, method=method))

    def test_full_bytes_unchanged(self):
        with self.read() as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers['Content-Length'], '10')
            self.assertEqual(response.read(), b'0123456789')

    def test_closed_open_suffix_and_clamped_ranges(self):
        for span, bounds, data in [('bytes=2-5', '2-5', b'2345'), ('bytes=7-', '7-9', b'789'), ('bytes=-2', '8-9', b'89'), ('bytes=8-999', '8-9', b'89')]:
            with self.subTest(span=span), self.read(span) as response:
                self.assertEqual(response.status, 206)
                self.assertEqual(response.headers['Content-Range'], f'bytes {bounds}/10')
                self.assertEqual(response.headers['Accept-Ranges'], 'bytes')
                self.assertEqual(int(response.headers['Content-Length']), len(data))
                self.assertEqual(response.read(), data)

    def test_head_range_has_no_body(self):
        with self.read('bytes=2-5', 'HEAD') as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(response.headers['Content-Range'], 'bytes 2-5/10')
            self.assertEqual(response.headers['Content-Length'], '4')
            self.assertEqual(response.read(), b'')

    def test_unsatisfiable_range(self):
        for span in ['bytes=10-', 'bytes=9-2', 'bytes=-0']:
            with self.subTest(span=span):
                with self.assertRaises(HTTPError) as error:
                    self.read(span)
                response = error.exception
                self.assertEqual(response.code, 416)
                self.assertEqual(response.headers['Content-Range'], 'bytes */10')
                self.assertEqual(response.read(), b'')
                response.close()

    def test_unrelated_and_malformed_requests_preserved(self):
        for span, name in [('bytes=2-5', 'sample.json'), ('bytes=0-1,5-6', 'sample.mp3'), ('invalid', 'sample.mp3')]:
            with self.subTest(span=span), self.read(span, name=name) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.read(), b'0123456789')


if __name__ == '__main__':
    unittest.main()
