import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const adapter = readFileSync(new URL('../api/base44Client.js', import.meta.url), 'utf8');
test('undeployed legacy Edge Function calls fail closed by default', () => {
  assert.match(adapter, /VITE_ENABLE_LEGACY_EDGE_FUNCTIONS === 'true'/);
  assert.match(adapter, /if \(!LEGACY_EDGE_FUNCTIONS_ENABLED\)/);
  assert.match(adapter, /No transaction was submitted/);
});
test('all core sensitive entities are read-only in the compatibility adapter', () => {
  for (const name of ['User', 'UserWallet', 'Transaction', 'WeeklyWager', 'WithdrawalRequest', 'TokenPack']) {
    assert.match(adapter, new RegExp("\\b" + name + "\\b"));
  }
  assert.match(adapter, /READ_ONLY_CORE_ENTITIES\.has\(entity\)/);
  assert.match(adapter, /throw legacyWriteBlocked\(entity\)/);
});
test('generic legacy entity mutations are blocked and reads remain available', () => {
  const start = adapter.indexOf('function buildLegacyEntity(entity)');
  const end = adapter.indexOf('const entityCache', start);
  const section = adapter.slice(start, end);
  for (const name of ['create', 'update', 'delete']) {
    assert.match(section, new RegExp('async ' + name + '\\([^)]*\\) \\{\\s*throw legacyWriteBlocked\\(entity\\)'));
  }
  assert.match(section, /async filter\(/);
  assert.match(section, /async list\(/);
});
