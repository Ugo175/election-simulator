"""HTTP integration tests for the browser API and its shared election engine."""
import csv
import http.client
import json
from pathlib import Path
import subprocess
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer

from election import parse_ballots, simulate
from server import Handler, MAX_REQUEST


class QuietHandler(Handler):
    def log_message(self, *_args):
        pass


class WebTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        try:
            connection.request(method, path, body, headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def post(self, payload):
        status, _, body = self.request('POST', '/api/simulate', json.dumps(payload),
                                       {'Content-Type': 'application/json'})
        return status, json.loads(body)

    def test_api_cli_parity_and_transfers(self):
        path = Path('examples/ballots.csv')
        status, result = self.post({'candidates': ['Ada', 'Grace', 'Linus'], 'csv': path.read_text()})
        cli = subprocess.check_output([sys.executable, 'election.py', str(path), '--candidates',
                                       'Ada', 'Grace', 'Linus'], text=True)
        self.assertEqual(status, 200)
        self.assertEqual(result, json.loads(cli))
        self.assertEqual(result['runoff']['rounds'][0]['transfers'],
                         [{'from': 'Linus', 'to': 'Grace', 'ballots': 2}])
        self.assertEqual(len(result['ranked_ballots']), 9)

    def test_transfers_to_exhausted(self):
        result = simulate('A\nA\nA\nA\nB\nB\nB\nC\nC', ['A', 'B', 'C'])
        self.assertEqual(result['runoff']['rounds'][0]['transfers'],
                         [{'from': 'C', 'to': None, 'ballots': 2}])
        self.assertEqual(result['runoff']['rounds'][-1]['exhausted'], 2)

    def test_payload_validation(self):
        for payload in [None, [], {}, {'candidates': 'A,B', 'csv': 'A'},
                        {'candidates': [1, 'B'], 'csv': 'B'},
                        {'candidates': ['A', 'B'], 'csv': ['A']},
                        {'candidates': ['A', 'B'], 'csv': 'A,A'},
                        {'candidates': ['A', 'B'], 'csv': ''}]:
            with self.subTest(payload=payload):
                status, result = self.post(payload)
                self.assertEqual(status, 400)
                self.assertIn('error', result)

    def test_static_whitelist_and_security_headers(self):
        for path in ['/', '/styles.css', '/app.js', '/favicon.svg']:
            status, headers, body = self.request('GET', path)
            self.assertEqual(status, 200)
            self.assertTrue(body)
            self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
            self.assertIn("script-src 'self'", headers['Content-Security-Policy'])
        for path in ['/election.py', '/.git/config', '/../README.md']:
            self.assertEqual(self.request('GET', path)[0], 404)

    def test_foreign_origin_and_host_rejected(self):
        self.assertEqual(self.request('POST', '/api/simulate', '{}',
                                      {'Content-Type': 'application/json', 'Origin': 'https://elsewhere.test'})[0], 403)
        self.assertEqual(self.request('GET', '/', headers={'Host': 'elsewhere.test'})[0], 403)

    def test_malformed_json_size_and_content_type(self):
        self.assertEqual(self.request('POST', '/api/simulate', '{', {'Content-Type': 'application/json'})[0], 400)
        self.assertEqual(self.request('POST', '/api/simulate', '{}', {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.request('POST', '/api/simulate', headers={
            'Content-Type': 'application/json', 'Content-Length': str(MAX_REQUEST + 1)})[0], 413)

    def test_csv_quoted_names_and_bom(self):
        self.assertEqual(parse_ballots('\ufeff"Ada, Jr.",Grace\nGrace', ['Ada, Jr.', 'Grace']),
                         [['Ada, Jr.', 'Grace'], ['Grace']])
        with self.assertRaises(csv.Error):
            parse_ballots('"Ada', ['Ada', 'Grace'])

    def test_candidate_and_ballot_limits(self):
        for candidates in [['A', 'A'], [' A', 'B'], ['A\nX', 'B'], ['A' * 61, 'B'],
                           [str(index) for index in range(21)]]:
            with self.assertRaises(ValueError):
                parse_ballots('A', candidates)
        with self.assertRaises(ValueError):
            parse_ballots('A\n' * 10001, ['A', 'B'])
