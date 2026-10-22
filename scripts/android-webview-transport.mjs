import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as pause } from 'node:timers/promises';

const exec = promisify(execFile);
const PACKAGE = 'com.imperialgaming.app';

export async function withDeadline(operation, milliseconds, label) {
  assert.ok(Number.isInteger(milliseconds) && milliseconds > 0 && milliseconds <= 120000);
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function requireIsolatedTransport(isolation, ci, packageId) {
  assert.equal(ci, 'true', 'Native transport runs only in disposable CI.');
  assert.equal(packageId, PACKAGE, 'Only the configured Imperial Games practice APK is permitted.');
  assert.match(isolation?.serial || '', /^emulator-\d+$/, 'Refusing a physical device.');
  assert.equal(isolation.enforced_before_app_launch, true, 'Require pre-launch isolation.');
  assert.equal(isolation.runner_socket_control_passed, true, 'Require a reachable control probe.');
  assert.equal(isolation.app_uid_egress_probe_blocked, true, 'Require demonstrated app egress denial.');
  assert.equal(isolation.loopback_only, true);
  assert.equal(isolation.blocked_uid_range, '10000-199999');
}

export function findAppWebViewSocket(pidOutput, unixSockets) {
  const pids = String(pidOutput).trim().split(/\s+/).filter(Boolean);
  assert.ok(pids.length > 0 && pids.every(pid => /^[1-9]\d*$/.test(pid)), 'Invalid app process ID.');
  const candidates = new Set();
  for (const line of String(unixSockets).split('\n')) {
    const match = line.match(/\s@?(webview_devtools_remote_(\d+))\s*$/);
    if (match && pids.includes(match[2])) candidates.add(match[1]);
  }
  assert.equal(candidates.size, 1, 'Expected exactly one WebView socket belonging to this APK.');
  return [...candidates][0];
}

// Use the installed APK's real debug WebView, not a desktop browser or hosted site.
// Enumerate only after the APK's socket is ready, with explicit deadlines.
// Use Playwright's Android adapter: desktop CDP defaults issue unsupported
// Browser.setDownloadBehavior commands on Android WebView (Playwright 1.57).
// No ADB reverse, public bind, firewall change, or Android-driver installation.
export async function createNativeWebViewDevice({
  android, isolation, ci = process.env.CI, packageId = PACKAGE,
  execute = exec, sleep = pause, checkpoint = () => {},
}) {
  requireIsolatedTransport(isolation, ci, packageId);
  const serial = isolation.serial;
  const adb = async (...args) => {
    const result = await execute('adb', ['-s', serial, ...args], {
      encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
    });
    return String(result.stdout).trim();
  };
  checkpoint('native_transport_model');
  const model = await adb('shell', 'getprop', 'ro.product.model');
  let nativeDevice;
  let timeout = 45000;
  return {
    model: () => model,
    serial: () => serial,
    setDefaultTimeout(value) {
      assert.ok(Number.isInteger(value) && value > 0 && value <= 60000);
      timeout = value;
    },
    shell: command => adb('shell', command),
    async webView({ pkg }) {
      assert.equal(pkg, packageId);
      assert.equal(nativeDevice, undefined, 'Only one native WebView connection is permitted.');
      checkpoint('native_webview_socket');
      let socket;
      let lastError;
      // Bounded readiness polling. Every individual ADB operation also has a deadline.
      const stopAt = Date.now() + timeout;
      do {
        try {
          socket = findAppWebViewSocket(
            await adb('shell', 'pidof', packageId),
            await adb('shell', 'cat', '/proc/net/unix'),
          );
          break;
        } catch (error) {
          lastError = error;
          if (error.killed || error.code === 'ETIMEDOUT') throw error;
          if (Date.now() >= stopAt) break;
          await sleep(500);
        }
      } while (Date.now() < stopAt);
      if (!socket) throw new Error(`Native WebView socket not ready: ${lastError?.message || 'not found'}`);
      checkpoint('native_device_enumeration');
      const devices = await withDeadline(() => android.devices({ omitDriverInstall: true }), timeout,
        'Enumerate isolated Android device');
      assert.equal(devices.length, 1, 'Expected only the disposable test emulator.');
      assert.equal(devices[0].serial(), serial, 'Playwright selected a different device.');
      nativeDevice = devices[0];
      nativeDevice.setDefaultTimeout(timeout);
      checkpoint('native_webview_selection');
      const view = await withDeadline(() => nativeDevice.webView({ socketName: socket }, { timeout }),
        timeout, 'Select installed APK WebView');
      assert.equal(view.pkg(), packageId, 'WebView package does not match the APK.');
      assert.equal(`webview_devtools_remote_${view.pid()}`, socket, 'WebView PID changed during attachment.');
      checkpoint('native_webview_page');
      const page = await withDeadline(() => view.page(), timeout, 'Attach native WebView page');
      assert.ok(page, 'Native adapter returned no WebView page.');
      return { page: async () => page };
    },
    async close() {
      if (nativeDevice) await withDeadline(() => nativeDevice.close(), 10000, 'Close native Android adapter');
    },
  };
}
