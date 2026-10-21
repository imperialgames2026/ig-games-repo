import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const TEST_PACKAGE = 'com.imperialgaming.practice.dev';
export const CHAIN = 'IG_APK_ISOLATION';

export function validateIsolationTarget({ ci, serial, emulator, rootUid, appUid, packageId }) {
  assert.equal(ci, 'true', 'This firewall helper runs only in disposable CI.');
  assert.match(serial, /^emulator-\d+$/, 'Refusing a physical device.');
  assert.equal(emulator, '1', 'An Android emulator is required.');
  assert.equal(rootUid, '0', 'A rootable google_apis emulator is required.');
  assert.equal(packageId, TEST_PACKAGE, 'Only the provisional practice app is allowed.');
  assert.ok(Number.isInteger(appUid) && appUid >= 10000 && appUid < 20000, 'Unexpected emulator app UID.');
}

export function firewallCommands(binary) {
  assert.ok(['iptables', 'ip6tables'].includes(binary), 'Unexpected firewall binary.');
  // Block all Android application/isolated-renderer UIDs, not just the main app.
  // Preserve loopback and root/shell ADB connectivity. Never flush existing rules.
  return [
    `${binary} -w -N ${CHAIN}`,
    `${binary} -w -A ${CHAIN} -o lo -j RETURN`,
    `${binary} -w -A ${CHAIN} -j REJECT`,
    `${binary} -w -I OUTPUT 1 -m owner --uid-owner 10000-199999 -j ${CHAIN}`,
    `${binary} -w -C OUTPUT -m owner --uid-owner 10000-199999 -j ${CHAIN}`,
    `${binary} -w -C ${CHAIN} -j REJECT`,
  ];
}

export async function isolateEmulator(packageId = TEST_PACKAGE) {
  assert.equal(process.env.CI, 'true', 'Never modify networking on an owner device.');
  assert.equal(packageId, TEST_PACKAGE);
  const adb = async (...args) => (await exec('adb', args, { encoding: 'utf8', timeout: 15000 })).stdout.trim();
  const entries = (await adb('devices')).split('\n').slice(1).filter(line => line.trim());
  assert.equal(entries.length, 1, 'Exactly one disposable emulator must be connected.');
  const [serial, state] = entries[0].trim().split(/\s+/);
  assert.match(serial, /^emulator-\d+$/);
  assert.equal(state, 'device');
  const command = (...args) => adb('-s', serial, ...args);
  const emulator = await command('shell', 'getprop', 'ro.kernel.qemu');
  assert.equal(emulator, '1');
  await command('root');
  await command('wait-for-device');
  const rootUid = await command('shell', 'id', '-u');
  const listing = await command('shell', 'cmd', 'package', 'list', 'packages', '-U', packageId);
  const match = listing.match(new RegExp(`^package:${packageId.replaceAll('.', '\\.')} uid:(\\d+)$`, 'm'));
  assert.ok(match, 'Expected installed practice APK not found.');
  const appUid = Number(match[1]);
  validateIsolationTarget({ ci: process.env.CI, serial, emulator, rootUid, appUid, packageId });
  await command('shell', 'am', 'force-stop', packageId);
  assert.equal(await command('shell', 'run-as', packageId, 'id', '-u'), String(appUid), 'Require a debuggable APK.');
  for (const binary of ['iptables', 'ip6tables']) {
    for (const line of firewallCommands(binary)) await command('shell', line);
  }

  // Prove that a reachable runner-local socket is denied to the app UID.
  // This probe never targets the internet or a hosted backend.
  let connections = 0;
  const probe = createServer(socket => { connections++; socket.end('isolation-control\n'); });
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  try {
    const port = String(probe.address().port);
    assert.match(await command('shell', 'toybox', 'nc', '-w', '3', '10.0.2.2', port), /isolation-control/);
    assert.equal(connections, 1, 'Root control probe did not reach the runner.');
    let output = '';
    try { output = await command('shell', 'run-as', packageId, 'toybox', 'nc', '-w', '3', '10.0.2.2', port); }
    catch (error) { if (error.killed) throw error; }
    assert.doesNotMatch(output, /isolation-control/);
    assert.equal(connections, 1, 'App escaped the emulator network fence.');
  } finally { await new Promise(resolve => probe.close(resolve)); }

  return {
    enforced_before_app_launch: true, serial, app_uid: appUid,
    blocked_uid_range: '10000-199999', loopback_only: true,
    ipv4_rules: await command('shell', 'iptables', '-w', '-S', CHAIN),
    ipv6_rules: await command('shell', 'ip6tables', '-w', '-S', CHAIN),
    runner_socket_control_passed: true, app_uid_egress_probe_blocked: true,
  };
}
