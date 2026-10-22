import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('cleanup', Path(__file__).with_name('cleanup.py'))
cleanup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cleanup)

class Tests(unittest.TestCase):
    def test_no_model_or_worker_import(self):
        self.assertFalse(any(x in sys.modules for x in ('cv2', 'numpy', 'worker')))
        with patch.object(cleanup.OPENER, 'open') as opener:
            with self.assertRaises(ValueError):
                cleanup.request_json({}, 'worker_claim')
            opener.assert_not_called()

    def test_repeated_cleanup_and_failure_continue(self):
        remaining = ['a', 'b']
        calls = []
        def request(config, action, **payload):
            calls.append(action)
            if action == 'worker_expired':
                return {'result': [{'id': x} for x in remaining]}
            if payload['id'] == 'a' and calls.count('worker_expired') == 1:
                raise RuntimeError('synthetic failure')
            remaining.remove(payload['id'])
            return {'result': {'deleted': True}}
        with self.assertRaises(RuntimeError):
            cleanup.cycle({}, request)
        self.assertEqual(remaining, ['a'])
        self.assertEqual(cleanup.cycle({}, request), 1)
        self.assertEqual(cleanup.cycle({}, request), 0)
        self.assertEqual(set(calls), cleanup.ACTIONS)

    def test_private_config_and_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / 'config.json'
            p.write_text('{"anon_key":"synthetic", "worker_token":"synthetic"}')
            p.chmod(0o644)
            with self.assertRaises(ValueError): cleanup.read_config(p)
            p.chmod(0o600)
            self.assertEqual(cleanup.read_config(p)['anon_key'], 'synthetic')
            link = Path(directory) / 'link'
            link.symlink_to(p)
            with self.assertRaises(OSError): cleanup.read_config(link)

    def test_failure_output_does_not_leak(self):
        with patch.object(sys, 'argv', ['cleanup.py', '--config', 'synthetic', '--once']), patch.object(cleanup, 'read_config', side_effect=ValueError('SECRET')), patch('builtins.print') as output:
            self.assertEqual(cleanup.main(), 1)
            self.assertNotIn('SECRET', str(output.call_args_list))

if __name__ == '__main__': unittest.main()
