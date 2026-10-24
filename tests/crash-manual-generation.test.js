import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function handlerHarness() {
  let handler;
  const writes = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'synthetic-admin' } }, error: null }) },
    from: table => table === 'user_roles' ? {
      select() { return this; }, eq() { return this; }, in() { return this; },
      maybeSingle: async () => ({ data: { role: 'admin' }, error: null }),
    } : { insert: async rows => { writes.push({ table, rows }); return { error: null }; } },
  };
  const source = readFileSync('supabase/functions/admin-crash-rounds/index.ts', 'utf8')
    .replace(/^import .*\n/, '');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText, {
    createClient: () => client, crypto: webcrypto, TextEncoder, Response,
    Deno: { serve: fn => { handler = fn; }, env: { get: () => 'synthetic' } },
  });
  return { handler, writes };
}

describe('manual Crash generation limits', () => {
  it('generates exactly 75 private rounds for an authorized request', async () => {
    const { handler, writes } = handlerHarness();
    const response = await handler(new Request('https://example.test', {
      method: 'POST', headers: { authorization: 'Bearer synthetic' },
      body: JSON.stringify({ action: 'generate' }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).count).toBe(75);
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe('crash_round_queue');
    expect(writes[0].rows).toHaveLength(75);
    expect(writes[0].rows.map(r => r.ordinal)).toEqual(Array.from({ length: 75 }, (_, i) => i + 1));
  });
  it.each([1, 25, 75])('generates the requested %i rounds within the cap', async count => {
    const { handler, writes } = handlerHarness();
    const response = await handler(new Request('https://example.test', {
      method: 'POST', headers: { authorization: 'Bearer synthetic' },
      body: JSON.stringify({ action: 'generate', count }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).count).toBe(count);
    expect(writes[0].rows).toHaveLength(count);
  });
  it.each([0, -1, 76, 150, 1.5, '25', null])('rejects invalid count %s before generating anything', async count => {
    const { handler, writes } = handlerHarness();
    const response = await handler(new Request('https://example.test', {
      method: 'POST', headers: { authorization: 'Bearer synthetic' },
      body: JSON.stringify({ action: 'generate', count }),
    }));
    expect(response.status).toBe(400);
    expect(writes).toHaveLength(0);
  });
  it('allows browser SDK preflight and denies requests without authentication', async () => {
    const { handler, writes } = handlerHarness();
    const preflight = await handler(new Request('https://example.test', { method: 'OPTIONS' }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('x-client-info');
    expect((await handler(new Request('https://example.test', { method: 'POST' }))).status).toBe(401);
    expect(writes).toHaveLength(0);
  });
});
