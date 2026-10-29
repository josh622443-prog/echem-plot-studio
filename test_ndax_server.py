"""Local bridge tests with synthetic input; no NEWARE DLLs or research data."""
import json
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import subprocess
import ndax_api_server as api


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = api.ThreadingHTTPServer(('127.0.0.1', 0), api.Handler)
        cls.url = 'http://127.0.0.1:%s' % cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def post(self, name='fixture.ndax'):
        return Request(self.url + '/api/ndax?mass_g=0.1', data=b'synthetic input',
                       headers={'Content-Type': 'application/octet-stream', 'X-Filename': name})

    def test_current_html(self):
        with urlopen(self.url + '/') as response:
            self.assertEqual(response.read(), api.HTML.read_bytes())

    def test_health_identifies_release_and_package(self):
        with patch.object(api, 'check_dependencies', return_value={'reader': 'newarenda-python'}):
            with urlopen(self.url + '/health') as response:
                status = json.load(response)
        self.assertTrue(status['ok'])
        self.assertEqual(status['version'], '1.25.0')
        self.assertEqual(status['root'], str(api.ROOT))

    def test_upload_returns_extractor_workbook(self):
        workbook = {'sheetNames': ['Record'], 'sheets': {'Record': {'headers': ['Voltage'], 'rows': [{'Voltage': 3.5}]}}}
        def extract(args, **kwargs):
            self.assertEqual(Path(args[2]).read_bytes(), b'synthetic input')
            self.assertEqual(args[4:], ['--mass-g', '0.1'])
            self.assertTrue(args[1].endswith('ndax_reader.py'))
            Path(args[3]).write_text(json.dumps(workbook), encoding='utf-8')
            return subprocess.CompletedProcess(args, 0, '', '')
        with patch.object(api.subprocess, 'run', side_effect=extract):
            with urlopen(self.post()) as response:
                self.assertEqual(json.load(response), workbook)

    def test_extractor_error_is_returned(self):
        result = subprocess.CompletedProcess([], 1, '', 'Invalid NDAX fixture')
        with patch.object(api.subprocess, 'run', return_value=result):
            with self.assertRaises(HTTPError) as caught:
                urlopen(self.post())
        self.assertEqual(caught.exception.code, 422)
        self.assertIn('Invalid NDAX fixture', json.load(caught.exception)['error'])

    def test_invalid_mass_rejected_before_parsing(self):
        for mass in ['nan', 'inf', '0', '-1']:
            request = Request(self.url + '/api/ndax?mass_g=' + mass, data=b'fixture', headers={'X-Filename': 'fixture.ndax'})
            with self.assertRaises(HTTPError) as caught:
                urlopen(request)
            self.assertEqual(caught.exception.code, 400)

    def test_non_ndax_rejected(self):
        with self.assertRaises(HTTPError) as caught:
            urlopen(self.post('fixture.csv'))
        self.assertEqual(caught.exception.code, 415)


if __name__ == '__main__':
    unittest.main()
