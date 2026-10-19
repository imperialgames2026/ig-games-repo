import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const id = '11111111-1111-4111-8111-111111111111';
function setup(name, { role = 'player', profileRole = 'superadmin', excluded = false, anonymous = false, roleError = null, url = 'https://qonqemhljgxlwpghkxhn.supabase.co' } = {}) {
  let handler;
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id, is_anonymous: anonymous } }, error: null }) },
    from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() {
      return { data: table === 'profiles' ? { role: profileRole, is_excluded: excluded } : role ? { role } : null, error: table === 'user_roles' ? roleError : null };
    } }; },
    async rpc(name, args) { calls.push({ name, args }); return { data: { ok: true }, error: null }; },
  };
  const source = readFileSync(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8').replace(/^import .*\n/, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    { Deno: { env: { get: key => key === 'SUPABASE_URL' ? url : 'fixture-key' }, serve: fn => handler = fn }, createClient: () => client, Response, JSON, console });
  return { calls, async request(body) { return handler(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify(body) })); } };
}
const transfer = { kind: 'transfer', operation_id: id, amount: 10, recipient_id: '22222222-2222-4222-8222-222222222222' };
const admin = { action: 'exclude', request_id: id, target_id: id, reason: 'Fixture reason for exclusion' };
test('wallet uses canonical role despite stale privileged profile', async () => {
  const permitted = setup('secure-wallet');
  assert.equal((await permitted.request(transfer)).status, 200);
  assert.equal(permitted.calls[0].args.p_actor, id);
  for (const options of [{ role: 'tester' }, { role: null }, { excluded: true }, { anonymous: true }, { roleError: { message: 'offline' } }]) {
    const h = setup('secure-wallet', options);
    assert.ok([401,403,503].includes((await h.request(transfer)).status));
    assert.equal(h.calls.length, 0);
  }
});
test('admin uses canonical permission and reserves balance changes for superadmin', async () => {
  const h = setup('admin-mutations', { role: 'admin', profileRole: 'player' });
  assert.equal((await h.request(admin)).status, 200);
  assert.equal((await h.request({ ...admin, action: 'wallet_adjustment', currency: 'IGT', delta: 1 })).status, 403);
  assert.equal(h.calls.length, 1);
  for (const options of [{ role: 'tester' }, { role: 'player' }, { role: null }, { excluded: true }, { anonymous: true }]) {
    const denied = setup('admin-mutations', options);
    assert.ok([401,403].includes((await denied.request(admin)).status));
    assert.equal(denied.calls.length, 0);
  }
});
test('money handlers reject forged actor fields and non-staging environments', async () => {
  for (const [name, body] of [['secure-wallet', transfer], ['admin-mutations', admin]]) {
    const h = setup(name, { role: name === 'admin-mutations' ? 'superadmin' : 'player' });
    assert.equal((await h.request({ ...body, actor_id: id })).status, 400);
    assert.equal((await h.request({ ...body, padding: 'x'.repeat(5000) })).status, 413);
    assert.equal(h.calls.length, 0);
    const wrong = setup(name, { url: 'https://production.example' });
    assert.equal((await wrong.request(body)).status, 503);
    assert.equal(wrong.calls.length, 0);
  }
});
