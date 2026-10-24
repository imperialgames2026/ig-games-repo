import importlib.util
import sys
import json
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
        remaining = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
        calls = []
        def request(config, action, **payload):
            calls.append(action)
            if action == 'worker_expired':
                return {'retention_protocol': cleanup.PROTOCOL, 'result': [{'id': x} for x in remaining]}
            if payload['id'].endswith('1') and calls.count('worker_expired') == 1:
                raise RuntimeError('synthetic failure')
            remaining.remove(payload['id'])
            return {'retention_protocol': cleanup.PROTOCOL, 'result': {'deleted': True}}
        with self.assertRaises(RuntimeError):
            cleanup.cycle({}, request)
        self.assertEqual(remaining, ['00000000-0000-4000-8000-000000000001'])
        self.assertEqual(cleanup.cycle({}, request)['deleted'], 1)
        self.assertEqual(cleanup.cycle({}, request)['deleted'], 0)
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

    def test_old_or_rolled_back_api_is_not_reported_healthy(self):
        for reply in ({'result': []}, {'retention_protocol': 'reconcile-v1', 'result': []}, {'retention_protocol': 'legacy', 'result': []}):
            calls = []
            def request(config, action, **payload):
                calls.append(action)
                return reply
            with self.assertRaises(cleanup.RetentionFailure) as error:
                cleanup.cycle({}, request)
            self.assertEqual(error.exception.report['failure'], 'incompatible_api')
            self.assertEqual(calls, ['worker_expired'])

    def test_deletion_must_be_explicitly_acknowledged(self):
        for reply in ({'result': {'deleted': True}}, {'retention_protocol': cleanup.PROTOCOL, 'result': {'deleted': False}}, {'retention_protocol': cleanup.PROTOCOL, 'result': {}}, {'retention_protocol': cleanup.PROTOCOL, 'result': {'deleted': 1}}):
            def request(config, action, **payload):
                return {'retention_protocol': cleanup.PROTOCOL, 'result': [{'id': '00000000-0000-4000-8000-000000000001'}]} if action == 'worker_expired' else reply
            with self.assertRaises(cleanup.RetentionFailure) as error:
                cleanup.cycle({}, request)
            self.assertEqual(error.exception.report['deleted'], 0)
            self.assertEqual(error.exception.report['failed'], 1)

    def test_invalid_batch_has_no_partial_deletion(self):
        valid = {'id': '00000000-0000-4000-8000-000000000001'}
        for items in ({}, [valid, {'id': 'secret-invalid'}], [valid, valid], [valid] * 11):
            calls = []
            def request(config, action, **payload):
                calls.append(action)
                return {'retention_protocol': cleanup.PROTOCOL, 'result': items}
            with self.assertRaises(cleanup.RetentionFailure) as error:
                cleanup.cycle({}, request)
            self.assertEqual(error.exception.report['failure'], 'invalid_queue')
            self.assertEqual(calls, ['worker_expired'])
            self.assertNotIn('secret-invalid', str(error.exception.report))

    def test_saturated_failure_batch_is_visible_without_ids(self):
        ids = ['00000000-0000-4000-8000-%012d' % i for i in range(10)]
        def request(config, action, **payload):
            if action == 'worker_expired':
                return {'retention_protocol': cleanup.PROTOCOL, 'result': [{'id': i} for i in ids]}
            raise RuntimeError('SECRET provider detail')
        with self.assertRaises(cleanup.RetentionFailure) as error:
            cleanup.cycle({}, request)
        report = error.exception.report
        self.assertEqual((report['selected'], report['deleted'], report['failed']), (10, 0, 10))
        self.assertTrue(report['batch_full'])
        self.assertEqual(report['due_count_lower_bound'], 10)
        self.assertNotIn('SECRET', json.dumps(report))
        self.assertNotIn(ids[0], json.dumps(report))

    def test_oneshot_failure_exit_and_metrics(self):
        report = {'event': 'retention_cycle', 'status': 'failed', 'failure': 'queue_unavailable'}
        with patch.object(sys, 'argv', ['cleanup.py', '--config', 'synthetic', '--once']), patch.object(cleanup, 'read_config', return_value={}), patch.object(cleanup, 'cycle', side_effect=cleanup.RetentionFailure(report)), patch.object(cleanup.time, 'monotonic', side_effect=[10, 12]), patch('builtins.print') as output, patch.object(cleanup.time, 'sleep') as sleep:
            self.assertEqual(cleanup.main(), 1)
            self.assertEqual(json.loads(output.call_args.args[0])['duration_seconds'], 2)
            sleep.assert_not_called()

    def test_loop_retries_after_completion_without_overlap(self):
        report = {'event': 'retention_cycle', 'status': 'complete', 'deleted': 0}
        with patch.object(sys, 'argv', ['cleanup.py', '--config', 'synthetic']), patch.object(cleanup, 'read_config', return_value={}), patch.object(cleanup, 'cycle', return_value=report) as cycle, patch('builtins.print'), patch.object(cleanup.time, 'sleep', side_effect=KeyboardInterrupt) as sleep:
            with self.assertRaises(KeyboardInterrupt): cleanup.main()
            cycle.assert_called_once()
            sleep.assert_called_once_with(60)

    def test_loop_logs_failure_then_retries_and_recovers(self):
        failure = cleanup.RetentionFailure({'event': 'retention_cycle', 'status': 'failed', 'failure': 'queue_unavailable'})
        success = {'event': 'retention_cycle', 'status': 'complete', 'deleted': 0}
        with patch.object(sys, 'argv', ['cleanup.py', '--config', 'synthetic']), patch.object(cleanup, 'read_config', return_value={}), patch.object(cleanup, 'cycle', side_effect=[failure, success]) as cycle, patch('builtins.print') as output, patch.object(cleanup.time, 'sleep', side_effect=[None, KeyboardInterrupt]) as sleep:
            with self.assertRaises(KeyboardInterrupt): cleanup.main()
            self.assertEqual(cycle.call_count, 2)
            self.assertEqual([json.loads(c.args[0])['status'] for c in output.call_args_list], ['failed', 'complete'])
            self.assertEqual([c.args for c in sleep.call_args_list], [(60,), (60,)])

if __name__ == '__main__': unittest.main()
