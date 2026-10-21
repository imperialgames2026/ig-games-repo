import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateIsolationTarget, firewallCommands, waitForControlProbe, TEST_PACKAGE, CHAIN } from '../scripts/android-isolation.mjs';

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

test('control probe waits for a booted emulator network route without bypassing proof', async () => {
  let calls = 0;
  let waits = 0;
  const result = await waitForControlProbe(async () => {
    if (++calls < 3) throw new Error('nc: connect: Network is unreachable');
    return 'isolation-control';
  }, { sleep: async () => { waits++; } });
  assert.equal(result, 3);
  assert.equal(calls, 3);
  assert.equal(waits, 2);
});
test('control probe still fails when the route never becomes reachable', async () => {
  await assert.rejects(waitForControlProbe(async () => { throw new Error('Network is unreachable'); }, {
    attempts: 2, sleep: async () => {},
  }), /Network is unreachable/);
});
test('control probe fails immediately for non-network errors or invalid response', async () => {
  let calls = 0;
  await assert.rejects(waitForControlProbe(async () => { calls++; throw new Error('permission denied'); }, {
    sleep: async () => {},
  }), /permission denied/);
  assert.equal(calls, 1);
  await assert.rejects(waitForControlProbe(async () => 'wrong response', { sleep: async () => {} }));
});

test('native lifecycle test awaits real pause and resume before reloading the WebView', () => {
  const source = readFileSync(new URL('../scripts/android-emulator-smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /document\.addEventListener\('pause'/);
  assert.match(source, /document\.addEventListener\('resume'/);
  assert.match(source, /cycle <= 3/);
  assert.ok(source.indexOf('window.__igNativeLifecycle.resumes >= count') < source.indexOf('setOffline(true)'));
  assert.match(source, /assert\.deepEqual\(pageErrors, \[\]/);
  assert.match(source, /page_error_details = pageErrorDetails/);
});
