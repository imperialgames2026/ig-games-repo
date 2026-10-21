import test from 'node:test';
import assert from 'node:assert/strict';
import { inventory } from '../scripts/mobile-dependency-inventory.mjs';
const sha = 'a'.repeat(40);
const lock = { packages: { 'node_modules/a': { version: '1.0.0', dev: true }, 'node_modules/b': { version: '2.0.0' } } };
const clean = () => ({ metadata: { vulnerabilities: { low: 0, moderate: 0, high: 0, critical: 0, total: 0 } }, vulnerabilities: {} });
test('zero findings never grants publication or security acceptance', () => {
  const result = inventory(clean(), lock, sha);
  assert.equal(result.critical_or_high_present, false);
  assert.equal(result.security_release_approved, false);
});
test('retains direct advisories and meta-vulnerability causes separately', () => {
  const audit = clean();
  audit.metadata.vulnerabilities.high = 2; audit.metadata.vulnerabilities.total = 2;
  audit.vulnerabilities = {
    a: { severity: 'high', isDirect: true, nodes: ['node_modules/a'], via: [{ source: 1, title: 'fixture', url: 'https://example.invalid/advisory', range: '<2', severity: 'high' }], effects: ['b'], fixAvailable: true },
    b: { severity: 'high', nodes: ['node_modules/b'], via: ['a'], fixAvailable: { name: 'b', version: '3.0.0', isSemVerMajor: true } },
  };
  const result = inventory(audit, lock, sha);
  assert.equal(result.critical_or_high_present, true);
  assert.equal(result.findings[0].advisories[0].id, 1);
  assert.deepEqual(result.findings[1].dependency_causes, ['a']);
  assert.equal(result.findings[0].nodes[0].installation, 'development');
  assert.equal(result.findings[1].nodes[0].installation, 'production');
  for (const row of result.findings) {
    assert.equal(row.reachability, 'not evaluated');
    assert.equal(row.disposition, 'unresolved; no waiver');
  }
});
test('missing lock nodes remain unknown, never safe or development-only', () => {
  const audit = clean();
  audit.vulnerabilities.a = { severity: 'high', nodes: ['node_modules/missing'] };
  assert.equal(inventory(audit, lock, sha).findings[0].nodes[0].installation, 'unknown');
});
test('registry errors and incomplete reports fail closed', () => {
  assert.throws(() => inventory({ ...clean(), error: { code: 'ENOTFOUND' } }, lock, sha), /Incomplete/);
  assert.throws(() => inventory({}, lock, sha), /Incomplete/);
  assert.throws(() => inventory(clean(), {}, sha), /Incomplete/);
});
test('rejects missing or non-commit source identity', () => {
  assert.throws(() => inventory(clean(), lock, 'main'), /Exact source/);
});
test('rejects malformed severity counts', () => {
  const audit = clean(); audit.metadata.vulnerabilities.high = -1;
  assert.throws(() => inventory(audit, lock, sha), /Invalid audit/);
});
