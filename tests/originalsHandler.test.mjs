import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const id = '11111111-1111-4111-8111-111111111111';
function setup({ anonymous = false, code = null } = {}) {
  let handler; const calls = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id, is_anonymous: anonymous } }, error: null }) },
    async rpc(name, args) { calls.push({ name, args }); return { data: { phase: 'committed' }, error: code ? { code } : null }; } };
  const source = readFileSync(new URL('../supabase/functions/ig-originals-practice/index.ts', import.meta.url), 'utf8').replace(/^import .*\n/, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    { createClient: () => client, Response, JSON, Deno: { env: { get: k => k === 'SUPABASE_URL' ? 'https://qonqemhljgxlwpghkxhn.supabase.co' : 'fixture-key' }, serve: fn => handler = fn } });
  return { calls, request: body => handler(new Request('https://fixture.invalid', { method: 'POST', headers: { authorization: 'Bearer fixture' }, body: JSON.stringify(body) })) };
}
test('originals handler binds actor to verified identity and preserves round ID', async () => {
  const h = setup();
  assert.equal((await h.request({ action: 'commit', game: 'coin', requestId: id })).status, 200);
  assert.equal(h.calls[0].args.p_actor, id);
  assert.equal(h.calls[0].args.p_round, id);
  assert.equal(h.calls[0].args.p_client_seed, null);
});
test('originals handler rejects forged outcomes, monetary fields, malformed JSON objects and anonymous sessions', async () => {
  for (const body of [null, [], { action: 'commit', game: 'coin', requestId: id, amount: 1 },
    { action: 'commit', game: 'coin', requestId: id, outcome: 'heads' }, { action: 'commit', game: 'coin', requestId: id, actor_id: id },
    { action: 'reveal', game: 'limbo', roundId: id, clientSeed: '' }, { action: 'commit', game: 'unknown', requestId: id }]) {
    const h = setup(); assert.equal((await h.request(body)).status, 400); assert.equal(h.calls.length, 0);
  }
  const h = setup({ anonymous: true }); assert.equal((await h.request({ action: 'history', game: 'coin' })).status, 401); assert.equal(h.calls.length, 0);
});
test('originals handler preserves conflict, authorization and rate-limit errors', async () => {
  for (const [code, expected] of [['23505',409],['42501',403],['54000',429]]) {
    assert.equal((await setup({ code }).request({ action: 'commit', game: 'coin', requestId: id })).status, expected);
  }
});
