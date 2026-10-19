import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINALS_GAMES, verifyOriginalsRound } from '../lib/originalsFairness.js';
const f = JSON.parse(readFileSync(process.env.STAGING_TEST_FIXTURE, 'utf8'));
assert.equal(f.project_ref, 'qonqemhljgxlwpghkxhn');
assert.equal(f.disposable, true);
assert.ok(f.accounts.every(a => a.email.endsWith('@example.invalid')));
const url = `https://${f.project_ref}.supabase.co`;
const accounts = f.accounts.slice(0,3);
async function call(path, actor, body, method = 'POST') {
  const res = await fetch(url + path, { method, headers: { apikey: f.anonKey, 'Content-Type': 'application/json',
    ...(actor?.token ? { Authorization: `Bearer ${actor.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const raw = await res.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: res.status, data, headers: res.headers };
}
const endpoint = '/functions/v1/ig-originals-practice';
try {
  for (const a of accounts) {
    const r = await call('/auth/v1/token?grant_type=password', null, { email: a.email, password: a.password });
    assert.equal(r.status, 200, r.data?.message ?? 'Login failed');
    a.token = r.data.access_token;
  }
  for (const game of ORIGINALS_GAMES) {
    const requestId = crypto.randomUUID(), clientSeed = 'http-game-proof-🎲';
    const body = { action: 'commit', game, requestId };
    const c = await call(endpoint, accounts[0], body);
    assert.equal(c.status, 200, JSON.stringify(c.data));
    assert.deepEqual((await call(endpoint, accounts[0], body)).data, c.data);
    assert.equal(c.data.serverSeed, undefined);
    assert.equal((await call(endpoint, accounts[1], { action: 'reveal', game, roundId: requestId, clientSeed })).status, 409);
    const revealed = await call(endpoint, accounts[0], { action: 'reveal', game, roundId: requestId, clientSeed });
    assert.equal(revealed.status, 200, JSON.stringify(revealed.data));
    assert.equal(await verifyOriginalsRound(c.data, revealed.data, { game, clientSeed }), true);
    assert.deepEqual((await call(endpoint, accounts[0], { action: 'reveal', game, roundId: requestId, clientSeed })).data, revealed.data);
    assert.equal((await call(endpoint, accounts[0], { action: 'reveal', game, roundId: requestId, clientSeed: 'different' })).status, 409);
    assert.equal((await call(endpoint, accounts[2], { ...body, requestId: crypto.randomUUID() })).status, 403);
    const history = await call(endpoint, accounts[0], { action: 'history', game });
    assert.equal(history.status, 200);
    assert.ok(history.data.rounds.some(r => r.roundId === requestId));
    assert.equal((await call(endpoint, accounts[0], { ...body, actor_id: accounts[1].id })).status, 400);
    console.log(`PASS: ${game} authenticated proof, ownership, immutable retry, tester denial and history`);
  }
  for (const name of ['ig-originals-practice','secure-wallet','admin-mutations']) {
    const r = await call(`/functions/v1/${name}`, accounts[0], undefined, 'OPTIONS');
    assert.equal(r.status, 204);
    assert.match(r.headers.get('access-control-allow-headers'), /x-client-info/);
  }
  assert.ok([401,403].includes((await call('/rest/v1/ig_originals_practice_rounds?select=server_seed', accounts[0], undefined, 'GET')).status));
  console.log('PASS: browser CORS headers and raw server seed table denial');
} finally {
  for (const a of accounts) if (a.token) await call('/auth/v1/logout?scope=global', a, undefined).catch(() => {});
}
