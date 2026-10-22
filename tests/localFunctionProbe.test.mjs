import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { isLegacyProbeRequest } from '../scripts/local-function-probe.mjs';

test('local detector catches api-envelope dispatch while ignoring unrelated background requests', async () => {
  let probes = 0;
  const server = createServer(async (req, res) => {
    if (await isLegacyProbeRequest(req)) probes++;
    res.writeHead(404); res.end(); // No forwarding, Auth or hosted service.
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = async (path, body, method = 'POST') => {
      const response = await fetch(origin + path, { method, ...(method === 'POST' ? { body } : {}) });
      await response.text();
    };
    await send('/functions/v1/ig-leaderboard', '{}');
    await send('/functions/v1/api', JSON.stringify({ functionName: 'differentOperation' }));
    await send('/functions/v1/api', '{malformed');
    await send('/functions/v1/api', undefined, 'OPTIONS');
    assert.equal(probes, 0);
    const before = probes;
    await send('/functions/v1/api', JSON.stringify({ functionName: 'legacyReadProbe', payload: {} }));
    assert.equal(probes, before + 1, 'must detect the exact envelope emitted by base44Client');
    assert.throws(() => assert.equal(probes, before), 'no-dispatch assertion must fail when a probe is sent');
    await send('/functions/v1/ig-leaderboard', '{}');
    assert.equal(probes, before + 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
