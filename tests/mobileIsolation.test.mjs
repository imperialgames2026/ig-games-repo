import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateIsolationTarget, firewallCommands, waitForControlProbe, TEST_PACKAGE, CHAIN } from '../scripts/android-isolation.mjs';
import { requireIsolatedTransport, findAppWebViewSocket, parseForwardPort, createNativeWebViewDevice, withDeadline } from '../scripts/android-webview-transport.mjs';

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
    assert.ok(commands.includes(commands[4]));
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
  assert.ok(source.indexOf('window.__igNativeLifecycle.resumes > previous.resumes') < source.indexOf('setOffline(true)'));
  assert.match(source, /am start -W -a android.intent.action.MAIN -c android.intent.category.HOME/);
  assert.ok(source.indexOf('window.__igNativeLifecycle.pauses > previous.pauses') < source.indexOf('am start -W -n'));
  assert.match(source, /document.visibilityState === 'visible'/);
  assert.match(source, /polling: 100/);
  assert.match(source, /assert\.deepEqual\(pageErrors, \[\]/);
  assert.match(source, /page_error_details = pageErrorDetails/);
});

const proof = {
  serial: 'emulator-5554', enforced_before_app_launch: true,
  runner_socket_control_passed: true, app_uid_egress_probe_blocked: true,
  loopback_only: true, blocked_uid_range: '10000-199999',
};
test('native transport accepts only a proven isolated CI emulator', () => {
  assert.doesNotThrow(() => requireIsolatedTransport(proof, 'true', TEST_PACKAGE));
  for (const key of ['enforced_before_app_launch', 'runner_socket_control_passed', 'app_uid_egress_probe_blocked', 'loopback_only']) {
    assert.throws(() => requireIsolatedTransport({ ...proof, [key]: false }, 'true', TEST_PACKAGE));
  }
  assert.throws(() => requireIsolatedTransport({ ...proof, serial: 'owner-phone' }, 'true', TEST_PACKAGE));
  assert.throws(() => requireIsolatedTransport(proof, 'false', TEST_PACKAGE));
  assert.throws(() => requireIsolatedTransport(proof, 'true', 'another.app'));
  assert.throws(() => requireIsolatedTransport({ ...proof, blocked_uid_range: '10000-10001' }, 'true', TEST_PACKAGE));
});
test('WebView socket selection matches the exact app PID, not a prefix or another app', () => {
  const listing = '000 @webview_devtools_remote_1234\n000 @webview_devtools_remote_123\n000 @webview_devtools_remote_9';
  assert.equal(findAppWebViewSocket('123', listing), 'webview_devtools_remote_123');
  assert.throws(() => findAppWebViewSocket('12', listing));
  assert.throws(() => findAppWebViewSocket('', listing));
  assert.throws(() => findAppWebViewSocket('123;echo bad', listing));
  assert.throws(() => findAppWebViewSocket('123 1234', listing));
  assert.throws(() => findAppWebViewSocket('123', '000 @webview_devtools_remote_123_suffix'));
});
test('forward port accepts numeric loopback ports only', () => {
  assert.equal(parseForwardPort('43210\n'), 43210);
  for (const invalid of ['0', '65536', '-1', 'http://remote:123', '22;bad', '22\n23', '']) assert.throws(() => parseForwardPort(invalid));
});
test('operation deadline returns successful values and propagates original errors', async () => {
  assert.equal(await withDeadline(() => 42, 100, 'fixture'), 42);
  const original = new Error('original failure');
  await assert.rejects(withDeadline(() => { throw original; }, 100, 'fixture'), error => error === original);
});
test('operation deadline rejects a hung transport instead of waiting for the runner timeout', async () => {
  await assert.rejects(withDeadline(() => new Promise(() => {}), 10, 'fixture attach'), /fixture attach timed out/);
  await assert.rejects(withDeadline(() => 42, 0, 'invalid'));
});

function transportFixture(overrides = {}) {
  const commands = [];
  const endpoints = [];
  const phases = [];
  const page = { kind: 'actual-webview-fixture' };
  let closed = false;
  const browser = {
    contexts: () => [{ pages: () => [page] }],
    close: async () => { closed = true; },
  };
  const execute = async (binary, args, options) => {
    commands.push(args);
    assert.equal(binary, 'adb');
    assert.deepEqual(args.slice(0, 2), ['-s', proof.serial]);
    assert.equal(options.timeout, 15000);
    assert.equal(options.killSignal, 'SIGKILL');
    const key = args.slice(2).join(' ');
    if (overrides.execute) {
      const value = await overrides.execute(key);
      if (value !== undefined) return { stdout: value };
    }
    if (key === 'shell getprop ro.product.model') return { stdout: 'Pixel 7 Pro' };
    if (key === `shell pidof ${TEST_PACKAGE}`) return { stdout: '123' };
    if (key === 'shell cat /proc/net/unix') return { stdout: '000 @webview_devtools_remote_999\n000 @webview_devtools_remote_123' };
    if (key === 'forward tcp:0 localabstract:webview_devtools_remote_123') return { stdout: '43210\n' };
    return { stdout: '' };
  };
  const options = {
    ci: 'true', isolation: proof, execute, sleep: async () => {}, checkpoint: phase => phases.push(phase),
    chromium: { connectOverCDP: async (url, options) => {
      endpoints.push({ url, options });
      if (overrides.connect) return overrides.connect();
      return browser;
    } },
  };
  return { options, commands, endpoints, phases, page, closed: () => closed };
}
test('native attach uses the installed app socket and bounded loopback CDP; cleanup removes only its forward', async () => {
  const f = transportFixture();
  const device = await createNativeWebViewDevice(f.options);
  assert.equal(device.model(), 'Pixel 7 Pro');
  assert.equal(device.serial(), proof.serial);
  device.setDefaultTimeout(60000);
  const view = await device.webView({ pkg: TEST_PACKAGE });
  assert.equal(await view.page(), f.page);
  assert.deepEqual(f.endpoints, [{ url: 'ws://127.0.0.1:43210/devtools/browser', options: { timeout: 60000 } }]);
  await device.shell('am start -W -a android.intent.action.MAIN -c android.intent.category.HOME');
  await device.close();
  assert.equal(f.closed(), true);
  assert.deepEqual(f.commands.at(-1), ['-s', proof.serial, 'forward', '--remove', 'tcp:43210']);
  assert.ok(f.commands.every(args => !args.includes('reverse') && !args.includes('--remove-all')));
  assert.deepEqual(f.phases, ['native_transport_model', 'native_webview_socket', 'native_webview_forward', 'native_webview_cdp']);
});
test('missing isolation proof prevents even the first ADB operation', async () => {
  const f = transportFixture();
  await assert.rejects(createNativeWebViewDevice({ ...f.options, isolation: { ...proof, app_uid_egress_probe_blocked: false } }));
  assert.equal(f.commands.length, 0);
});
test('another app cannot be attached and no unbounded timeout can be selected', async () => {
  const f = transportFixture();
  const device = await createNativeWebViewDevice(f.options);
  await assert.rejects(device.webView({ pkg: 'foreign.app' }));
  for (const value of [0, -1, 60001, NaN]) assert.throws(() => device.setDefaultTimeout(value));
  assert.equal(f.endpoints.length, 0);
});
test('failed CDP attachment still removes the allocated forwarding port during cleanup', async () => {
  const f = transportFixture({ connect: () => { throw new Error('CDP fixture failure'); } });
  const device = await createNativeWebViewDevice(f.options);
  await assert.rejects(device.webView({ pkg: TEST_PACKAGE }), /CDP fixture failure/);
  await device.close();
  assert.deepEqual(f.commands.at(-1), ['-s', proof.serial, 'forward', '--remove', 'tcp:43210']);
});
test('ADB timeout is not hidden by readiness retries', async () => {
  const f = transportFixture({ execute: key => {
    if (key.startsWith('shell pidof')) throw Object.assign(new Error('ADB timed out'), { killed: true });
  } });
  const device = await createNativeWebViewDevice(f.options);
  await assert.rejects(device.webView({ pkg: TEST_PACKAGE }), /ADB timed out/);
  assert.equal(f.endpoints.length, 0);
});
test('native runner records phase deadlines and retains all nine original scenarios', () => {
  const source = readFileSync(new URL('../scripts/android-emulator-smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /8 \* 60 \* 1000/);
  assert.match(source, /NativeTestDeadline/);
  assert.match(source, /progress\.json/);
  assert.match(source, /assert\.equal\(report\.results\.length, 9/);
  assert.match(source, /process\.exit\(report\.passed \? 0 : 1\)/);
  assert.doesNotMatch(source, /await android\.devices\(/);
  assert.ok(source.indexOf('await isolateEmulator()') < source.indexOf('await createNativeWebViewDevice('));
});
