import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const id = '11111111-1111-4111-8111-111111111111';
function setup({ anonymous = false, code = null } = {}) {
 let handler; const calls = [];
 const client = { auth: { getUser: async () => ({ data: { user: { id,is_anonymous: anonymous } },error: null }) },
  async rpc(name,args) { calls.push({ name,args }); return { data: { phase: 'active' },error: code ? { code } : null }; } };
 const source = readFileSync(new URL('../supabase/functions/ig-mines-practice/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'');
 vm.runInNewContext(ts.transpileModule(source,{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
  { createClient: () => client,Response,JSON,Deno: { env: { get: k => k === 'SUPABASE_URL' ? 'https://qonqemhljgxlwpghkxhn.supabase.co' : 'fixture-key' },serve: fn => handler = fn } });
 return { calls,request: body => handler(new Request('https://fixture.invalid',{ method: 'POST',headers: { authorization: 'Bearer fixture' },body: JSON.stringify(body) })) };
}
test('Mines binds actor, version, tile and retry key to a verified account', async () => {
 const h = setup();
 assert.equal((await h.request({ action: 'pick',roundId: id,requestId: id,version: 2,cell: 24 })).status,200);
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args)),{ p_actor: id,p_action: 'pick',p_round: id,p_request: id,p_version: 2,p_cell: 24,p_mine_count: null,p_client_seed: null });
});
test('Mines rejects forged boards, monetary fields, anonymous accounts and out-of-range moves', async () => {
 const base = { action: 'commit',roundId: id,mineCount: 3 };
 for (const body of [{ ...base,mines: [1,2,3] },{ ...base,actor_id: id },{ ...base,amount: 10 },{ ...base,mineCount: 25 },
  { action: 'pick',roundId: id,requestId: id,version: 1,cell: -1 },{ action: 'pick',roundId: id,requestId: id,version: 0.5,cell: 0 },
  { action: 'start',roundId: id,requestId: id,version: 0,clientSeed: '' }]) {
  const h = setup(); assert.equal((await h.request(body)).status,400); assert.equal(h.calls.length,0);
 }
 const h = setup({ anonymous: true }); assert.equal((await h.request(base)).status,401); assert.equal(h.calls.length,0);
});
test('Mines preserves server permission, conflict and missing-round errors', async () => {
 for (const [code,status] of [['42501',403],['23505',409],['P0002',404]]) {
  assert.equal((await setup({ code }).request({ action: 'state',roundId: id })).status,status);
 }
});
