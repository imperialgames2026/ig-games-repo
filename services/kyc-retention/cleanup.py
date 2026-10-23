#!/usr/bin/env python3
"""Deletion-only KYC client. Standard library; no evidence downloads or models."""
import argparse
import json
import os
import stat
import uuid
import time
import urllib.request
from pathlib import Path

PROJECT = 'https://qonqemhljgxlwpghkxhn.supabase.co'
ACTIONS = frozenset(('worker_expired', 'worker_purged'))
PROTOCOL = 'reconcile-v1'
BATCH_LIMIT = 10

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect refused')

OPENER = urllib.request.build_opener(NoRedirect())

def read_config(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        mode = os.fstat(stream.fileno()).st_mode
        if not stat.S_ISREG(mode) or stat.S_IMODE(mode) & 0o077:
            raise ValueError('Config must be a private regular file')
        config = json.load(stream)
    if not all(isinstance(config.get(k), str) and config[k] for k in ('anon_key', 'worker_token')):
        raise ValueError('Missing configuration')
    return config

def request_json(config, action, **payload):
    if action not in ACTIONS:
        raise ValueError('Only retention actions are permitted')
    request = urllib.request.Request(PROJECT + '/functions/v1/ig-kyc-v1',
        data=json.dumps({'action': action, **payload}).encode(), headers={
            'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config['anon_key'],
            'apikey': config['anon_key'], 'x-kyc-worker-token': config['worker_token']})
    with OPENER.open(request, timeout=30) as response:
        data = response.read(1024 * 1024 + 1)
    if len(data) > 1024 * 1024:
        raise ValueError('Oversized response')
    result = json.loads(data)
    if not isinstance(result, dict) or result.get('error'):
        raise ValueError('Retention request failed')
    return result

class RetentionFailure(RuntimeError):
    def __init__(self, report):
        super().__init__('Retention cycle incomplete')
        self.report = report


def cycle(config, request=request_json):
    # Counts describe this bounded due batch, never the total backlog.
    report = {'event': 'retention_cycle', 'status': 'failed', 'failure': None,
              'selected': 0, 'deleted': 0, 'failed': 0, 'batch_full': False,
              'due_count_lower_bound': 0}
    def fail(code):
        report['failure'] = code
        raise RetentionFailure(report)
    try:
        reply = request(config, 'worker_expired')
    except Exception:
        fail('queue_unavailable')
    if not isinstance(reply, dict) or reply.get('retention_protocol') != PROTOCOL:
        fail('incompatible_api')
    items = reply.get('result')
    if not isinstance(items, list) or len(items) > BATCH_LIMIT:
        fail('invalid_queue')
    ids = []
    for item in items:
        try:
            value = item['id']
            if not isinstance(value, str) or str(uuid.UUID(value)) != value:
                raise ValueError('Invalid id')
            ids.append(value)
        except (TypeError, KeyError, ValueError, AttributeError):
            fail('invalid_queue')
    if len(set(ids)) != len(ids):
        fail('invalid_queue')
    report.update(selected=len(ids), due_count_lower_bound=len(ids),
                  batch_full=len(ids) == BATCH_LIMIT)
    for item_id in ids:
        try:
            result = request(config, 'worker_purged', id=item_id)
            if (not isinstance(result, dict) or result.get('retention_protocol') != PROTOCOL
                    or not isinstance(result.get('result'), dict)
                    or result['result'].get('deleted') is not True):
                raise ValueError('Deletion not acknowledged')
            report['deleted'] += 1
        except Exception:
            report['failed'] += 1
    if report['failed']:
        fail('deletion_incomplete')
    report['status'] = 'complete'
    return report

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    try:
        config = read_config(Path(args.config))
    except Exception:
        print(json.dumps({'event': 'retention_cycle', 'status': 'failed', 'failure': 'configuration_unavailable'}), flush=True)
        return 1
    while True:
        status = 0
        started = time.monotonic()
        try:
            report = cycle(config)
        except RetentionFailure as error:
            status, report = 1, error.report
        except Exception:
            status, report = 1, {'event': 'retention_cycle', 'status': 'failed', 'failure': 'unexpected_failure'}
        report['duration_seconds'] = round(time.monotonic() - started, 3)
        print(json.dumps(report, sort_keys=True), flush=True)
        if args.once:
            return status
        time.sleep(60)

if __name__ == '__main__':
    raise SystemExit(main())
