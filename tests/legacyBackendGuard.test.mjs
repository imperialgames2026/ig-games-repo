import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const adapter = readFileSync(new URL('../api/base44Client.js', import.meta.url), 'utf8');
test('undeployed legacy Edge Function calls fail closed by default', () => {
  assert.match(adapter, /VITE_ENABLE_LEGACY_EDGE_FUNCTIONS === 'true'/);
  assert.match(adapter, /if \(!LEGACY_EDGE_FUNCTIONS_ENABLED\)/);
  assert.match(adapter, /No transaction was submitted/);
});
test('wallet and transaction entities remain server-controlled', () => {
  assert.match(adapter, /entity === 'UserWallet' \|\| entity === 'Transaction'/);
  assert.match(adapter, /server-controlled/);
});
