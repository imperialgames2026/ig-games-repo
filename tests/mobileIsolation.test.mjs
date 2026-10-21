import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateIsolationTarget, firewallCommands, TEST_PACKAGE, CHAIN } from '../scripts/android-isolation.mjs';

const valid = { ci: 'true', serial: 'emulator-5554', emulator: '1', rootUid: '0', appUid: 10142, packageId: TEST_PACKAGE };
test('only disposable CI emulator targets are permitted', () => assert.doesNotThrow(() => validateIsolationTarget(valid)));
for (const [key, value] of [['ci', undefined], ['ci', 'false'], ['serial', 'physical-device'], ['emulator', '0'], ['rootUid', '2000'], ['appUid', 0], ['appUid', 2000], ['appUid', 20000], ['packageId', 'com.imperialgaming.release']]) {
  test(`refuses unsafe isolation target ${key}=${value}`, () => assert.throws(() => validateIsolationTarget({ ...valid, [key]: value })));
}
for (const binary of ['iptables', 'ip6tables']) {
  test(`${binary} denies application and isolated-renderer network before launch`, () => {
    const commands = firewallCommands(binary);
    assert.ok(commands.includes(`${binary} -w -A ${CHAIN} -o lo -j RETURN`));
    assert.ok(commands.includes(`${binary} -w -A ${CHAIN} -j REJECT`));
    assert.ok(commands.includes(`${binary} -w -I OUTPUT 1 -m owner --uid-owner 10000-199999 -j ${CHAIN}`));
    assert.ok(commands.includes(`${binary} -w -C OUTPUT -m owner --uid-owner 10000-199999 -j ${CHAIN}`));
    assert.ok(commands.every(command => !/\s-(?:F|X|P)\b/.test(command)), 'Never flush unrelated firewall rules');
  });
}
test('rejects shell injection in firewall binary', () => assert.throws(() => firewallCommands('iptables; echo unsafe')));
test('network fence precedes first native launch and report never implies publication', () => {
  const source = readFileSync(new URL('../scripts/android-emulator-smoke.mjs', import.meta.url), 'utf8');
  assert.ok(source.indexOf('await isolateEmulator()') < source.indexOf('am start -n'));
  assert.match(source, /hosted_auth_acceptance: false, publication_approved: false/);
  assert.match(source, /report\.passed = true/);
  assert.match(source, /finally \{[\s\S]*result\.json/);
});
