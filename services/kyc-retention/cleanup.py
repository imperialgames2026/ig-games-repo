#!/usr/bin/env python3
"""Deletion-only KYC client. Standard library; no evidence downloads or models."""
import argparse
import json
import os
import stat
import time
import urllib.request
from pathlib import Path

PROJECT = 'https://qonqemhljgxlwpghkxhn.supabase.co'
ACTIONS = frozenset(('worker_expired', 'worker_purged'))

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

def cycle(config, request=request_json):
    # One bounded server batch per cycle. One failing item must not starve others.
    items = request(config, 'worker_expired')['result']
    failed = False
    for item in items:
        try:
            request(config, 'worker_purged', id=item['id'])
        except Exception:
            failed = True
    if failed:
        raise RuntimeError('Retention batch incomplete')
    return len(items)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    try:
        config = read_config(Path(args.config))
    except Exception:
        print('Retention configuration unavailable; no sensitive details logged', flush=True)
        return 1
    while True:
        status = 0
        try:
            cycle(config)
            print('Retention cycle complete', flush=True)
        except Exception:
            status = 1
            print('Retention cycle incomplete; retry required; no sensitive details logged', flush=True)
        if args.once:
            return status
        time.sleep(60)

if __name__ == '__main__':
    raise SystemExit(main())
