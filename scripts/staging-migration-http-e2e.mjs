// Explicit disposable-account staging test. Fixture credentials are never logged.
// Provision/clean up through a trusted operator; never use existing customer accounts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { verifyPracticeDice } from '../lib/practiceFairDice.js';

const fixture = JSON.parse(readFileSync(process.env.STAGING_TEST_FIXTURE, 'utf8'));
assert.equal(fixture.project_ref, 'qonqemhljgxlwpghkxhn');
assert.equal(fixture.disposable, true);
assert.ok(fixture.accounts.every(a => /@example\.invalid$/.test(a.email)));
assert.ok(fixture.anonKey);
const origin = `https://${fixture.project_ref}.supabase.co`;
const [player, recipient, tester, admin, chief] = fixture.accounts;
const results = [];
async function request(path, account, body, method = 'POST', extra = {}) {
  const response = await fetch(origin + path, {
    method, headers: { apikey: fixture.anonKey, ...(account?.token ? { Authorization: `Bearer ${account.token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra },
    ...(body !== undefined ? { body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data, headers: response.headers };
}
const edge = (name, account, body) => request(`/functions/v1/${name}`, account, body);
function status(result, expected) {
  assert.equal(result.status, expected, JSON.stringify({ status: result.status, error: result.data?.error ?? result.data?.message }));
  return result.data;
}
async function group(name, run) { await run(); results.push({ name, passed: true }); console.log(`PASS: ${name}`); }
async function wallet(account, id = account.id) {
  return status(await request(`/rest/v1/wallets?select=user_id,igt_balance&user_id=eq.${id}`, account, undefined, 'GET'), 200);
}
const adjustment = (target, delta, action = 'wallet_adjustment') => ({ action, target_id: target.id, request_id: crypto.randomUUID(), reason: 'Disposable migration integration test', ...(action === 'wallet_adjustment' ? { currency: 'IGT', delta } : {}) });

try {
  await group('Five disposable accounts log in through Supabase Auth', async () => {
    for (const account of fixture.accounts) {
      const result = await request('/auth/v1/token?grant_type=password', null, { email: account.email, password: account.password });
      assert.equal(result.status, 200, result.data?.msg ?? result.data?.message ?? 'Authentication failed');
      assert.equal(result.data.user.id, account.id);
      assert.ok(result.data.access_token);
      account.token = result.data.access_token;
    }
  });
  await group('RLS hides other player wallets and all role writes are denied', async () => {
    assert.equal((await wallet(player)).length, 1);
    assert.deepEqual(await wallet(player, recipient.id), []);
    assert.deepEqual(await wallet(tester, player.id), []);
    assert.ok([401,403].includes((await request(`/rest/v1/user_roles?user_id=eq.${player.id}`, player, { role: 'superadmin' }, 'PATCH')).status));
  });
  await group('Canonical wallet roles, exact transfer retry and payload conflict', async () => {
    const payload = { kind: 'transfer', operation_id: crypto.randomUUID(), amount: 10, recipient_id: recipient.id };
    const before = (await wallet(player))[0].igt_balance;
    const recipientBefore = (await wallet(recipient))[0].igt_balance;
    const first = status(await edge('secure-wallet', player, payload), 200);
    assert.deepEqual(status(await edge('secure-wallet', player, payload), 200), first);
    status(await edge('secure-wallet', player, { ...payload, amount: 11 }), 409);
    assert.equal(Number((await wallet(player))[0].igt_balance), Number(before) - 10);
    assert.equal(Number((await wallet(recipient))[0].igt_balance), Number(recipientBefore) + 10);
    status(await edge('secure-wallet', tester, { ...payload, operation_id: crypto.randomUUID(), recipient_id: player.id }), 403);
    status(await edge('secure-wallet', player, { ...payload, operation_id: crypto.randomUUID(), actor_id: chief.id }), 400);
  });
  await group('Admin permissions, protected targets, exclusion and superadmin-only adjustment', async () => {
    status(await edge('admin-mutations', player, adjustment(recipient, 1)), 403);
    status(await edge('admin-mutations', admin, adjustment(recipient, 1)), 403);
    status(await edge('admin-mutations', admin, adjustment(chief, null, 'exclude')), 403);
    status(await edge('admin-mutations', admin, adjustment(player, null, 'exclude')), 200);
    status(await edge('secure-wallet', player, { kind: 'dice', operation_id: crypto.randomUUID(), amount: 1, guess: 1 }), 403);
    status(await edge('admin-mutations', admin, adjustment(player, null, 'restore')), 200);
    const payload = adjustment(recipient, 1);
    const before = Number((await wallet(recipient))[0].igt_balance);
    status(await edge('admin-mutations', chief, payload), 200);
    assert.equal(status(await edge('admin-mutations', chief, payload), 200).result.replayed, true);
    assert.equal(Number((await wallet(recipient))[0].igt_balance), before + 1);
  });
  await group('Profile saves, one-time display names and tester restrictions', async () => {
    status(await request(`/rest/v1/profiles?id=eq.${player.id}`, player, { full_name: 'HTTP Test Player' }, 'PATCH'), 204);
    const display = `HTTP-${crypto.randomUUID().slice(0,12)}`;
    status(await request(`/rest/v1/profiles?id=eq.${player.id}`, player, { display_name: display }, 'PATCH'), 204);
    status(await request(`/rest/v1/profiles?id=eq.${player.id}`, player, { display_name: display + '-again' }, 'PATCH'), 403);
    status(await request(`/rest/v1/profiles?id=eq.${tester.id}`, tester, { display_name: display.toUpperCase() }, 'PATCH'), 409);
    status(await request(`/rest/v1/profiles?id=eq.${tester.id}`, tester, { full_name: 'Forbidden tester change' }, 'PATCH'), 403);
    const changed = status(await request(`/rest/v1/profiles?select=id,full_name,display_name&id=eq.${player.id}`, player, undefined, 'GET'), 200);
    assert.equal(changed[0].full_name, 'HTTP Test Player');
    assert.equal(changed[0].display_name, display);
  });
  await group('Avatar upload/download/removal and cross-owner upload denial', async () => {
    const file = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8V0AAAAASUVORK5CYII=', 'base64'));
    const filename = `${crypto.randomUUID()}.png`;
    const own = `${player.id}/${filename}`;
    try {
      status(await request(`/storage/v1/object/profile-avatars/${own}`, player, file, 'POST', { 'Content-Type': 'image/png' }), 200);
      const avatar = `${origin}/storage/v1/object/public/profile-avatars/${own}`;
      status(await request(`/rest/v1/profiles?id=eq.${player.id}`, player, { profile_picture: avatar }, 'PATCH'), 204);
      const publicResponse = await fetch(avatar, { signal: AbortSignal.timeout(20000) });
      assert.equal(publicResponse.status, 200);
      assert.ok([400,403].includes((await request(`/storage/v1/object/profile-avatars/${recipient.id}/${filename}`, player, file, 'POST', { 'Content-Type': 'image/png' })).status));
      assert.ok([400,403].includes((await request(`/storage/v1/object/profile-avatars/${tester.id}/${filename}`, tester, file, 'POST', { 'Content-Type': 'image/png' })).status));
    } finally {
      await request(`/rest/v1/profiles?id=eq.${player.id}`, player, { profile_picture: null }, 'PATCH');
      status(await request('/storage/v1/object/profile-avatars', player, { prefixes: [own] }, 'DELETE'), 200);
    }
  });
  await group('IGN exact replay and tester mutation denial', async () => {
    const operation = { action: 'demo_grant', operation_id: crypto.randomUUID() };
    const first = status(await edge('ign-staking-v1', player, operation), 200);
    status(await edge('ign-staking-v1', player, { action: 'stake', operation_id: crypto.randomUUID(), amount: 10 }), 200);
    assert.deepEqual(status(await edge('ign-staking-v1', player, operation), 200), first);
    status(await edge('ign-staking-v1', tester, operation), 403);
    status(await edge('ign-staking-v1', tester, { action: 'overview' }), 200);
  });
  await group('Dice commitment/reveal verifies independently and belongs to one player', async () => {
    const commit = status(await edge('provably-fair-v2', player, { action: 'commit', game: 'dice' }), 200);
    status(await edge('provably-fair-v2', recipient, { action: 'reveal', roundId: commit.id, clientSeed: 'migration-http-proof' }), 404);
    const reveal = status(await edge('provably-fair-v2', player, { action: 'reveal', roundId: commit.id, clientSeed: 'migration-http-proof' }), 200);
    assert.equal(await verifyPracticeDice(commit, reveal), true);
    assert.deepEqual(status(await edge('provably-fair-v2', player, { action: 'reveal', roundId: commit.id, clientSeed: 'migration-http-proof' }), 200), reveal);
    status(await edge('provably-fair-v2', tester, { action: 'commit', game: 'dice' }), 403);
  });
  await group('Existing practice tables expose state through authenticated services', async () => {
    status(await edge('ig-crash-v2', player, { action: 'state' }), 200);
    status(await edge('ig-shared-event-practice', player, { game: 'baccarat', action: 'state' }), 200);
    status(await edge('ig-blackjack-practice', player, { action: 'state' }), 200);
  });
} finally {
  for (const account of fixture.accounts) {
    if (account.token) await request('/auth/v1/logout?scope=global', account, undefined).catch(() => {});
    delete account.token;
  }
  if (process.env.STAGING_TEST_REPORT) writeFileSync(process.env.STAGING_TEST_REPORT,
    JSON.stringify({ project: fixture.project_ref, completedGroups: results.length, results }, null, 2) + '\n');
}
console.log(`All ${results.length} authenticated HTTP groups passed. Disposable database fixtures still require operator cleanup.`);
